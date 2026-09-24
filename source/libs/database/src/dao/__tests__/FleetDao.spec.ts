// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RESOURCE_ID_REGEX } from '../../constants/regex.js';
import { TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';
import { fleetDao } from '../FleetDao.js';

describe('FleetDao', () => {
  beforeEach(async () => {
    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
    if (Items?.length) {
      await Promise.all(
        Items.map((item) =>
          testDynamoDBDocumentClient.delete({ TableName: TEST_TABLE_NAME, Key: { pk: item.pk, sk: item.sk } }),
        ),
      );
    }
  });

  it('should create a fleet with a generated id and self partition key', async () => {
    const fleet = await fleetDao.create({ name: 'London' });

    expect(fleet.fleetId).toMatch(RESOURCE_ID_REGEX);

    const stored = await fleetDao.load({ fleetId: fleet.fleetId });
    expect(stored).toMatchObject({ name: 'London' });
  });

  it('should list all fleets via scan', async () => {
    await Promise.all([
      fleetDao.create({ name: 'London' }),
      fleetDao.create({ name: 'Tokyo' }),
      fleetDao.create({ name: 'Seattle' }),
    ]);

    const { data } = await fleetDao.list({ maxResults: 100 });

    expect(data.map((f) => f.name).sort()).toEqual(['London', 'Seattle', 'Tokyo']);
  });
});
