// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao } from '@deepracer-indy/database';
import { DeviceStatus, DeviceType, NotAuthorizedError } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListDevicesOperation } from '../listDevices.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args) };
});

const mockIsUserAdminOrFacilitator = vi.fn().mockResolvedValue(true);

const carItem = {
  instanceId: 'mi-1',
  name: 'Car One',
  deviceType: 'CAR',
  carType: 'DEEPRACER',
  status: 'ONLINE',
  activatedAt: '2026-01-01T00:00:00.000Z',
  lastSeenAt: '2026-01-02T00:00:00.000Z',
  fleetId: 'ABCDEFGHIJKLMNO',
  ipAddress: '10.0.0.42',
  metadata: { ssid: 'venue-net' },
};
const timerItem = {
  instanceId: 'mi-2',
  name: 'Timer',
  deviceType: 'TIMER',
  status: 'OFFLINE',
  activatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ListDevices operation', () => {
  beforeEach(() => {
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
    vi.spyOn(deviceDao, 'listAll').mockResolvedValue({ data: [carItem, timerItem], cursor: null } as never);
    vi.spyOn(deviceDao, 'listByType').mockResolvedValue({ data: [carItem], cursor: null } as never);
    vi.spyOn(deviceDao, 'listByFleet').mockResolvedValue([carItem] as never);
  });

  it('throws NotAuthorizedError when caller is neither admin nor facilitator', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);
    await expect(ListDevicesOperation({}, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
  });

  it('lists all devices (no filters) and maps timestamps to Date', async () => {
    const output = await ListDevicesOperation({}, TEST_OPERATION_CONTEXT);

    expect(deviceDao.listAll).toHaveBeenCalled();
    expect(output.devices).toHaveLength(2);
    const car = output.devices.find((d) => d.instanceId === 'mi-1');
    if (!car) throw new Error('expected device mi-1 in results');
    expect(car.activatedAt).toBeInstanceOf(Date);
    expect(car.lastSeenAt).toBeInstanceOf(Date);
    expect(car.carType).toBe('DEEPRACER');
    expect(car.fleetId).toBe('ABCDEFGHIJKLMNO');
    expect(car.ipAddress).toBe('10.0.0.42');
    expect(car.metadata).toEqual({ ssid: 'venue-net', gpioPins: undefined });
  });

  it('queries the DevicesByType index when filtering by deviceType', async () => {
    const output = await ListDevicesOperation({ deviceType: DeviceType.CAR }, TEST_OPERATION_CONTEXT);
    expect(deviceDao.listByType).toHaveBeenCalledWith(DeviceType.CAR, { cursor: undefined });
    expect(deviceDao.listAll).not.toHaveBeenCalled();
    expect(output.devices).toHaveLength(1);
  });

  it('queries the DevicesByFleet index when filtering by fleetId', async () => {
    await ListDevicesOperation({ fleetId: 'ABCDEFGHIJKLMNO' }, TEST_OPERATION_CONTEXT);
    expect(deviceDao.listByFleet).toHaveBeenCalledWith('ABCDEFGHIJKLMNO');
  });

  it('applies the status filter in memory (DDB-only status, no SSM merge)', async () => {
    const output = await ListDevicesOperation({ status: DeviceStatus.ONLINE }, TEST_OPERATION_CONTEXT);
    expect(output.devices).toHaveLength(1);
    expect(output.devices[0].instanceId).toBe('mi-1');
  });

  it('applies deviceType and status filters together', async () => {
    vi.spyOn(deviceDao, 'listByFleet').mockResolvedValue([carItem, timerItem] as never);
    const output = await ListDevicesOperation(
      { fleetId: 'ABCDEFGHIJKLMNO', deviceType: DeviceType.CAR, status: DeviceStatus.ONLINE },
      TEST_OPERATION_CONTEXT,
    );
    expect(output.devices).toHaveLength(1);
    expect(output.devices[0].deviceType).toBe('CAR');
  });

  it('returns an empty list when nothing matches', async () => {
    vi.spyOn(deviceDao, 'listAll').mockResolvedValue({ data: [timerItem], cursor: null } as never);
    const output = await ListDevicesOperation({ status: DeviceStatus.ONLINE }, TEST_OPERATION_CONTEXT);
    expect(output.devices).toEqual([]);
  });

  it('threads the input token to listAll and returns the DAO cursor as the output token', async () => {
    vi.spyOn(deviceDao, 'listAll').mockResolvedValue({ data: [carItem], cursor: 'NEXT_PAGE' } as never);
    const output = await ListDevicesOperation({ token: 'PAGE_2' }, TEST_OPERATION_CONTEXT);
    expect(deviceDao.listAll).toHaveBeenCalledWith({ cursor: 'PAGE_2' });
    expect(output.token).toBe('NEXT_PAGE');
  });

  it('omits the output token on the fleet path (complete, unpaginated response)', async () => {
    const output = await ListDevicesOperation({ fleetId: 'ABCDEFGHIJKLMNO' }, TEST_OPERATION_CONTEXT);
    expect(output.token).toBeUndefined();
  });
});
