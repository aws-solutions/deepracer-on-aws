// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SSMClient, SendCommandCommand } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';

import { lambdaHandler } from '../pushSendCommand.js';
import type { PushDeploymentContext } from '../pushUpdateDeploymentStatus.js';

const ssmMock = mockClient(SSMClient);

const TEST_INPUT: PushDeploymentContext = {
  deploymentId: 'deploy-1' as never,
  modelId: 'model-1' as never,
  carInstanceId: 'i-123',
  presignedUrl: 'https://example.com/model.tar.gz',
  carType: 'DEEPRACER_RPI',
  modelName: 'test-model',
};

describe('pushSendCommand', () => {
  beforeEach(() => {
    ssmMock.reset();
  });

  it('should send SSM command and return commandId', async () => {
    ssmMock.on(SendCommandCommand).resolves({
      Command: { CommandId: 'cmd-abc123' },
    });

    const result = await lambdaHandler(TEST_INPUT, {} as never, vi.fn() as never);

    expect(result).toEqual(expect.objectContaining({ commandId: 'cmd-abc123' }));
    expect(ssmMock.calls()).toHaveLength(1);
    const call = ssmMock.call(0);
    expect(call.args[0].input).toEqual(
      expect.objectContaining({
        DocumentName: 'AWS-RunShellScript',
        InstanceIds: ['i-123'],
      }),
    );
  });

  it('should throw when CommandId is not returned', async () => {
    ssmMock.on(SendCommandCommand).resolves({ Command: {} });

    await expect(lambdaHandler(TEST_INPUT, {} as never, vi.fn() as never)).rejects.toThrow(
      'SSM SendCommand did not return a CommandId',
    );
  });

  it('should use modelName-modelId as the car folder name to prevent same-name collisions', async () => {
    ssmMock.on(SendCommandCommand).resolves({ Command: { CommandId: 'cmd-1' } });

    await lambdaHandler(TEST_INPUT, {} as never, vi.fn() as never);

    const input = ssmMock.call(0).args[0].input as { Parameters?: { commands?: string[] } };
    const script = (input.Parameters?.commands ?? []).join('\n');
    expect(script).toContain('/opt/aws/deepracer/artifacts/test-model-model-1/');
    expect(script).toContain('/tmp/test-model-model-1.tar.gz');
  });

  it('should give different folder names for same-named models with different modelIds', async () => {
    ssmMock.on(SendCommandCommand).resolves({ Command: { CommandId: 'cmd-1' } });

    await lambdaHandler(TEST_INPUT, {} as never, vi.fn() as never);
    await lambdaHandler({ ...TEST_INPUT, modelId: 'model-2' as never }, {} as never, vi.fn() as never);

    const input1 = ssmMock.call(0).args[0].input as { Parameters?: { commands?: string[] } };
    const input2 = ssmMock.call(1).args[0].input as { Parameters?: { commands?: string[] } };
    const script1 = (input1.Parameters?.commands ?? []).join('\n');
    const script2 = (input2.Parameters?.commands ?? []).join('\n');
    expect(script1).toContain('test-model-model-1');
    expect(script2).toContain('test-model-model-2');
  });
});
