// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { tracer } from '@deepracer-indy/utils';

/**
 * DynamoDB client to be used for all ElectroDB clients/services.
 */
export const dynamoDBClient = tracer.captureAWSv3Client(
  new DynamoDBClient({
    ...(process.env.MOCK_DYNAMODB_ENDPOINT && {
      endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
      region: 'local',
    }),
  }),
);
