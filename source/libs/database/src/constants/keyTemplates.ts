// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * ElectroDB Partition key and sort key templates.
 */

import { DynamoDBItemAttribute } from './itemAttributes.js';
import { ResourceType } from './resourceTypes.js';

export const EVALUATION_KEY_TEMPLATE = `${ResourceType.EVALUATION}_\${${DynamoDBItemAttribute.EVALUATION_ID}}`;
// Run: SK under a leaderboard partition — runId only (leaderboardId is already the PK)
// SK: run_{runId}
export const RUN_SK_TEMPLATE = `${ResourceType.RUN}_\${${DynamoDBItemAttribute.RUN_ID}}`;
// Run GSI1: PK = event_{eventId}#profile_{profileId} for "runs by racer in event"
export const RUN_GSI1_PK_TEMPLATE = `${ResourceType.EVENT}_\${${DynamoDBItemAttribute.EVENT_ID}}#${ResourceType.PROFILE}_\${${DynamoDBItemAttribute.PROFILE_ID}}`;
// Run GSI2: PK = event_{eventId} for "all runs in an event" (statistics, cascade delete)
export const RUN_GSI2_PK_TEMPLATE = `${ResourceType.EVENT}_\${${DynamoDBItemAttribute.EVENT_ID}}`;
// Lap: PK = leaderboard_{leaderboardId}#run_{runId}, SK = lap_{lapNumber}
export const LAP_PK_TEMPLATE = `${ResourceType.LEADERBOARD}_\${${DynamoDBItemAttribute.LEADERBOARD_ID}}#${ResourceType.RUN}_\${${DynamoDBItemAttribute.RUN_ID}}`;
export const LAP_SK_TEMPLATE = `${ResourceType.LAP}_\${${DynamoDBItemAttribute.LAP_NUMBER}}`;
// Lap idempotency token: shares the lap PK (leaderboard_{lb}#run_{runId}); SK = laptoken_{clientToken}
export const LAP_TOKEN_SK_TEMPLATE = `${ResourceType.LAP_TOKEN}_\${${DynamoDBItemAttribute.CLIENT_TOKEN}}`;
export const LEADERBOARD_KEY_TEMPLATE = `${ResourceType.LEADERBOARD}_\${${DynamoDBItemAttribute.LEADERBOARD_ID}}`;
export const MODEL_KEY_TEMPLATE = `${ResourceType.MODEL}_\${${DynamoDBItemAttribute.MODEL_ID}}`;
export const PROFILE_KEY_TEMPLATE = `${ResourceType.PROFILE}_\${${DynamoDBItemAttribute.PROFILE_ID}}`;
export const RANKING_KEY_TEMPLATE = `${PROFILE_KEY_TEMPLATE}#${ResourceType.RANKING}`;
export const CREATED_AT_KEY_TEMPLATE = `${DynamoDBItemAttribute.CREATED_AT}_\${${DynamoDBItemAttribute.CREATED_AT}}`;
export const SUBMISSION_KEY_TEMPLATE = `${LEADERBOARD_KEY_TEMPLATE}#${ResourceType.SUBMISSION}_\${${DynamoDBItemAttribute.SUBMISSION_ID}}`;
export const SUBMISSION_GSI1_KEY_TEMPLATE = `${PROFILE_KEY_TEMPLATE}#${LEADERBOARD_KEY_TEMPLATE}#${ResourceType.SUBMISSION}`;
export const LIVE_QUEUE_ITEM_PK_TEMPLATE = `${LEADERBOARD_KEY_TEMPLATE}#${ResourceType.LIVE_QUEUE_ITEM}`;
export const LIVE_QUEUE_ITEM_SK_TEMPLATE = `${ResourceType.SUBMISSION}_\${${DynamoDBItemAttribute.SUBMISSION_ID}}`;
export const ACCOUNT_RESOURCE_USAGE_KEY_TEMPLATE = `${ResourceType.ACCOUNT_RESOURCE_USAGE}_\${${DynamoDBItemAttribute.ACCOUNT_RESOURCE_USAGE_YEAR}}#\${${DynamoDBItemAttribute.ACCOUNT_RESOURCE_USAGE_MONTH}}`;

// Race Manager
export const DEVICE_KEY_TEMPLATE = `${ResourceType.DEVICE}#\${${DynamoDBItemAttribute.INSTANCE_ID}}`;
export const FLEET_KEY_TEMPLATE = `${ResourceType.FLEET}#\${${DynamoDBItemAttribute.FLEET_ID}}`;
export const EVENT_KEY_TEMPLATE = `${ResourceType.EVENT}#\${${DynamoDBItemAttribute.EVENT_ID}}`;
export const DEPLOYMENT_SK_TEMPLATE = `${ResourceType.DEPLOYMENT}_\${${DynamoDBItemAttribute.DEPLOYMENT_ID}}`;
export const DEPLOYMENT_GSI1_PK_TEMPLATE = `${ResourceType.BATCH}_\${${DynamoDBItemAttribute.BATCH_ID}}`;
export const DEPLOYMENT_GSI2_PK_TEMPLATE = `${ResourceType.EVENT}_\${${DynamoDBItemAttribute.EVENT_ID}}`;

// Car logs
export const CAR_LOG_JOB_KEY_TEMPLATE = `${ResourceType.CAR_LOG_JOB}_\${${DynamoDBItemAttribute.CAR_LOG_JOB_ID}}`;
export const CAR_LOG_JOB_EVENT_GSI2_PK_TEMPLATE = `${ResourceType.CAR_LOG_JOB}#${ResourceType.EVENT}_\${${DynamoDBItemAttribute.EVENT_ID}}`;
/** Assets live in the owning profile's partition, next to models. */
export const CAR_LOG_ASSET_SK_TEMPLATE = `${ResourceType.CAR_LOG_ASSET}_\${${DynamoDBItemAttribute.CAR_LOG_ASSET_ID}}`;
export const UPLOADED_AT_KEY_TEMPLATE = `${DynamoDBItemAttribute.UPLOADED_AT}_\${${DynamoDBItemAttribute.UPLOADED_AT}}`;

// RaceStats: PK = 'racestats', SK = 'GLOBAL' (aggregate) or 'event#{eventId}' (per-event)
export const RACESTATS_GLOBAL_SK = 'GLOBAL';
export const RACESTATS_EVENT_SK_TEMPLATE = `${ResourceType.EVENT}#\${${DynamoDBItemAttribute.EVENT_ID}}`;

// RaceStats: PK = 'racestats', SK = 'GLOBAL' (aggregate) or 'EVENT#{eventId}' (per-event)

export const BULK_INVITE_JOB_PK_TEMPLATE = `${ResourceType.PROFILE}_\${${DynamoDBItemAttribute.ADMIN_PROFILE_ID}}`;
export const BULK_INVITE_JOB_SK_TEMPLATE = `${ResourceType.BULK_INVITE_JOB}_\${${DynamoDBItemAttribute.BULK_INVITE_JOB_ID}}`;
export const BULK_INVITE_JOB_TOKEN_SK_TEMPLATE = `${ResourceType.BULK_INVITE_JOB_TOKEN}_\${${DynamoDBItemAttribute.CLIENT_TOKEN}}`;
