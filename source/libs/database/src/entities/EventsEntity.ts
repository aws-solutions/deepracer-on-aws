// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CombinedScoringStrategy, EventStatus, EventType, RaceFormat } from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { METADATA_ATTRIBUTES, DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { EVENT_KEY_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { generateResourceId } from '../utils/resourceUtils.js';

// ---------------------------------------------------------------------------
// Entity definition
// PK: events  (ResourceType.EVENTS)
// SK: event#{eventId}  (EVENT_KEY_TEMPLATE)
// ---------------------------------------------------------------------------

export const EventsEntity = new Entity(
  {
    model: {
      entity: ResourceType.EVENT,
      version: '1',
      service: ResourceType.EVENT,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.EVENT_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        default: () => generateResourceId(),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.CREATED_BY]: {
        type: 'string',
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.NAME]: {
        type: 'string',
        required: true,
      },
      [DynamoDBItemAttribute.EVENT_TYPE]: {
        type: Object.values(EventType),
        required: true,
      },
      [DynamoDBItemAttribute.EVENT_STATUS]: {
        type: Object.values(EventStatus),
        required: true,
        default: EventStatus.DRAFT,
      },
      [DynamoDBItemAttribute.EVENT_DATE]: {
        type: 'string',
        required: true,
      },
      [DynamoDBItemAttribute.COUNTRY_CODE]: {
        type: 'string',
        required: true,
      },
      [DynamoDBItemAttribute.SPONSOR]: {
        type: 'string',
        required: false,
      },
      [DynamoDBItemAttribute.RACE_FORMAT]: {
        type: Object.values(RaceFormat),
        required: true,
      },
      [DynamoDBItemAttribute.COMBINED_SCORING_STRATEGY]: {
        type: Object.values(CombinedScoringStrategy),
        required: false,
      },
      [DynamoDBItemAttribute.COMBINED_LEADERBOARD_HEADER]: {
        type: 'string',
        required: false,
      },
      [DynamoDBItemAttribute.COMBINED_LEADERBOARD_FOOTER]: {
        type: 'string',
        required: false,
      },
      [DynamoDBItemAttribute.MAX_LAPS]: {
        type: 'number',
        required: true,
      },
      [DynamoDBItemAttribute.MAX_TIME_IN_MINUTES]: {
        type: 'number',
        required: true,
      },
      [DynamoDBItemAttribute.MAX_RUNS_PER_RACER]: {
        type: 'number',
        // Optional: absence means unlimited runs per racer (see createRun.ts enforcement).
        required: false,
      },
      [DynamoDBItemAttribute.MAX_RESETS]: {
        type: 'number',
        required: true,
      },
      [DynamoDBItemAttribute.AVERAGE_LAPS_WINDOW]: {
        type: 'number',
        // Optional: only meaningful when raceFormat is AVERAGE_LAPS (see computeScoreFromLaps).
        required: false,
      },
    },
    indexes: {
      byEventId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [],
          template: ResourceType.EVENTS,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [DynamoDBItemAttribute.EVENT_ID],
          template: EVENT_KEY_TEMPLATE,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type EventsEntity = typeof EventsEntity;
export type EventItem = EntityItem<EventsEntity>;
