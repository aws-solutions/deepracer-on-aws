// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao } from '@deepracer-indy/database';
import { BadRequestError, NotAuthorizedError, NotFoundError } from '@deepracer-indy/typescript-server-client';

import { ssmClient } from '../../../utils/clients/ssmClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ClearDeviceModelsOperation } from '../clearDeviceModels.js';

vi.mock('../../../utils/clients/ssmClient.js', () => ({
  ssmClient: { send: vi.fn() },
}));

const mockIsUserAdminOrFacilitator = vi.fn().mockResolvedValue(true);
vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args) };
});

const TEST_INSTANCE_ID = 'mi-01234567890abcdef';
const TEST_COMMAND_ID = 'cmd-abc123';

const TEST_DEVICE = {
  instanceId: TEST_INSTANCE_ID,
  name: 'Car-London-01',
  deviceType: 'CAR',
  status: 'ONLINE',
};

describe('ClearDeviceModels operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
    vi.spyOn(deviceDao, 'load').mockResolvedValue(TEST_DEVICE as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws NotAuthorizedError for non-admin/facilitator users', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);

    await expect(ClearDeviceModelsOperation({ instanceId: TEST_INSTANCE_ID }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotAuthorizedError,
    );
  });

  it('throws NotFoundError when device does not exist', async () => {
    vi.spyOn(deviceDao, 'load').mockResolvedValue(null as never);

    await expect(ClearDeviceModelsOperation({ instanceId: TEST_INSTANCE_ID }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('returns commandId on successful clear (SSM reports Success)', async () => {
    vi.mocked(ssmClient.send)
      .mockResolvedValueOnce({ Command: { CommandId: TEST_COMMAND_ID } } as never) // SendCommand
      .mockResolvedValueOnce({ Status: 'Success' } as never); // GetCommandInvocation

    const resultPromise = ClearDeviceModelsOperation({ instanceId: TEST_INSTANCE_ID }, TEST_OPERATION_CONTEXT);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(result.commandId).toBe(TEST_COMMAND_ID);
    expect(ssmClient.send).toHaveBeenCalledTimes(2);
  });

  it('throws BadRequestError when SSM reports Failed', async () => {
    vi.mocked(ssmClient.send)
      .mockResolvedValueOnce({ Command: { CommandId: TEST_COMMAND_ID } } as never) // SendCommand
      .mockResolvedValueOnce({ Status: 'Failed' } as never); // GetCommandInvocation

    const resultPromise = ClearDeviceModelsOperation({ instanceId: TEST_INSTANCE_ID }, TEST_OPERATION_CONTEXT);
    resultPromise.catch(() => {
      /* expected rejection */
    });
    await vi.runAllTimersAsync();
    await expect(resultPromise).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws BadRequestError when SSM reports TimedOut', async () => {
    vi.mocked(ssmClient.send)
      .mockResolvedValueOnce({ Command: { CommandId: TEST_COMMAND_ID } } as never) // SendCommand
      .mockResolvedValueOnce({ Status: 'TimedOut' } as never); // GetCommandInvocation

    const resultPromise = ClearDeviceModelsOperation({ instanceId: TEST_INSTANCE_ID }, TEST_OPERATION_CONTEXT);
    resultPromise.catch(() => {
      /* expected rejection */
    });
    await vi.runAllTimersAsync();
    await expect(resultPromise).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws BadRequestError when SSM reports Cancelled', async () => {
    vi.mocked(ssmClient.send)
      .mockResolvedValueOnce({ Command: { CommandId: TEST_COMMAND_ID } } as never) // SendCommand
      .mockResolvedValueOnce({ Status: 'Cancelled' } as never); // GetCommandInvocation

    const resultPromise = ClearDeviceModelsOperation({ instanceId: TEST_INSTANCE_ID }, TEST_OPERATION_CONTEXT);
    resultPromise.catch(() => {
      /* expected rejection */
    });
    await vi.runAllTimersAsync();
    await expect(resultPromise).rejects.toBeInstanceOf(BadRequestError);
  });

  it('proceeds without throwing when poll loop exhausts MAX_POLLS (timeout path — DREM parity)', async () => {
    vi.mocked(ssmClient.send)
      .mockResolvedValueOnce({ Command: { CommandId: TEST_COMMAND_ID } } as never) // SendCommand
      .mockResolvedValue({ Status: 'InProgress' } as never); // All GetCommandInvocation calls return InProgress

    const resultPromise = ClearDeviceModelsOperation({ instanceId: TEST_INSTANCE_ID }, TEST_OPERATION_CONTEXT);

    // Advance past all 15 poll intervals (15 × 1000ms)
    for (let i = 0; i < 15; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    const result = await resultPromise;
    expect(result.commandId).toBe(TEST_COMMAND_ID);

    // SendCommand (1) + GetCommandInvocation (15) = 16 total calls
    expect(ssmClient.send).toHaveBeenCalledTimes(16);
  });

  it('retries on transient SSM error during poll and succeeds on next attempt', async () => {
    vi.mocked(ssmClient.send)
      .mockResolvedValueOnce({ Command: { CommandId: TEST_COMMAND_ID } } as never) // SendCommand
      .mockRejectedValueOnce(new Error('InvocationDoesNotExist')) // Transient error on first poll
      .mockResolvedValueOnce({ Status: 'Success' } as never); // Success on second poll

    const resultPromise = ClearDeviceModelsOperation({ instanceId: TEST_INSTANCE_ID }, TEST_OPERATION_CONTEXT);

    await vi.advanceTimersByTimeAsync(1000); // First poll — transient error, caught and retried
    await vi.advanceTimersByTimeAsync(1000); // Second poll — success

    const result = await resultPromise;
    expect(result.commandId).toBe(TEST_COMMAND_ID);
    expect(ssmClient.send).toHaveBeenCalledTimes(3); // SendCommand + 2 polls
  });

  it('throws Error when SendCommand returns no CommandId', async () => {
    vi.mocked(ssmClient.send).mockResolvedValueOnce({ Command: {} } as never); // No CommandId

    await expect(ClearDeviceModelsOperation({ instanceId: TEST_INSTANCE_ID }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      'SSM SendCommand did not return a CommandId',
    );
  });

  it('sends correct SSM command parameters', async () => {
    vi.mocked(ssmClient.send)
      .mockResolvedValueOnce({ Command: { CommandId: TEST_COMMAND_ID } } as never)
      .mockResolvedValueOnce({ Status: 'Success' } as never);

    const resultPromise = ClearDeviceModelsOperation({ instanceId: TEST_INSTANCE_ID }, TEST_OPERATION_CONTEXT);
    await vi.advanceTimersByTimeAsync(1000);
    await resultPromise;

    const sendCommandCall = vi.mocked(ssmClient.send).mock.calls[0][0];
    expect(sendCommandCall.input).toEqual({
      InstanceIds: [TEST_INSTANCE_ID],
      DocumentName: 'AWS-RunShellScript',
      Parameters: { commands: ['rm -rf /opt/aws/deepracer/artifacts/*', 'rm -rf /opt/aws/deepracer/logs/*'] },
    });
  });
});
