// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { dynamoDBClient } from './src/utils/dynamoDBClient.js';

vi.mock('../config/src/configs/dynamoDBConfig.js', async () => ({
  ...(await vi.importActual('../config/src/configs/dynamoDBConfig.js')),
  deepRacerIndyDynamoDBConfig: {
    ...(
      await vi.importActual<typeof import('../config/src/configs/dynamoDBConfig.js')>(
        '../config/src/configs/dynamoDBConfig.js',
      )
    ).deepRacerIndyDynamoDBConfig,
    tableName: 'TestTable',
  },
}));

afterAll(() => {
  dynamoDBClient.destroy();
});
