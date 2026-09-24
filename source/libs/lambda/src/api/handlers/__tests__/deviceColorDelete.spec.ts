// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao, fleetEventDao } from '@deepracer-indy/database';
import {
  ConflictError,
  DeviceColor,
  InternalFailureError,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';

import { ssmClient } from '../../../utils/clients/ssmClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ChangeDeviceColorOperation } from '../changeDeviceColor.js';
import { DeleteDeviceOperation } from '../deleteDevice.js';

vi.mock('../../../utils/clients/ssmClient.js', () => ({
  ssmClient: { send: vi.fn() },
}));

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return {
    ...actual,
    isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args),
    isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args),
  };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);
const mockIsUserAdminOrFacilitator = vi.fn().mockResolvedValue(true);
const INSTANCE = 'mi-0123456789abcdef0';

const sentCommands = () =>
  (
    (vi.mocked(ssmClient.send).mock.calls[0][0] as unknown as { input: { Parameters: { commands: string[] } } }).input
      .Parameters.commands as string[]
  ).join('\n');

describe('ChangeDeviceColor operation', () => {
  beforeEach(() => {
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
    vi.spyOn(deviceDao, 'load').mockResolvedValue({ instanceId: INSTANCE } as never);
    vi.mocked(ssmClient.send).mockResolvedValue({ Command: { CommandId: 'cmd-color' } } as never);
  });

  it('dispatches set_led_state with full-scale PWM for the requested colour', async () => {
    await ChangeDeviceColorOperation({ instanceId: INSTANCE, color: DeviceColor.RED }, TEST_OPERATION_CONTEXT);

    const cmd = sentCommands();
    expect(cmd).toContain('/servo_pkg/set_led_state');
    // RED → red on, green/blue off (MAX_PWM = 9999825).
    expect(cmd).toContain('{red: 9999825, blue: 0, green: 0}');
  });

  it('maps CYAN to green+blue on, red off', async () => {
    await ChangeDeviceColorOperation({ instanceId: INSTANCE, color: DeviceColor.CYAN }, TEST_OPERATION_CONTEXT);
    expect(sentCommands()).toContain('{red: 0, blue: 9999825, green: 9999825}');
  });

  it('rejects callers who are neither admin nor facilitator', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);
    await expect(
      ChangeDeviceColorOperation({ instanceId: INSTANCE, color: DeviceColor.BLUE }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotAuthorizedError);
    expect(ssmClient.send).not.toHaveBeenCalled();
  });

  it('propagates 404 when the device does not exist', async () => {
    vi.spyOn(deviceDao, 'load').mockRejectedValue(new NotFoundError({ message: 'no device' }));
    await expect(
      ChangeDeviceColorOperation({ instanceId: INSTANCE, color: DeviceColor.BLUE }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws InternalFailureError when SSM SendCommand fails', async () => {
    vi.mocked(ssmClient.send).mockRejectedValueOnce(new Error('ThrottlingException'));
    await expect(
      ChangeDeviceColorOperation({ instanceId: INSTANCE, color: DeviceColor.BLUE }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(InternalFailureError);
  });
});

describe('DeleteDevice operation', () => {
  beforeEach(() => {
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
    vi.spyOn(deviceDao, 'load').mockResolvedValue({ instanceId: INSTANCE, fleetId: 'FLEET0000000001' } as never);
    vi.spyOn(deviceDao, 'delete').mockResolvedValue({} as never);
    vi.spyOn(fleetEventDao, 'listEventsByFleet').mockResolvedValue([] as never);
    vi.mocked(ssmClient.send).mockResolvedValue({} as never);
  });

  it('deregisters the instance and deletes the row when the fleet is not in any event', async () => {
    await DeleteDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT);

    expect(vi.mocked(ssmClient.send).mock.calls[0][0].constructor.name).toBe('DeregisterManagedInstanceCommand');
    expect(deviceDao.delete).toHaveBeenCalledWith({ instanceId: INSTANCE });
  });

  it('skips the fleet check and still deletes an unassigned device', async () => {
    vi.spyOn(deviceDao, 'load').mockResolvedValue({ instanceId: INSTANCE } as never);
    await DeleteDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT);

    expect(fleetEventDao.listEventsByFleet).not.toHaveBeenCalled();
    expect(deviceDao.delete).toHaveBeenCalledWith({ instanceId: INSTANCE });
  });

  it('rejects with 409 Conflict when the device fleet is assigned to an event', async () => {
    vi.spyOn(fleetEventDao, 'listEventsByFleet').mockResolvedValue([
      { eventId: 'E1', fleetId: 'FLEET0000000001' },
    ] as never);

    await expect(DeleteDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      ConflictError,
    );
    expect(ssmClient.send).not.toHaveBeenCalled();
    expect(deviceDao.delete).not.toHaveBeenCalled();
  });

  it('propagates 404 when the device does not exist', async () => {
    vi.spyOn(deviceDao, 'load').mockRejectedValue(new NotFoundError({ message: 'no device' }));
    await expect(DeleteDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects callers who are neither admin nor facilitator', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);
    await expect(DeleteDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotAuthorizedError,
    );
  });

  it('throws InternalFailureError and does not delete the row when deregister fails', async () => {
    vi.mocked(ssmClient.send).mockRejectedValueOnce(new Error('InvalidInstanceId'));
    await expect(DeleteDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      InternalFailureError,
    );
    expect(deviceDao.delete).not.toHaveBeenCalled();
  });
});
