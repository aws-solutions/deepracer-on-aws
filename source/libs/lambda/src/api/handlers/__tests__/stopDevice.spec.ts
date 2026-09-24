// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  DeviceType,
  InternalFailureError,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';

import { ssmClient } from '../../../utils/clients/ssmClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { StopDeviceOperation } from '../stopDevice.js';

vi.mock('../../../utils/clients/ssmClient.js', () => ({
  ssmClient: { send: vi.fn() },
}));

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args) };
});

const mockIsUserAdminOrFacilitator = vi.fn().mockResolvedValue(true);
const INSTANCE = 'mi-0123456789abcdef0';

const sentCommandInput = () =>
  (vi.mocked(ssmClient.send).mock.calls[0][0] as unknown as { input: Record<string, unknown> }).input;

describe('StopDevice operation', () => {
  beforeEach(() => {
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
    vi.spyOn(deviceDao, 'load').mockResolvedValue({ instanceId: INSTANCE, deviceType: DeviceType.CAR } as never);
    vi.mocked(ssmClient.send).mockResolvedValue({ Command: { CommandId: 'cmd-stop-1' } } as never);
  });

  it('dispatches a ROS2 emergency-stop command and returns the commandId (202)', async () => {
    const out = await StopDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT);

    expect(out.commandId).toBe('cmd-stop-1');
    const commands = (sentCommandInput().Parameters as { commands: string[] }).commands;
    expect(commands.some((c) => c.includes('/ctrl_pkg/enable_state') && c.includes('is_active: false'))).toBe(true);
  });

  it('rejects a TIMER device with a 400 (only cars can be stopped)', async () => {
    vi.spyOn(deviceDao, 'load').mockResolvedValue({ instanceId: INSTANCE, deviceType: DeviceType.TIMER } as never);

    await expect(StopDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      BadRequestError,
    );
    expect(ssmClient.send).not.toHaveBeenCalled();
  });

  it('rejects callers who are neither admin nor facilitator before calling SSM', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);

    await expect(StopDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotAuthorizedError,
    );
    expect(ssmClient.send).not.toHaveBeenCalled();
  });

  it('propagates 404 when the device does not exist', async () => {
    vi.spyOn(deviceDao, 'load').mockRejectedValue(new NotFoundError({ message: 'no device' }));

    await expect(StopDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotFoundError);
    expect(ssmClient.send).not.toHaveBeenCalled();
  });

  it('throws InternalFailureError when SSM SendCommand fails', async () => {
    vi.mocked(ssmClient.send).mockRejectedValueOnce(new Error('ThrottlingException'));

    await expect(StopDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      InternalFailureError,
    );
  });
});
