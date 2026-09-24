// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao } from '@deepracer-indy/database';
import { InternalFailureError, NotAuthorizedError, NotFoundError } from '@deepracer-indy/typescript-server-client';

import { ssmClient } from '../../../utils/clients/ssmClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { RestartDeviceOperation } from '../restartDevice.js';

vi.mock('../../../utils/clients/ssmClient.js', () => ({
  ssmClient: { send: vi.fn() },
}));

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args) };
});

const mockIsUserAdminOrFacilitator = vi.fn().mockResolvedValue(true);
const INSTANCE = 'mi-0123456789abcdef0';

/** Extracts the SendCommandCommand input from the first ssmClient.send call. */
const sentCommandInput = () =>
  (vi.mocked(ssmClient.send).mock.calls[0][0] as unknown as { input: Record<string, unknown> }).input;

describe('RestartDevice operation', () => {
  beforeEach(() => {
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
    vi.spyOn(deviceDao, 'load').mockResolvedValue({ instanceId: INSTANCE } as never);
    vi.mocked(ssmClient.send).mockResolvedValue({ Command: { CommandId: 'cmd-123' } } as never);
  });

  it('dispatches an SSM restart command and returns the commandId (202)', async () => {
    const out = await RestartDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT);

    expect(out.commandId).toBe('cmd-123');
    const input = sentCommandInput();
    expect(input.InstanceIds).toEqual([INSTANCE]);
    expect(input.DocumentName).toBe('AWS-RunShellScript');
    expect((input.Parameters as { commands: string[] }).commands).toContain('systemctl restart deepracer-core');
  });

  it('rejects callers who are neither admin nor facilitator before calling SSM', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);

    await expect(RestartDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotAuthorizedError,
    );
    expect(ssmClient.send).not.toHaveBeenCalled();
  });

  it('propagates 404 when the device does not exist', async () => {
    vi.spyOn(deviceDao, 'load').mockRejectedValue(new NotFoundError({ message: 'no device' }));

    await expect(RestartDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotFoundError,
    );
    expect(ssmClient.send).not.toHaveBeenCalled();
  });

  it('throws InternalFailureError when SSM SendCommand fails', async () => {
    vi.mocked(ssmClient.send).mockRejectedValueOnce(new Error('ThrottlingException'));

    await expect(RestartDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      InternalFailureError,
    );
  });

  it('throws InternalFailureError when SSM returns no CommandId', async () => {
    vi.mocked(ssmClient.send).mockResolvedValueOnce({ Command: {} } as never);

    await expect(RestartDeviceOperation({ instanceId: INSTANCE }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      InternalFailureError,
    );
  });
});
