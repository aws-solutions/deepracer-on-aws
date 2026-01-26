// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { dynamoDBDefaults } from '#defaults/dynamoDBDefaults.js';
import type { DeepRacerIndyDynamoDBConfig } from '#types/dynamoDBConfig.js';

/**
 * DeepRacerIndy DynamoDB config.
 */
export const deepRacerIndyDynamoDBConfig = {
  tableName: dynamoDBDefaults.tableName,
  resourceIdLength: dynamoDBDefaults.resourceIdLength,
} as const satisfies DeepRacerIndyDynamoDBConfig;
