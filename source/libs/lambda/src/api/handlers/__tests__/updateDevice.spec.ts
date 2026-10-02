// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao, fleetDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  CarType,
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

const deviceItem = (overrides: { fleetId?: string; carType?: CarType; deviceType?: DeviceType } = {}) => ({
  instanceId: INSTANCE,
  name: 'Car One',
  deviceType: overrides.deviceType ?? DeviceType.CAR,
  status: DeviceStatus.ONLINE,
  activatedAt: '2026-01-01T00:00:00.000Z',
  ...(overrides.fleetId ? { fleetId: overrides.fleetId } : {}),
  ...(overrides.carType ? { carType: overrides.carType } : {}),
});

const sentCommand = (i = 0) => vi.mocked(ssmClient.send).mock.calls[i][0];
const sentInput = (i = 0) => (sentCommand(i) as unknown as { input: Record<string, unknown> }).input;

describe('UpdateDevice operation', () => {
  beforeEach(() => {
    mockIsUserAdmin.mockResolvedValue(true);
    vi.spyOn(deviceDao, 'load').mockResolvedValue(deviceItem() as never);
    // partialUpdate returns the full row with the patch applied (as ElectroDB does). Model this
    // statefully so writes across multiple calls (fleetId then carType) accumulate onto the row.
    let rowState: Record<string, unknown> = deviceItem();
    vi.spyOn(deviceDao, 'partialUpdate').mockImplementation((_key, fields) => {
      rowState = { ...rowState, ...(fields as object) };
      return Promise.resolve(rowState as never) as never;
    });
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

  it('sets carType on a car (DDB-only, no SSM tag) without touching the fleet', async () => {
    const out = await UpdateDeviceOperation(
      { instanceId: INSTANCE, carType: CarType.DEEPRACER_RPI },
      TEST_OPERATION_CONTEXT,
    );

    expect(ssmClient.send).not.toHaveBeenCalled();
    expect(deviceDao.partialUpdate).toHaveBeenCalledWith({ instanceId: INSTANCE }, { carType: CarType.DEEPRACER_RPI });
    expect(out.device.carType).toBe(CarType.DEEPRACER_RPI);
  });

  it('treats an explicit fleetId: undefined alongside carType as carType-only (does not unassign)', async () => {
    const out = await UpdateDeviceOperation(
      { instanceId: INSTANCE, fleetId: undefined, carType: CarType.DEEPRACER_RPI },
      TEST_OPERATION_CONTEXT,
    );

    expect(ssmClient.send).not.toHaveBeenCalled();
    expect(fleetDao.load).not.toHaveBeenCalled();
    expect(deviceDao.partialUpdate).toHaveBeenCalledWith({ instanceId: INSTANCE }, { carType: CarType.DEEPRACER_RPI });
    expect(deviceDao.partialUpdate).not.toHaveBeenCalledWith({ instanceId: INSTANCE }, { fleetId: undefined });
    expect(out.device.carType).toBe(CarType.DEEPRACER_RPI);
  });

  it('applies carType and fleetId together: tags the fleet, patches both in DDB', async () => {
    const out = await UpdateDeviceOperation(
      { instanceId: INSTANCE, fleetId: FLEET, carType: CarType.DEEPRACER },
      TEST_OPERATION_CONTEXT,
    );

    expect(fleetDao.load).toHaveBeenCalledWith({ fleetId: FLEET });
    expect(sentCommand().constructor.name).toBe('AddTagsToResourceCommand');
    expect(sentInput().Tags).toEqual([{ Key: 'fleetId', Value: FLEET }]);
    // fleetId and carType are persisted with independent failure semantics, so they are written
    // in separate partialUpdate calls.
    expect(deviceDao.partialUpdate).toHaveBeenCalledWith({ instanceId: INSTANCE }, { fleetId: FLEET });
    expect(deviceDao.partialUpdate).toHaveBeenCalledWith({ instanceId: INSTANCE }, { carType: CarType.DEEPRACER });
    expect(out.device.fleetId).toBe(FLEET);
    expect(out.device.carType).toBe(CarType.DEEPRACER);
  });

  it('returns 400 when carType is set on a non-CAR (TIMER) device (no SSM tag, no patch)', async () => {
    vi.spyOn(deviceDao, 'load').mockResolvedValue(deviceItem({ deviceType: DeviceType.TIMER }) as never);

    await expect(
      UpdateDeviceOperation({ instanceId: INSTANCE, carType: CarType.DEEPRACER }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(BadRequestError);
    expect(ssmClient.send).not.toHaveBeenCalled();
    expect(deviceDao.partialUpdate).not.toHaveBeenCalled();
  });

  it('throws InternalFailureError when the DynamoDB write fails on a carType request', async () => {
    vi.spyOn(deviceDao, 'partialUpdate').mockRejectedValueOnce(new Error('DDB unavailable'));

    await expect(
      UpdateDeviceOperation({ instanceId: INSTANCE, carType: CarType.DEEPRACER_RPI }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(InternalFailureError);
  });

  it('tolerates a DynamoDB write failure on a fleet-only request (poller reconciles from the tag)', async () => {
    vi.spyOn(deviceDao, 'partialUpdate').mockRejectedValueOnce(new Error('DDB unavailable'));

    const out = await UpdateDeviceOperation({ instanceId: INSTANCE, fleetId: FLEET }, TEST_OPERATION_CONTEXT);

    expect(out.device.fleetId).toBe(FLEET);
  });

  it('throws when the carType write fails on a combined request, without rolling back the applied fleet change', async () => {
    vi.spyOn(deviceDao, 'partialUpdate')
      .mockResolvedValueOnce(deviceItem({ fleetId: FLEET }) as never)
      .mockRejectedValueOnce(new Error('DDB unavailable'));

    await expect(
      UpdateDeviceOperation(
        { instanceId: INSTANCE, fleetId: FLEET, carType: CarType.DEEPRACER },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toThrow(InternalFailureError);

    // Fleet tag was set (source of truth) and not removed — no RemoveTags call was issued.
    const removeCalls = vi
      .mocked(ssmClient.send)
      .mock.calls.filter((c) => (c[0] as object).constructor.name === 'RemoveTagsFromResourceCommand');
    expect(removeCalls).toHaveLength(0);
  });

  it('keeps the applied fleet change in the response when the fleet cache write fails but carType succeeds', async () => {
    vi.spyOn(deviceDao, 'partialUpdate')
      .mockRejectedValueOnce(new Error('DDB unavailable'))
      .mockResolvedValueOnce(deviceItem({ carType: CarType.DEEPRACER }) as never); // note: no fleetId

    const out = await UpdateDeviceOperation(
      { instanceId: INSTANCE, fleetId: FLEET, carType: CarType.DEEPRACER },
      TEST_OPERATION_CONTEXT,
    );

    expect(out.device.carType).toBe(CarType.DEEPRACER);
    expect(out.device.fleetId).toBe(FLEET);
  });
});
