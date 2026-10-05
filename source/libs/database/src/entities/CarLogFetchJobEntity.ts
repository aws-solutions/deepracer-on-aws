// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { GlobalSecondaryIndex } from '../constants/indexes.js';
import { DynamoDBItemAttribute, METADATA_ATTRIBUTES } from '../constants/itemAttributes.js';
import {
  CAR_LOG_JOB_EVENT_GSI2_PK_TEMPLATE,
  CAR_LOG_JOB_KEY_TEMPLATE,
  CREATED_AT_KEY_TEMPLATE,
} from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { generateResourceId } from '../utils/resourceUtils.js';

/**
 * Tracks one car-log fetch/processing run: from asking a car to upload its rosbags (or a manual
 * upload) through to the generated videos.
 *
 * Primary key: PK=SK=carlogjob_{jobId}
 * GSI1 (all jobs, newest first): PK=carlogjobs, SK=createdAt_{createdAt}
 * GSI2 (jobs by event): PK=carlogjob#event_{eventId}, SK=createdAt_{createdAt}
 */
export const CarLogFetchJobEntity = new Entity(
  {
    model: {
      entity: ResourceType.CAR_LOG_JOB,
      version: '1',
      service: ResourceType.CAR_LOG_JOBS,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.CAR_LOG_JOB_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        default: () => generateResourceId(),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.SOURCE]: {
        // CAR: fetched from a car over SSM; UPLOAD: manually uploaded archive.
        type: ['CAR', 'UPLOAD'] as const,
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.STATUS]: {
        type: Object.values(CarLogFetchStatus),
        required: true,
      },
      // Denormalised so the processing table needs no joins.
      [DynamoDBItemAttribute.INSTANCE_ID]: { type: 'string', readOnly: true },
      [DynamoDBItemAttribute.CAR_NAME]: { type: 'string', readOnly: true },
      [DynamoDBItemAttribute.EVENT_ID]: { type: CustomAttributeType<ResourceId>('string'), readOnly: true },
      [DynamoDBItemAttribute.EVENT_NAME]: { type: 'string', readOnly: true },
      [DynamoDBItemAttribute.RUN_ID]: { type: CustomAttributeType<ResourceId>('string'), readOnly: true },
      [DynamoDBItemAttribute.LEADERBOARD_ID]: { type: CustomAttributeType<ResourceId>('string'), readOnly: true },
      [DynamoDBItemAttribute.MODEL_ID]: { type: CustomAttributeType<ResourceId>('string'), readOnly: true },
      [DynamoDBItemAttribute.RACER_NAME]: { type: 'string', readOnly: true },
      [DynamoDBItemAttribute.LATER_THAN]: { type: 'string', readOnly: true },
      [DynamoDBItemAttribute.PROFILE_ID]: {
        // Initiating admin/facilitator.
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      // Manual uploads by racers may only add logs of their own models; set to the uploader's profile id.
      [DynamoDBItemAttribute.RESTRICT_TO_PROFILE_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
      },
      [DynamoDBItemAttribute.UPLOAD_KEY]: { type: 'string' },
      [DynamoDBItemAttribute.SSM_COMMAND_ID]: { type: 'string' },
      [DynamoDBItemAttribute.BATCH_JOB_ID]: { type: 'string' },
      [DynamoDBItemAttribute.EXECUTION_ARN]: { type: 'string' },
      [DynamoDBItemAttribute.ERROR_MESSAGE]: { type: 'string' },
      // Set when the job reaches a terminal state.
      [DynamoDBItemAttribute.ENDED_AT]: { type: 'string' },
      // DynamoDB TTL (epoch seconds); job records are operational history and expire on their own.
      [DynamoDBItemAttribute.TTL]: { type: 'number' },
    },
    indexes: {
      byJobId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.CAR_LOG_JOB_ID],
          template: CAR_LOG_JOB_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [DynamoDBItemAttribute.CAR_LOG_JOB_ID],
          template: CAR_LOG_JOB_KEY_TEMPLATE,
          casing: 'none',
        },
      },
      byCreatedAt: {
        index: GlobalSecondaryIndex.GSI1,
        pk: {
          field: DynamoDBItemAttribute.GSI1_PK,
          composite: [],
          template: ResourceType.CAR_LOG_JOBS,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.GSI1_SK,
          composite: [DynamoDBItemAttribute.CREATED_AT],
          template: CREATED_AT_KEY_TEMPLATE,
          casing: 'none',
        },
      },
      byEventId: {
        index: GlobalSecondaryIndex.GSI2,
        pk: {
          field: DynamoDBItemAttribute.GSI2_PK,
          composite: [DynamoDBItemAttribute.EVENT_ID],
          template: CAR_LOG_JOB_EVENT_GSI2_PK_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.GSI2_SK,
          composite: [DynamoDBItemAttribute.CREATED_AT],
          template: CREATED_AT_KEY_TEMPLATE,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type CarLogFetchJobEntity = typeof CarLogFetchJobEntity;
export type CarLogFetchJobItem = EntityItem<CarLogFetchJobEntity>;
