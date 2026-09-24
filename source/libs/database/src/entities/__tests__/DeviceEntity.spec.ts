// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarType, DeviceStatus, DeviceType } from '@deepracer-indy/typescript-server-client';

import { TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { generateResourceId } from '../../utils/resourceUtils.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';
import { DeviceEntity, type DeviceItem } from '../DeviceEntity.js';

const createDeviceParams = () => ({
  instanceId: `mi-${generateResourceId()}`,
  name: 'Pit Lane Car 1',
  deviceType: DeviceType.CAR,
  carType: CarType.DEEPRACER_CUSTOM,
  fleetId: generateResourceId(),
  status: DeviceStatus.PENDING,
  activatedAt: new Date().toISOString(),
});

describe('DeviceEntity', () => {
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

  it('should create a device with pk === sk === device#{instanceId} and no commandLock', async () => {
    const params = createDeviceParams();

    await DeviceEntity.create(params).go();

    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
    const device = Items?.[0] as DeviceItem & { pk: string; sk: string; commandLock?: number };
    const expectedKey = `device#${params.instanceId}`;

    expect(device.pk).toBe(expectedKey);
    expect(device.sk).toBe(expectedKey);
    expect(device.commandLock).toBeUndefined();
    expect(device).toMatchObject({
      ...params,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      version: 1,
    });
  });

  it('should allow a device with no fleet (nullable fleetId)', async () => {
    const { fleetId, carType, ...noFleet } = createDeviceParams();
    void fleetId;
    void carType;

    await DeviceEntity.create({ ...noFleet, deviceType: DeviceType.TIMER }).go();

    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
    const device = Items?.[0] as DeviceItem;

    expect(device.fleetId).toBeUndefined();
  });

  it('should persist optional metadata (ssid, gpioPins), lastSeenAt and ttl', async () => {
    const params = {
      ...createDeviceParams(),
      deviceType: DeviceType.TIMER,
      carType: undefined,
      status: DeviceStatus.ONLINE,
      lastSeenAt: new Date().toISOString(),
      ttl: 1_800_000_000,
      metadata: { ssid: 'venue-wifi', gpioPins: [17, 27] },
    };

    await DeviceEntity.create(params).go();

    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
    const device = Items?.[0] as DeviceItem;

    expect(device.metadata).toEqual({ ssid: 'venue-wifi', gpioPins: [17, 27] });
    expect(device.lastSeenAt).toBe(params.lastSeenAt);
    expect(device.ttl).toBe(params.ttl);
  });
});
