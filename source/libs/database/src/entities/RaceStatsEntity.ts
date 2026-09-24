// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { Entity, EntityItem } from 'electrodb';

import { METADATA_ATTRIBUTES, DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { RACESTATS_GLOBAL_SK } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';

// ---------------------------------------------------------------------------
// Entity definition
// PK: 'racestats'  (ResourceType.RACESTATS)
// SK: 'GLOBAL'  or  'EVENT#{eventId}'
// ---------------------------------------------------------------------------

export const RaceStatsEntity = new Entity(
  {
    model: {
      entity: ResourceType.RACESTATS,
      version: '1',
      service: ResourceType.RACESTATS,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.TOTAL_EVENTS]: {
        type: 'number',
        required: true,
        default: 0,
      },
      [DynamoDBItemAttribute.TOTAL_RACERS]: {
        type: 'number',
        required: true,
        default: 0,
      },
      [DynamoDBItemAttribute.TOTAL_LAPS]: {
        type: 'number',
        required: true,
        default: 0,
      },
      [DynamoDBItemAttribute.TOTAL_VALID_LAPS]: {
        type: 'number',
        required: true,
        default: 0,
      },
      [DynamoDBItemAttribute.TOTAL_RACES]: {
        type: 'number',
        required: true,
        default: 0,
      },
      [DynamoDBItemAttribute.SUM_VALID_LAP_TIME_MS]: {
        type: 'number',
        required: true,
        default: 0,
      },
      [DynamoDBItemAttribute.FASTEST_LAPS_EVER]: {
        type: 'list',
        required: true,
        default: () => [],
        items: {
          type: 'map',
          properties: {
            participantName: { type: 'string', required: true },
            lapTimeMilliseconds: { type: 'number', required: true },
            eventId: { type: 'string', required: true },
            eventName: { type: 'string' },
          },
        },
      },
      [DynamoDBItemAttribute.TOTAL_COUNTRIES]: {
        type: 'number',
        required: true,
        default: 0,
      },
      [DynamoDBItemAttribute.EVENTS_BY_COUNTRY]: {
        type: 'list',
        required: true,
        default: () => [],
        items: {
          type: 'map',
          properties: {
            countryCode: { type: 'string', required: true },
            events: { type: 'number', required: true },
            races: { type: 'number', required: true },
            laps: { type: 'number', required: true },
          },
        },
      },
      [DynamoDBItemAttribute.EVENTS_BY_MONTH]: {
        type: 'list',
        required: true,
        default: () => [],
        items: {
          type: 'map',
          properties: {
            month: { type: 'string', required: true },
            events: { type: 'number', required: true },
            races: { type: 'number', required: true },
            laps: { type: 'number', required: true },
          },
        },
      },
      [DynamoDBItemAttribute.EVENT_TYPE_BREAKDOWN]: {
        type: 'list',
        required: true,
        default: () => [],
        items: {
          type: 'map',
          properties: {
            typeOfEvent: { type: 'string', required: true },
            count: { type: 'number', required: true },
          },
        },
      },
    },
    indexes: {
      // Global aggregate: PK='racestats', SK='GLOBAL'
      global: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [],
          template: ResourceType.RACESTATS,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [],
          template: RACESTATS_GLOBAL_SK,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type RaceStatsEntity = typeof RaceStatsEntity;
export type RaceStatsItem = EntityItem<RaceStatsEntity>;
