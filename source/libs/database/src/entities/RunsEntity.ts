// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { RunStatus } from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { GlobalSecondaryIndex } from '../constants/indexes.js';
import { METADATA_ATTRIBUTES, DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import {
  LEADERBOARD_KEY_TEMPLATE,
  RUN_SK_TEMPLATE,
  RUN_GSI1_PK_TEMPLATE,
  RUN_GSI2_PK_TEMPLATE,
  CREATED_AT_KEY_TEMPLATE,
} from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { generateResourceId } from '../utils/resourceUtils.js';

// ---------------------------------------------------------------------------
// Entity definition
//
// PK:  leaderboard_{leaderboardId}   — all runs for a leaderboard (shared partition)
// SK:  run_{runId}                   — uniquely identifies this run within the partition
//
// Note: leaderboardId appears only in the PK composite. ElectroDB prohibits the same
// attribute in both PK and SK composites on the same index, so the SK uses run_{runId}
// only rather than a compound leaderboard_{leaderboardId}#run_{runId}.
//
// GSI1 (byRacerInEvent):
//   PK: event_{eventId}#profile_{profileId} — runs by a racer across a whole event
//   SK: createdAt_{createdAt}               — sorted chronologically
//
// GSI2 (byEventId):
//   PK: event_{eventId}       — all runs in an event, regardless of racer or track
//   SK: createdAt_{createdAt} — sorted chronologically
//   Used by event statistics aggregation and (future) cascade delete traversal.
// ---------------------------------------------------------------------------

export const RunsEntity = new Entity(
  {
    model: {
      entity: ResourceType.RUN,
      version: '1',
      service: ResourceType.RUN,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.RUN_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        default: () => generateResourceId(),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.LEADERBOARD_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.EVENT_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.PROFILE_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.RUN_STATUS]: {
        type: Object.values(RunStatus),
        required: true,
        default: RunStatus.READY,
      },
      [DynamoDBItemAttribute.RACED_BY_PROXY]: {
        type: 'boolean',
        required: false,
        default: false,
      },
      [DynamoDBItemAttribute.LAP_COUNT]: {
        type: 'number',
        required: false,
        default: 0,
      },
      // Set by the SUBMITTED transition (runLifecycleFunction) once a Submission is created for
      // this run. Lets lap edit/validity cascades (recalculateScoreIfSubmitted) resolve the exact
      // Submission tied to this run, rather than guessing via "most recently created submission
      // for this racer on this leaderboard" — which is wrong when a racer has multiple runs.
      [DynamoDBItemAttribute.SUBMISSION_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        required: false,
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
          composite: [DynamoDBItemAttribute.RUN_ID],
          template: RUN_SK_TEMPLATE,
          casing: 'none',
        },
      },
      byRacerInEvent: {
        index: GlobalSecondaryIndex.GSI1,
        pk: {
          field: DynamoDBItemAttribute.GSI1_PK,
          composite: [DynamoDBItemAttribute.EVENT_ID, DynamoDBItemAttribute.PROFILE_ID],
          template: RUN_GSI1_PK_TEMPLATE,
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
          template: RUN_GSI2_PK_TEMPLATE,
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

export type RunsEntity = typeof RunsEntity;
export type RunItem = EntityItem<RunsEntity>;
