// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { LocalSecondaryIndex } from '../constants/indexes.js';
import {
  METADATA_ATTRIBUTES,
  DynamoDBItemAttribute,
  AVATAR_ATTRIBUTE,
  getSubmissionAndRankingSharedAttributes,
} from '../constants/itemAttributes.js';
import { LEADERBOARD_KEY_TEMPLATE, RANKING_KEY_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';

export const RankingsEntity = new Entity(
  {
    model: {
      entity: ResourceType.RANKING,
      version: '1',
      service: ResourceType.LEADERBOARD,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      ...getSubmissionAndRankingSharedAttributes(true),
      [DynamoDBItemAttribute.MODEL_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        required: true,
      },
      [DynamoDBItemAttribute.PROFILE_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        required: true,
        readOnly: true,
      },
      [DynamoDBItemAttribute.SUBMISSION_VIDEO_S3_LOCATION]: {
        type: 'string',
        required: true,
      },
      [DynamoDBItemAttribute.USER_PROFILE]: {
        type: 'map',
        required: true,
        properties: {
          [DynamoDBItemAttribute.ALIAS]: {
            type: 'string',
            required: true,
          },
          [DynamoDBItemAttribute.AVATAR]: AVATAR_ATTRIBUTE,
        },
      },
    },
    indexes: {
      byLeaderboardId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.LEADERBOARD_ID],
          template: LEADERBOARD_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [DynamoDBItemAttribute.PROFILE_ID],
          template: RANKING_KEY_TEMPLATE,
          casing: 'none',
        },
      },
      sortedByRank: {
        index: LocalSecondaryIndex.RANKING_SCORE,
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.LEADERBOARD_ID],
          template: LEADERBOARD_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.RANKING_SCORE,
          composite: [DynamoDBItemAttribute.RANKING_SCORE],
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type RankingsEntity = typeof RankingsEntity;
export type RankingItem = EntityItem<RankingsEntity>;
