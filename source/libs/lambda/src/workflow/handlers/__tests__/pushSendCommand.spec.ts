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
  racerName: 'Test_Racer',
};

const getScript = (callIndex: number) =>
  ((ssmMock.call(callIndex).args[0].input as { Parameters?: { commands?: string[] } }).Parameters?.commands ?? []).join(
    '\n',
  );

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

  it('should use racerName_modelName_modelId as the car folder name', async () => {
    ssmMock.on(SendCommandCommand).resolves({ Command: { CommandId: 'cmd-1' } });

    await lambdaHandler(TEST_INPUT, {} as never, vi.fn() as never);

    const script = getScript(0);
    expect(script).toContain('/opt/aws/deepracer/artifacts/Test_Racer_test-model_model-1/');
    expect(script).toContain('/tmp/Test_Racer_test-model_model-1.tar.gz');
  });

  it('should give different folder names for same-named models with different modelIds', async () => {
    ssmMock.on(SendCommandCommand).resolves({ Command: { CommandId: 'cmd-1' } });

    await lambdaHandler(TEST_INPUT, {} as never, vi.fn() as never);
    await lambdaHandler({ ...TEST_INPUT, modelId: 'model-2' as never }, {} as never, vi.fn() as never);

    expect(getScript(0)).toContain('Test_Racer_test-model_model-1');
    expect(getScript(1)).toContain('Test_Racer_test-model_model-2');
  });

  it('should sanitize racerName and modelName and fall back to defaults', async () => {
    ssmMock.on(SendCommandCommand).resolves({ Command: { CommandId: 'cmd-1' } });

    await lambdaHandler({ ...TEST_INPUT, racerName: 'a b;$(x)', modelName: '../m' }, {} as never, vi.fn() as never);
    await lambdaHandler({ ...TEST_INPUT, racerName: undefined, modelName: undefined }, {} as never, vi.fn() as never);

    expect(getScript(0)).toContain('/opt/aws/deepracer/artifacts/abx_m_model-1/');
    expect(getScript(1)).toContain('/opt/aws/deepracer/artifacts/racer_model_model-1/');
  });
});
