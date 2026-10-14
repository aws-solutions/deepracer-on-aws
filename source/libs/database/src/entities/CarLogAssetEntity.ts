// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CarLogAssetType } from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { GlobalSecondaryIndex } from '../constants/indexes.js';
import { DynamoDBItemAttribute, METADATA_ATTRIBUTES } from '../constants/itemAttributes.js';
import {
  CAR_LOG_ASSET_SK_TEMPLATE,
  PROFILE_KEY_TEMPLATE,
  UPLOADED_AT_KEY_TEMPLATE,
} from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';

/**
 * A rosbag or generated video belonging to a racer. `assetId` is the SHA-256 of the S3 key, so
 * re-processing a job upserts the same row instead of duplicating it.
 *
 * Primary key: PK=profile_{profileId}, SK=carlogasset_{assetId} (same partition as the racer's models)
 * GSI1 (all assets, newest first): PK=carlogassets, SK=uploadedAt_{uploadedAt}
 */
export const CarLogAssetEntity = new Entity(
  {
    model: {
      entity: ResourceType.CAR_LOG_ASSET,
      version: '1',
      service: ResourceType.CAR_LOG_ASSETS,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.PROFILE_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.CAR_LOG_ASSET_ID]: {
        type: 'string',
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.CAR_LOG_ASSET_TYPE]: {
        type: Object.values(CarLogAssetType),
        required: true,
      },
      // Object key (VIDEO) or key prefix (bags) in the device logs bucket. Never returned by the API.
      [DynamoDBItemAttribute.S3_KEY]: { type: 'string', required: true },
      [DynamoDBItemAttribute.FILENAME]: { type: 'string', required: true },
      [DynamoDBItemAttribute.UPLOADED_AT]: { type: 'string', required: true },
      [DynamoDBItemAttribute.RACER_NAME]: { type: 'string' },
      [DynamoDBItemAttribute.MODELS]: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            [DynamoDBItemAttribute.MODEL_ID]: { type: 'string', required: true },
            [DynamoDBItemAttribute.MODEL_NAME]: { type: 'string' },
          },
        },
      },
      [DynamoDBItemAttribute.EVENT_ID]: { type: CustomAttributeType<ResourceId>('string') },
      [DynamoDBItemAttribute.EVENT_NAME]: { type: 'string' },
      [DynamoDBItemAttribute.FETCH_JOB_ID]: { type: CustomAttributeType<ResourceId>('string') },
      [DynamoDBItemAttribute.CAR_NAME]: { type: 'string' },
      [DynamoDBItemAttribute.MEDIA_METADATA]: {
        type: 'map',
        properties: {
          durationSeconds: { type: 'number' },
          codec: { type: 'string' },
          fps: { type: 'number' },
          resolution: { type: 'string' },
        },
      },
      // DynamoDB TTL (epoch seconds); set to match the bucket's object expiry.
      [DynamoDBItemAttribute.TTL]: { type: 'number' },
    },
    indexes: {
      byProfileId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.PROFILE_ID],
          template: PROFILE_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [DynamoDBItemAttribute.CAR_LOG_ASSET_ID],
          template: CAR_LOG_ASSET_SK_TEMPLATE,
          casing: 'none',
        },
      },
      byUploadedAt: {
        index: GlobalSecondaryIndex.GSI1,
        pk: {
          field: DynamoDBItemAttribute.GSI1_PK,
          composite: [],
          template: ResourceType.CAR_LOG_ASSETS,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.GSI1_SK,
          composite: [DynamoDBItemAttribute.UPLOADED_AT],
          template: UPLOADED_AT_KEY_TEMPLATE,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type CarLogAssetEntity = typeof CarLogAssetEntity;
export type CarLogAssetItem = EntityItem<CarLogAssetEntity>;
