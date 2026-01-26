// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { RaceType, TimingMethod, TrackDirection, TrackId } from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { LocalSecondaryIndex } from '../constants/indexes.js';
import {
  METADATA_ATTRIBUTES,
  DynamoDBItemAttribute,
  OBJECT_AVOIDANCE_CONFIG_ATTRIBUTE,
  RESETTING_BEHAVIOR_CONFIG_ATTRIBUTE,
} from '../constants/itemAttributes.js';
import { LEADERBOARD_KEY_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { generateResourceId } from '../utils/resourceUtils.js';

export const LeaderboardsEntity = new Entity(
  {
    model: {
      entity: ResourceType.LEADERBOARD,
      version: '1',
      service: ResourceType.LEADERBOARD,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.LEADERBOARD_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        default: () => generateResourceId(),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.CLOSE_TIME]: {
        type: 'string',
        required: true,
      },
      [DynamoDBItemAttribute.OPEN_TIME]: {
        type: 'string',
        required: true,
      },
      [DynamoDBItemAttribute.MINIMUM_LAPS]: {
        type: 'number',
        required: true,
        default: 0,
      },
      [DynamoDBItemAttribute.NAME]: {
        type: 'string',
        required: true,
      },
      [DynamoDBItemAttribute.OBJECT_AVOIDANCE_CONFIG]: OBJECT_AVOIDANCE_CONFIG_ATTRIBUTE,
      [DynamoDBItemAttribute.PARTICIPANT_COUNT]: {
        type: 'number',
        required: true,
        default: 0,
      },
      [DynamoDBItemAttribute.RACE_TYPE]: {
        type: Object.values(RaceType),
        required: true,
      },
      [DynamoDBItemAttribute.RESETTING_BEHAVIOR_CONFIG]: RESETTING_BEHAVIOR_CONFIG_ATTRIBUTE,
      [DynamoDBItemAttribute.MAX_SUBMISSIONS_PER_USER]: {
        type: 'number',
        required: true,
      },
      [DynamoDBItemAttribute.SUBMISSION_TERMINATION_CONDITIONS]: {
        type: 'map',
        required: true,
        properties: {
          [DynamoDBItemAttribute.MAX_LAPS]: {
            type: 'number',
            required: true,
          },
          [DynamoDBItemAttribute.MAX_TIME_IN_MINUTES]: {
            type: 'number',
          },
        },
      },
      [DynamoDBItemAttribute.SUBMITTED_PROFILES]: {
        type: 'set',
        items: 'string',
      },
      [DynamoDBItemAttribute.TIMING_METHOD]: {
        type: Object.values(TimingMethod),
        required: true,
      },
      [DynamoDBItemAttribute.TRACK_CONFIG]: {
        type: 'map',
        required: true,
        properties: {
          [DynamoDBItemAttribute.TRACK_ID]: {
            type: Object.values(TrackId),
            required: true,
          },
          [DynamoDBItemAttribute.TRACK_DIRECTION]: {
            type: Object.values(TrackDirection),
            required: true,
          },
        },
      },
    },
    indexes: {
      byLeaderboardId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [],
          template: ResourceType.LEADERBOARDS,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [DynamoDBItemAttribute.LEADERBOARD_ID],
          template: LEADERBOARD_KEY_TEMPLATE,
          casing: 'none',
        },
      },
      sortedByCloseTime: {
        index: LocalSecondaryIndex.CLOSE_TIME,
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [],
          template: ResourceType.LEADERBOARDS,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.CLOSE_TIME,
          composite: [DynamoDBItemAttribute.CLOSE_TIME],
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type LeaderboardsEntity = typeof LeaderboardsEntity;
export type LeaderboardItem = EntityItem<LeaderboardsEntity>;
