// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DeepRacerIndyDynamoDBConfig } from '#types/dynamoDBConfig.js';
import type { DeepRacerIndySageMakerConfig } from '#types/sageMakerConfig.js';
import type { DeepRacerIndyUserPoolConfig } from '#types/userPoolConfig.js';

export interface DeepRacerIndyAppConfig {
  dynamoDB: DeepRacerIndyDynamoDBConfig;
  sageMaker: DeepRacerIndySageMakerConfig;
  userPool: DeepRacerIndyUserPoolConfig;
}
