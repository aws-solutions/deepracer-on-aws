// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyDynamoDBConfig } from '#configs/dynamoDBConfig.js';
import { deepRacerIndySageMakerConfig } from '#configs/sageMakerConfig.js';
import { deepRacerIndyUserPoolConfig } from '#configs/userPoolConfig.js';
import type { DeepRacerIndyAppConfig } from '#types/appConfig.js';

export const deepRacerIndyAppConfig = {
  dynamoDB: deepRacerIndyDynamoDBConfig,
  sageMaker: deepRacerIndySageMakerConfig,
  userPool: deepRacerIndyUserPoolConfig,
} as const satisfies DeepRacerIndyAppConfig;
