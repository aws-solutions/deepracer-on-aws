// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * ElectroDB Partition key and sort key templates.
 */

import { DynamoDBItemAttribute } from './itemAttributes.js';
import { ResourceType } from './resourceTypes.js';

export const EVALUATION_KEY_TEMPLATE = `${ResourceType.EVALUATION}_\${${DynamoDBItemAttribute.EVALUATION_ID}}`;
export const LEADERBOARD_KEY_TEMPLATE = `${ResourceType.LEADERBOARD}_\${${DynamoDBItemAttribute.LEADERBOARD_ID}}`;
export const MODEL_KEY_TEMPLATE = `${ResourceType.MODEL}_\${${DynamoDBItemAttribute.MODEL_ID}}`;
export const PROFILE_KEY_TEMPLATE = `${ResourceType.PROFILE}_\${${DynamoDBItemAttribute.PROFILE_ID}}`;
export const RANKING_KEY_TEMPLATE = `${PROFILE_KEY_TEMPLATE}#${ResourceType.RANKING}`;
export const CREATED_AT_KEY_TEMPLATE = `${DynamoDBItemAttribute.CREATED_AT}_\${${DynamoDBItemAttribute.CREATED_AT}}`;
export const SUBMISSION_KEY_TEMPLATE = `${LEADERBOARD_KEY_TEMPLATE}#${ResourceType.SUBMISSION}_\${${DynamoDBItemAttribute.SUBMISSION_ID}}`;
export const SUBMISSION_GSI1_KEY_TEMPLATE = `${PROFILE_KEY_TEMPLATE}#${LEADERBOARD_KEY_TEMPLATE}#${ResourceType.SUBMISSION}`;
export const ACCOUNT_RESOURCE_USAGE_KEY_TEMPLATE = `${ResourceType.ACCOUNT_RESOURCE_USAGE}_\${${DynamoDBItemAttribute.ACCOUNT_RESOURCE_USAGE_YEAR}}#\${${DynamoDBItemAttribute.ACCOUNT_RESOURCE_USAGE_MONTH}}`;
