// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { METADATA_ATTRIBUTES, DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { LAP_PK_TEMPLATE, LAP_TOKEN_SK_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';

// ---------------------------------------------------------------------------
// Idempotency-token guard for CreateLap.
//
// Shares the lap PK (leaderboard_{leaderboardId}#run_{runId}) so the guard item
// lives in the same item collection as the laps it protects.
// SK: laptoken_{clientToken}
//
// LapDao.createNextLap creates this item inside the same DynamoDB transaction as
// the lap, conditioned on the SK not already existing. A replayed CreateLap (same
// clientToken) fails that condition → the whole transaction cancels → callers see
// a ConflictError and reconcile against the already-persisted lap. This is bounded
// deduplication (retry protection), not exactly-once mutation.
//
// The item carries `ttl` (epoch seconds); the table's TTL is configured on that
// attribute (see storage/dynamoDB.ts). TTL is best-effort garbage collection —
// correctness comes from the conditional write, not physical row deletion. Only
// items that set `ttl` are ever expired, so laps (which do not) are never removed.
// ---------------------------------------------------------------------------

export const LapTokenEntity = new Entity(
  {
    model: {
      entity: ResourceType.LAP_TOKEN,
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
      [DynamoDBItemAttribute.CLIENT_TOKEN]: {
        type: 'string',
        readOnly: true,
        required: true,
      },
      // The lap number this token created, retained for debugging/audit.
      [DynamoDBItemAttribute.LAP_NUMBER]: {
        type: 'number',
        readOnly: true,
        required: true,
      },
      // Epoch seconds; table TTL attribute. Self-expires the guard once no retry is possible.
      [DynamoDBItemAttribute.TTL]: {
        type: 'number',
        required: true,
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
          composite: [DynamoDBItemAttribute.CLIENT_TOKEN],
          template: LAP_TOKEN_SK_TEMPLATE,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type LapTokenEntity = typeof LapTokenEntity;
export type LapTokenItem = EntityItem<LapTokenEntity>;
