// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DeepRacerIndyDynamoDBConfig } from '#types/dynamoDBConfig.js';

import { DEFAULT_NAMESPACE } from './commonDefaults.js';

export const BASE_TABLE_NAME = 'DeepRacerIndy.Main';

const namespace = (typeof process !== 'undefined' && process.env?.NAMESPACE) || DEFAULT_NAMESPACE;

export const dynamoDBDefaults = {
  tableName: `${namespace}-${BASE_TABLE_NAME}`,
  resourceIdLength: 15,
} as const satisfies DeepRacerIndyDynamoDBConfig;
