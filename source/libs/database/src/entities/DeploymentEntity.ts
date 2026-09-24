// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { DeploymentStatus } from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { GlobalSecondaryIndex } from '../constants/indexes.js';
import { METADATA_ATTRIBUTES, DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import {
  DEPLOYMENT_SK_TEMPLATE,
  DEPLOYMENT_GSI1_PK_TEMPLATE,
  DEPLOYMENT_GSI2_PK_TEMPLATE,
  CREATED_AT_KEY_TEMPLATE,
  MODEL_KEY_TEMPLATE,
} from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { generateResourceId } from '../utils/resourceUtils.js';

/**
 * Tracks individual model-to-car push operations.
 *
 * Primary key: PK=MODEL_{modelId}, SK=DEPLOYMENT_{deploymentId}
 *   → Direct lookup by modelId+deploymentId; range query for all deployments of a model.
 *
 * GSI1 (DeploymentsByBatch): PK=BATCH_{batchId}, SK=CREATED_AT_{createdAt}
 *   → ListDeploymentsByBatch — shows status of a batch push operation.
 *
 * GSI2 (DeploymentsByEvent): PK=EVENT_{eventId}, SK=CREATED_AT_{createdAt}
 *   → ListDeploymentsByEvent — upload status page for an entire event.
 *   Reuses the same physical GSI2 index as DeviceEntity (DevicesByFleet).
 */
export const DeploymentEntity = new Entity(
  {
    model: {
      entity: ResourceType.DEPLOYMENT,
      version: '1',
      service: ResourceType.MODEL,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.DEPLOYMENT_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        default: () => generateResourceId(),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.MODEL_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.PROFILE_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.BATCH_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
      },
      [DynamoDBItemAttribute.EVENT_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
      },
      [DynamoDBItemAttribute.CAR_INSTANCE_ID]: {
        type: 'string',
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.STATUS]: {
        type: Object.values(DeploymentStatus),
        required: true,
      },
      // Denormalized for query efficiency (avoids client-side joins on upload status page)
      [DynamoDBItemAttribute.MODEL_NAME]: {
        type: 'string',
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.CAR_NAME]: {
        type: 'string',
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.FLEET_ID]: {
        // Nullable — car may not be assigned to a fleet at deploy time.
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
      },
      [DynamoDBItemAttribute.ERROR_MESSAGE]: {
        type: 'string',
      },
      [DynamoDBItemAttribute.UPLOAD_STARTED_AT]: {
        type: 'string',
      },
      [DynamoDBItemAttribute.COMPLETED_AT]: {
        type: 'string',
      },
    },
    indexes: {
      byModelId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.MODEL_ID],
          template: MODEL_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [DynamoDBItemAttribute.DEPLOYMENT_ID],
          template: DEPLOYMENT_SK_TEMPLATE,
          casing: 'none',
        },
      },
      byBatchId: {
        index: GlobalSecondaryIndex.GSI1,
        pk: {
          field: DynamoDBItemAttribute.GSI1_PK,
          composite: [DynamoDBItemAttribute.BATCH_ID],
          template: DEPLOYMENT_GSI1_PK_TEMPLATE,
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
          template: DEPLOYMENT_GSI2_PK_TEMPLATE,
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

export type DeploymentEntity = typeof DeploymentEntity;
export type DeploymentItem = EntityItem<DeploymentEntity>;
