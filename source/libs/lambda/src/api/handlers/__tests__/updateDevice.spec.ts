// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao, fleetDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  DeviceStatus,
  DeviceType,
  InternalFailureError,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';

import { ssmClient } from '../../../utils/clients/ssmClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { UpdateDeviceOperation } from '../updateDevice.js';

vi.mock('../../../utils/clients/ssmClient.js', () => ({
  ssmClient: { send: vi.fn() },
}));

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);
const INSTANCE = 'mi-0123456789abcdef0';
const FLEET = 'FLEET0000000001';

const deviceItem = (fleetId?: string) => ({
  instanceId: INSTANCE,
  name: 'Car One',
  deviceType: DeviceType.CAR,
  status: DeviceStatus.ONLINE,
  activatedAt: '2026-01-01T00:00:00.000Z',
  ...(fleetId ? { fleetId } : {}),
});

const sentCommand = (i = 0) => vi.mocked(ssmClient.send).mock.calls[i][0];
const sentInput = (i = 0) => (sentCommand(i) as unknown as { input: Record<string, unknown> }).input;

describe('UpdateDevice operation', () => {
  beforeEach(() => {
    mockIsUserAdmin.mockResolvedValue(true);
    vi.spyOn(deviceDao, 'load').mockResolvedValue(deviceItem() as never);
    vi.spyOn(deviceDao, 'partialUpdate').mockImplementation(
      (_key, fields) => Promise.resolve(deviceItem((fields as { fleetId?: string }).fleetId) as never) as never,
    );
    vi.spyOn(fleetDao, 'load').mockResolvedValue({ fleetId: FLEET } as never);
    vi.mocked(ssmClient.send).mockResolvedValue({} as never);
  });

  it('assigns the device to a fleet: validates the fleet, tags the instance, patches DDB', async () => {
    const out = await UpdateDeviceOperation({ instanceId: INSTANCE, fleetId: FLEET }, TEST_OPERATION_CONTEXT);

    expect(fleetDao.load).toHaveBeenCalledWith({ fleetId: FLEET });
    expect(sentCommand().constructor.name).toBe('AddTagsToResourceCommand');
    expect(sentInput().Tags).toEqual([{ Key: 'fleetId', Value: FLEET }]);
    expect(deviceDao.partialUpdate).toHaveBeenCalledWith({ instanceId: INSTANCE }, { fleetId: FLEET });
    expect(out.device.fleetId).toBe(FLEET);
  });

  it('unassigns the device when no fleetId is provided: removes the tag, clears DDB', async () => {
    const out = await UpdateDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT);

    expect(sentCommand().constructor.name).toBe('RemoveTagsFromResourceCommand');
    expect(sentInput().TagKeys).toEqual(['fleetId']);
    expect(deviceDao.partialUpdate).toHaveBeenCalledWith({ instanceId: INSTANCE }, { fleetId: undefined });
    expect(out.device.fleetId).toBeUndefined();
    expect(fleetDao.load).not.toHaveBeenCalled();
  });

  it('returns 400 when the target fleet does not exist (and does not tag or patch)', async () => {
    vi.spyOn(fleetDao, 'load').mockRejectedValue(new NotFoundError({ message: 'no fleet' }));

    await expect(
      UpdateDeviceOperation({ instanceId: INSTANCE, fleetId: 'BAD' }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(BadRequestError);
    expect(ssmClient.send).not.toHaveBeenCalled();
    expect(deviceDao.partialUpdate).not.toHaveBeenCalled();
  });

  it('propagates 404 when the device does not exist', async () => {
    vi.spyOn(deviceDao, 'load').mockRejectedValue(new NotFoundError({ message: 'no device' }));

    await expect(
      UpdateDeviceOperation({ instanceId: INSTANCE, fleetId: FLEET }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotFoundError);
    expect(ssmClient.send).not.toHaveBeenCalled();
  });

  it('rejects non-admin callers', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(false);

    await expect(
      UpdateDeviceOperation({ instanceId: INSTANCE, fleetId: FLEET }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotAuthorizedError);
    expect(ssmClient.send).not.toHaveBeenCalled();
  });

  it('throws InternalFailureError and does not patch DDB when the SSM tag update fails', async () => {
    vi.mocked(ssmClient.send).mockRejectedValueOnce(new Error('AccessDenied'));

    await expect(
      UpdateDeviceOperation({ instanceId: INSTANCE, fleetId: FLEET }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(InternalFailureError);
    expect(deviceDao.partialUpdate).not.toHaveBeenCalled();
  });
});
