// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { BulkInviteJobStatus } from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { DynamoDBItemAttribute, METADATA_ATTRIBUTES } from '../constants/itemAttributes.js';
import { BULK_INVITE_JOB_PK_TEMPLATE, BULK_INVITE_JOB_SK_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { generateUlid } from '../utils/resourceUtils.js';

/**
 * Tracks a single bulk-invite job. Scoped under the initiating admin's
 * profile partition (PK `profile_{adminProfileId}`, matching how Models are scoped under a
 * profile), keyed by job id (SK `bulkinvitejob_{bulkInviteJobId}`). This layout enables a direct
 * composite-key lookup for polling and a `begins_with` range query for the one-active-job check
 * and future job history, without a secondary index.
 *
 * The Step Functions Map iterations append their per-entry outcomes to `results` and increment
 * the counters immediately on completion (see {@link BulkInviteJobDao.appendEntryResult}); a
 * final aggregation / Catch step marks the job COMPLETED or FAILED.
 */
export const BulkInviteJobEntity = new Entity(
  {
    model: {
      entity: ResourceType.BULK_INVITE_JOB,
      version: '1',
      service: ResourceType.PROFILE,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.ADMIN_PROFILE_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.BULK_INVITE_JOB_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        default: () => generateUlid() as ResourceId,
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.STATUS]: {
        type: Object.values(BulkInviteJobStatus),
        required: true,
      },
      // Set once at creation (the batch size never changes).
      [DynamoDBItemAttribute.TOTAL_ENTRIES]: {
        type: 'number',
        readOnly: true,
        required: true,
      },
      // Counters, incremented via UpdateItem ADD as each entry completes. processedCount =
      // createdCount + skippedCount + failedCount.
      [DynamoDBItemAttribute.PROCESSED_COUNT]: {
        type: 'number',
        required: true,
        default: 0,
      },
      [DynamoDBItemAttribute.CREATED_COUNT]: {
        type: 'number',
        required: true,
        default: 0,
      },
      [DynamoDBItemAttribute.SKIPPED_COUNT]: {
        type: 'number',
        required: true,
        default: 0,
      },
      [DynamoDBItemAttribute.FAILED_COUNT]: {
        type: 'number',
        required: true,
        default: 0,
      },
      // Per-entry results, appended incrementally (list_append). Defaults to [] so the
      // conditional size() guard in appendEntryResult always has a valid list to compare.
      [DynamoDBItemAttribute.RESULTS]: {
        type: 'list',
        required: true,
        default: () => [],
        items: {
          type: 'map',
          properties: {
            emailAddress: { type: 'string', required: true },
            displayName: { type: 'string', required: false },
            status: { type: 'string', required: true },
            reason: { type: 'string', required: false },
          },
        },
      },
      // Present only when the job itself failed (state-machine-level error via the Catch block).
      [DynamoDBItemAttribute.ERROR_MESSAGE]: {
        type: 'string',
        required: false,
      },
      // Set when the job reaches a terminal state (COMPLETED / FAILED / EXPIRED).
      [DynamoDBItemAttribute.COMPLETED_AT]: {
        type: 'string',
        required: false,
      },
      // DynamoDB TTL (epoch seconds), set at creation to createdAt + 90 days. Auto-expires the job
      // record, bounding retention of the plaintext emails in `results` in step with CloudWatch
      // log-group retention. The table's TTL is configured on this attribute
      // (`timeToLiveAttribute`), realizing the design's logical `expiresAt`. Optional so records
      // created before this attribute existed still read.
      [DynamoDBItemAttribute.TTL]: {
        type: 'number',
        required: false,
      },
    },
    indexes: {
      byAdminProfileId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.ADMIN_PROFILE_ID],
          template: BULK_INVITE_JOB_PK_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [DynamoDBItemAttribute.BULK_INVITE_JOB_ID],
          template: BULK_INVITE_JOB_SK_TEMPLATE,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type BulkInviteJobEntity = typeof BulkInviteJobEntity;
export type BulkInviteJobItem = EntityItem<BulkInviteJobEntity>;
