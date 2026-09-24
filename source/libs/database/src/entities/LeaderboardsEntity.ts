// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import {
  LiveEventStatus,
  RaceType,
  TimingMethod,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { GlobalSecondaryIndex, LocalSecondaryIndex } from '../constants/indexes.js';
import {
  DynamoDBItemAttribute,
  METADATA_ATTRIBUTES,
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
      [DynamoDBItemAttribute.IS_LIVE]: {
        type: 'boolean',
        default: false,
      },
      [DynamoDBItemAttribute.LIVE_EVENT_TIME]: {
        type: 'string',
      },
      [DynamoDBItemAttribute.LIVE_EVENT_STATUS]: {
        type: Object.values(LiveEventStatus),
      },
      [DynamoDBItemAttribute.AUTO_LAUNCH_ENABLED]: {
        type: 'boolean',
        default: false,
      },
      [DynamoDBItemAttribute.CURRENT_EXECUTION_ARN]: {
        type: 'string',
        required: false,
      },
      [DynamoDBItemAttribute.WINNER_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        required: false,
      },
      [DynamoDBItemAttribute.WINNER_DECLARED_AT]: {
        type: 'string',
        required: false,
      },
      [DynamoDBItemAttribute.LAST_SF_FAILURE_AT]: {
        type: 'number',
        required: false,
      },
      [DynamoDBItemAttribute.MAX_RESETS]: {
        type: 'number',
        required: false,
      },
      [DynamoDBItemAttribute.SUBMISSION_PERIOD_OPEN]: {
        type: 'boolean',
        default: false,
      },
      // Physical Event Management (v1.3.0) — links this Leaderboard (track) to an Event.
      // All three are optional/null for standalone virtual leaderboards (non-breaking).
      [DynamoDBItemAttribute.EVENT_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: false,
      },
      [DynamoDBItemAttribute.FLEET_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: false,
      },
      [DynamoDBItemAttribute.TRACK_TYPE]: {
        type: Object.values(TrackId),
        readOnly: true,
        required: false,
      },
      [DynamoDBItemAttribute.LEADERBOARD_FOOTER]: {
        type: 'string',
        required: false,
      },
      [DynamoDBItemAttribute.TRACK_ORDER]: {
        type: 'string',
        required: false,
        readOnly: true,
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
      // Sparse GSI — only populated for Leaderboards with an eventId (event tracks).
      // DynamoDB/ElectroDB only omit a GSI entry when BOTH the PK and SK composite
      // attributes are absent from the item, so eventId must be part of the SK
      // composite too (not just PK) — otherwise the always-present leaderboardId
      // would force ElectroDB to write a (sparse-defeating) placeholder key.
      // Supports "list all tracks for an event" (combined-leaderboard aggregation,
      // RemoveTrackFromEvent, DeleteEvent cascade).
      byEventId: {
        index: GlobalSecondaryIndex.GSI1,
        pk: {
          field: DynamoDBItemAttribute.GSI1_PK,
          composite: [DynamoDBItemAttribute.EVENT_ID],
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.GSI1_SK,
          composite: [DynamoDBItemAttribute.TRACK_ORDER],
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type LeaderboardsEntity = typeof LeaderboardsEntity;
export type LeaderboardItem = EntityItem<LeaderboardsEntity>;
