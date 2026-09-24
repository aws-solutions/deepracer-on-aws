// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { METADATA_ATTRIBUTES, DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { LAP_PK_TEMPLATE, LAP_SK_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';

// ---------------------------------------------------------------------------
// Entity definition
//
// PK:  leaderboard_{leaderboardId}#run_{runId}  — all laps for a run
// SK:  lap_{lapNumber}                           — ordered by lap number
//
// Note: lapNumber is stored as a plain integer in DynamoDB. DynamoDB sorts SKs
// lexicographically, so SK order breaks for runs with 10+ laps (lap_10 sorts
// before lap_2). LapDao sorts each returned data set by lapNumber numerically:
// listByRun sorts its bounded page, while listAllLapsByRun sorts the full result.
// Callers that paginate and require globally ordered results must account for the
// numeric ordering across page boundaries.
//
// No GSI: laps are always accessed via their parent run.
// ---------------------------------------------------------------------------

export const LapsEntity = new Entity(
  {
    model: {
      entity: ResourceType.LAP,
      version: '1',
      service: ResourceType.RUN,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.LEADERBOARD_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.RUN_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.LAP_NUMBER]: {
        type: 'number',
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.LAP_TIME_MS]: {
        type: 'number',
        required: true,
      },
      [DynamoDBItemAttribute.DEVICE_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        required: false,
      },
      [DynamoDBItemAttribute.IS_VALID]: {
        type: 'boolean',
        required: true,
        default: true,
      },
      [DynamoDBItemAttribute.RESETS]: {
        type: 'number',
        required: false,
        default: 0,
      },
      // Audit fields — populated only if a lap has been manually edited
      [DynamoDBItemAttribute.ORIGINAL_LAP_TIME_MS]: {
        type: 'number',
        required: false,
      },
      [DynamoDBItemAttribute.EDITED_BY]: {
        type: CustomAttributeType<ResourceId>('string'),
        required: false,
      },
      [DynamoDBItemAttribute.EDITED_AT]: {
        type: 'string',
        required: false,
      },
      [DynamoDBItemAttribute.EDIT_REASON]: {
        type: 'string',
        required: false,
      },
    },
    indexes: {
      byRunId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.LEADERBOARD_ID, DynamoDBItemAttribute.RUN_ID],
          template: LAP_PK_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [DynamoDBItemAttribute.LAP_NUMBER],
          template: LAP_SK_TEMPLATE,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type LapsEntity = typeof LapsEntity;
export type LapItem = EntityItem<LapsEntity>;
