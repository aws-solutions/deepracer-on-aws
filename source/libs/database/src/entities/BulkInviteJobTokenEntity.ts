// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { METADATA_ATTRIBUTES, DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { BULK_INVITE_JOB_PK_TEMPLATE, BULK_INVITE_JOB_TOKEN_SK_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';

// ---------------------------------------------------------------------------
// Idempotency-token guard for BulkInviteUser (mirrors LapTokenEntity's pattern).
//
// Shares the job's PK (profile_{adminProfileId}) so the guard item lives in the same item
// collection as the jobs it protects.
// SK: bulkinvitejobtoken_{clientToken}
//
// BulkInviteJobDao.createJob creates this item conditioned on the SK not already existing,
// alongside the job item, in the same transaction. A replayed BulkInviteUser call (same
// clientToken) fails that condition; the DAO then looks up the guard item to find the
// already-created job and returns it unchanged instead of creating a second job / starting a
// second Step Functions execution (Idempotency standard — a successful retry gets a semantically
// equivalent response with no side effects).
//
// The item carries `ttl` (epoch seconds); the table's TTL is configured on that attribute. TTL is
// best-effort garbage collection — correctness comes from the conditional write, not physical row
// deletion. Only items that set `ttl` are ever expired, so jobs (which do not) are never removed.
// ---------------------------------------------------------------------------

export const BulkInviteJobTokenEntity = new Entity(
  {
    model: {
      entity: ResourceType.BULK_INVITE_JOB_TOKEN,
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
      [DynamoDBItemAttribute.CLIENT_TOKEN]: {
        type: 'string',
        readOnly: true,
        required: true,
      },
      // The job this token created, so a replay can be resolved back to the original job.
      [DynamoDBItemAttribute.BULK_INVITE_JOB_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      // Epoch seconds; table TTL attribute. Self-expires the guard once no retry is possible.
      [DynamoDBItemAttribute.TTL]: {
        type: 'number',
        required: true,
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
          composite: [DynamoDBItemAttribute.CLIENT_TOKEN],
          template: BULK_INVITE_JOB_TOKEN_SK_TEMPLATE,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type BulkInviteJobTokenEntity = typeof BulkInviteJobTokenEntity;
export type BulkInviteJobTokenItem = EntityItem<BulkInviteJobTokenEntity>;
