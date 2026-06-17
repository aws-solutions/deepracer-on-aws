// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { LiveQueueItemStatus } from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { DynamoDBItemAttribute, METADATA_ATTRIBUTES } from '#constants/itemAttributes.js';
import { LIVE_QUEUE_ITEM_PK_TEMPLATE, LIVE_QUEUE_ITEM_SK_TEMPLATE } from '#constants/keyTemplates.js';
import { ResourceType } from '#constants/resourceTypes.js';
import { ResourceId } from '#types/resource.js';
import { dynamoDBClient } from '#utils/dynamoDBClient.js';

export const LiveQueueItemEntity = new Entity(
  {
    model: {
      entity: ResourceType.LIVE_QUEUE_ITEM,
      version: '1',
      service: ResourceType.LEADERBOARD,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.LEADERBOARD_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.SUBMISSION_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.QUEUE_POSITION]: {
        type: 'string',
        required: true,
      },
      [DynamoDBItemAttribute.PROFILE_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.MODEL_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.MODEL_NAME]: {
        type: 'string',
        required: true,
        readOnly: true,
      },
      [DynamoDBItemAttribute.PARTICIPANT_NAME]: {
        type: 'string',
        required: true,
        readOnly: true,
      },
      [DynamoDBItemAttribute.STATUS]: {
        type: Object.values(LiveQueueItemStatus),
        required: true,
      },
      [DynamoDBItemAttribute.RESET_COUNT]: {
        type: 'number',
        required: true,
      },
      [DynamoDBItemAttribute.SUBMITTED_AT]: {
        type: 'string',
        required: true,
      },
      [DynamoDBItemAttribute.LAST_TRIGGERED_AT]: {
        type: 'number',
      },
    },
    indexes: {
      byLeaderboardId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.LEADERBOARD_ID],
          template: LIVE_QUEUE_ITEM_PK_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [DynamoDBItemAttribute.SUBMISSION_ID],
          template: LIVE_QUEUE_ITEM_SK_TEMPLATE,
          casing: 'none',
        },
      },
    },
  },
  {
    client: dynamoDBClient,
    table: deepRacerIndyAppConfig.dynamoDB.tableName,
  },
);

export type LiveQueueItemEntity = typeof LiveQueueItemEntity;
export type LiveQueueItem = EntityItem<LiveQueueItemEntity>;
