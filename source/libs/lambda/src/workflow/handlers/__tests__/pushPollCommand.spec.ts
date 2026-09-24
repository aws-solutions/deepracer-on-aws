// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SSMClient, GetCommandInvocationCommand } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';

import { lambdaHandler } from '../pushPollCommand.js';
import type { PushSendCommandOutput } from '../pushSendCommand.js';

const ssmMock = mockClient(SSMClient);

const TEST_INPUT: PushSendCommandOutput = {
  deploymentId: 'deploy-1' as never,
  modelId: 'model-1' as never,
  carInstanceId: 'i-123',
  presignedUrl: 'https://example.com/model.tar.gz',
  carType: 'DEEPRACER_RPI',
  commandId: 'cmd-abc123',
};

describe('pushPollCommand', () => {
  beforeEach(() => {
    ssmMock.reset();
  });

  it('should return Success status when command completes', async () => {
    ssmMock.on(GetCommandInvocationCommand).resolves({
      Status: 'Success',
      StandardErrorContent: '',
    });

    const result = await lambdaHandler(TEST_INPUT, {} as never, vi.fn() as never);

    expect(result).toEqual(expect.objectContaining({ commandStatus: 'Success', commandError: '' }));
  });

  it('should return Failed status with error content', async () => {
    ssmMock.on(GetCommandInvocationCommand).resolves({
      Status: 'Failed',
      StandardErrorContent: 'curl: (7) Failed to connect',
    });

    const result = await lambdaHandler(TEST_INPUT, {} as never, vi.fn() as never);

    expect(result).toEqual(
      expect.objectContaining({
        commandStatus: 'Failed',
        commandError: 'curl: (7) Failed to connect',
      }),
    );
  });

  it('should return InProgress status when still running', async () => {
    ssmMock.on(GetCommandInvocationCommand).resolves({
      Status: 'InProgress',
      StandardErrorContent: '',
    });

    const result = await lambdaHandler(TEST_INPUT, {} as never, vi.fn() as never);

    expect(result).toEqual(expect.objectContaining({ commandStatus: 'InProgress' }));
  });

  it('should initialize pollCount to 1 on first invocation', async () => {
    ssmMock.on(GetCommandInvocationCommand).resolves({ Status: 'InProgress' });

    const result = await lambdaHandler(TEST_INPUT, {} as never, vi.fn() as never);

    expect(result).toEqual(expect.objectContaining({ pollCount: 1 }));
  });

  it('should increment pollCount on subsequent invocations', async () => {
    ssmMock.on(GetCommandInvocationCommand).resolves({ Status: 'InProgress' });

    const result = await lambdaHandler({ ...TEST_INPUT, pollCount: 5 }, {} as never, vi.fn() as never);

    expect(result).toEqual(expect.objectContaining({ pollCount: 6 }));
  });
});
