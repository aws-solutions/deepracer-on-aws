// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarType, DeviceStatus, DeviceType } from '@deepracer-indy/typescript-server-client';
import { vi } from 'vitest';

import { TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { generateResourceId } from '../../utils/resourceUtils.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';
import { deviceDao } from '../DeviceDao.js';

const createDeviceParams = (overrides: Partial<ReturnType<typeof baseParams>> = {}) => ({
  ...baseParams(),
  ...overrides,
});

function baseParams(): {
  instanceId: string;
  name: string;
  deviceType: DeviceType;
  fleetId: ReturnType<typeof generateResourceId>;
  status: DeviceStatus;
  activatedAt: string;
} {
  return {
    instanceId: `mi-${generateResourceId()}`,
    name: `Car-${generateResourceId()}`,
    deviceType: DeviceType.CAR,
    fleetId: generateResourceId(),
    status: DeviceStatus.PENDING,
    activatedAt: new Date().toISOString(),
  };
}

describe('DeviceDao', () => {
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

  describe('listByType()', () => {
    it('should return only devices of the requested type', async () => {
      await Promise.all([
        deviceDao.create(createDeviceParams({ deviceType: DeviceType.CAR })),
        deviceDao.create(createDeviceParams({ deviceType: DeviceType.CAR })),
        deviceDao.create(createDeviceParams({ deviceType: DeviceType.TIMER })),
      ]);

      const { data } = await deviceDao.listByType(DeviceType.CAR, { maxResults: 10 });

      expect(data).toHaveLength(2);
      expect(data.every((d) => d.deviceType === DeviceType.CAR)).toBe(true);
    });
  });

  describe('listByFleet()', () => {
    it('should return only devices assigned to the fleet, excluding other fleets and unassigned devices', async () => {
      const fleetId = generateResourceId();
      const { fleetId: _omit, ...unassigned } = createDeviceParams();
      void _omit;
      await Promise.all([
        deviceDao.create(createDeviceParams({ fleetId })),
        deviceDao.create(createDeviceParams({ fleetId })),
        deviceDao.create(createDeviceParams({ fleetId: generateResourceId() })),
        deviceDao.create(unassigned),
      ]);

      const devices = await deviceDao.listByFleet(fleetId);

      expect(devices).toHaveLength(2);
      expect(devices.every((d) => d.fleetId === fleetId)).toBe(true);
    });
  });

  describe('listAll()', () => {
    it('should return devices across all types', async () => {
      await Promise.all([
        deviceDao.create(createDeviceParams({ deviceType: DeviceType.CAR })),
        deviceDao.create(createDeviceParams({ deviceType: DeviceType.TIMER })),
      ]);

      const { data, cursor } = await deviceDao.listAll();

      expect(data).toHaveLength(2);
      expect(new Set(data.map((d) => d.deviceType))).toEqual(new Set([DeviceType.CAR, DeviceType.TIMER]));
      expect(cursor).toBeNull();
    });

    it('should return an empty page when no devices exist', async () => {
      const { data, cursor } = await deviceDao.listAll();
      expect(data).toEqual([]);
      expect(cursor).toBeNull();
    });

    it('paginates across type partitions via an opaque cursor without dropping or duplicating devices', async () => {
      // 3 CARs + 2 TIMERs, page size 2 → walking every page must yield all 5 exactly once,
      // proving the composite cursor spans the type partitions and never truncates.
      await Promise.all([
        deviceDao.create(createDeviceParams({ deviceType: DeviceType.CAR })),
        deviceDao.create(createDeviceParams({ deviceType: DeviceType.CAR })),
        deviceDao.create(createDeviceParams({ deviceType: DeviceType.CAR })),
        deviceDao.create(createDeviceParams({ deviceType: DeviceType.TIMER })),
        deviceDao.create(createDeviceParams({ deviceType: DeviceType.TIMER })),
      ]);

      const seen: string[] = [];
      let cursor: string | null = null;
      let guard = 0;
      do {
        const page = await deviceDao.listAll({ cursor, maxResults: 2 });
        expect(page.data.length).toBeLessThanOrEqual(2);
        seen.push(...page.data.map((d) => d.instanceId));
        cursor = page.cursor;
        expect(guard++).toBeLessThan(10);
      } while (cursor);

      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
    });

    it('restarts from the first partition when given an unparseable cursor', async () => {
      await deviceDao.create(createDeviceParams({ deviceType: DeviceType.CAR }));
      const { data } = await deviceDao.listAll({ cursor: 'not-a-valid-cursor' });
      expect(data).toHaveLength(1);
    });
  });

  describe('get()/create()', () => {
    it('should round-trip a device by instance id', async () => {
      const params = createDeviceParams();
      await deviceDao.create(params);

      const loaded = await deviceDao.get({ instanceId: params.instanceId });

      expect(loaded).toMatchObject({ instanceId: params.instanceId, status: DeviceStatus.PENDING });
    });
  });

  describe('upsertStatus()', () => {
    const statusParams = () => ({
      ...baseParams(),
      status: DeviceStatus.ONLINE,
      lastSeenAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 3600,
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('creates the row on first observation, then patches mutable fields while preserving read-only attributes', async () => {
      const params = statusParams();

      const created = await deviceDao.upsertStatus(params);
      expect(created).toMatchObject({ instanceId: params.instanceId, status: DeviceStatus.ONLINE });

      // Second observation supplies changed read-only values; they must be ignored (only
      // status/lastSeenAt/ttl/name/fleetId are patched).
      const patched = await deviceDao.upsertStatus({
        ...params,
        status: DeviceStatus.OFFLINE,
        name: 'Renamed',
        activatedAt: new Date(0).toISOString(),
        deviceType: DeviceType.TIMER,
      });

      expect(patched).toMatchObject({
        instanceId: params.instanceId,
        status: DeviceStatus.OFFLINE,
        name: 'Renamed',
        deviceType: params.deviceType,
        activatedAt: params.activatedAt,
      });
    });

    it('persists ipAddress on create and refreshes it on a later observation', async () => {
      const params = { ...statusParams(), ipAddress: '10.0.0.5' };

      const created = await deviceDao.upsertStatus(params);
      expect(created).toMatchObject({ instanceId: params.instanceId, ipAddress: '10.0.0.5' });

      // A reconnect / DHCP lease change reports a new address — it must be refreshed.
      const patched = await deviceDao.upsertStatus({ ...params, ipAddress: '10.0.0.9' });
      expect(patched).toMatchObject({ instanceId: params.instanceId, ipAddress: '10.0.0.9' });
    });

    it('captures carType when it arrives on a later observation (device self-tags after registration)', async () => {
      const params = statusParams();

      // First observation: the device has not self-tagged its CarType yet.
      const created = await deviceDao.upsertStatus(params);
      expect((created as { carType?: string }).carType).toBeUndefined();

      // A later observation, once the CarType tag has landed, fills it in.
      const patched = await deviceDao.upsertStatus({ ...params, carType: CarType.DEEPRACER_RPI });
      expect(patched).toMatchObject({ instanceId: params.instanceId, carType: CarType.DEEPRACER_RPI });
    });

    it('stores loggingCapable, keeps false values, and does not wipe it when a later observation omits it', async () => {
      const params = statusParams();

      const created = await deviceDao.upsertStatus({ ...params, loggingCapable: false });
      expect(created).toMatchObject({ loggingCapable: false });

      const patched = await deviceDao.upsertStatus({ ...params, loggingCapable: true });
      expect(patched).toMatchObject({ loggingCapable: true });

      const untouched = await deviceDao.upsertStatus(params);
      expect(untouched).toMatchObject({ loggingCapable: true });
    });

    it('does not wipe a previously captured carType when a later observation omits it', async () => {
      const params = statusParams();

      const created = await deviceDao.upsertStatus({ ...params, carType: CarType.DEEPRACER_CUSTOM });
      expect(created).toMatchObject({ carType: CarType.DEEPRACER_CUSTOM });

      // A later observation that cannot read the tag (carType undefined) must preserve it.
      const patched = await deviceDao.upsertStatus(params);
      expect(patched).toMatchObject({ instanceId: params.instanceId, carType: CarType.DEEPRACER_CUSTOM });
    });

    it('falls back to a patch when create loses a race (ConditionalCheckFailedException)', async () => {
      const params = statusParams();
      const getSpy = vi.spyOn(deviceDao, 'get').mockResolvedValue(null);
      const createSpy = vi
        .spyOn(deviceDao, 'create')
        .mockRejectedValue(Object.assign(new Error('conditional'), { name: 'ConditionalCheckFailedException' }));
      const patchSpy = vi
        .spyOn(deviceDao, 'partialUpdate')
        .mockResolvedValue({ instanceId: params.instanceId } as never);

      await expect(deviceDao.upsertStatus(params)).resolves.toEqual({ instanceId: params.instanceId });

      expect(getSpy).toHaveBeenCalledOnce();
      expect(createSpy).toHaveBeenCalledOnce();
      expect(patchSpy).toHaveBeenCalledWith(
        { instanceId: params.instanceId },
        expect.objectContaining({ status: params.status, lastSeenAt: params.lastSeenAt, ttl: params.ttl }),
      );
    });

    it('rethrows create errors that are not conditional-check failures', async () => {
      vi.spyOn(deviceDao, 'get').mockResolvedValue(null);
      vi.spyOn(deviceDao, 'create').mockRejectedValue(new Error('boom'));
      const patchSpy = vi.spyOn(deviceDao, 'partialUpdate');

      await expect(deviceDao.upsertStatus(statusParams())).rejects.toThrow('boom');
      expect(patchSpy).not.toHaveBeenCalled();
    });
  });
});
