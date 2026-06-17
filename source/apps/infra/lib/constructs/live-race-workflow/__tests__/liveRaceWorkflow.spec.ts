// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AttributeType, StreamViewType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { describe, expect, it } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { createNodeLambdaFunctionMock, createLogGroupsHelperMock } from '../../../constants/testMocks.js';
import { NodeLambdaFunction } from '../../common/nodeLambdaFunction.js';
import { LiveRaceWorkflow } from '../liveRaceWorkflow.js';

// Mock NodeLambdaFunction to use inline code instead of esbuild bundling.
vi.mock('../../common/nodeLambdaFunction.js', () => createNodeLambdaFunctionMock());

vi.mock('#constructs/common/kmsHelper.js', () => ({
  KmsHelper: {
    get: vi.fn(() => ({
      grantEncryptDecrypt: vi.fn(),
      keyId: 'mock-key-id',
      keyArn: 'arn:aws:kms:us-east-1:123456789012:key/mock-key-id',
    })),
  },
}));

// Mock the LogGroupsHelper to avoid having the static log groups shared between stacks
vi.mock('#constructs/common/logGroupsHelper.js', () => createLogGroupsHelperMock());

const fn = (name: string) => `${TEST_NAMESPACE}-${name}`;

describe('LiveRaceWorkflow', () => {
  let template: Template;

  beforeEach(() => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      dynamoStream: StreamViewType.NEW_AND_OLD_IMAGES,
    });

    const bucket = new Bucket(stack, 'TestBucket');

    const jobInitFn = new NodeLambdaFunction(stack, 'JobInitFn', {
      entry: require.resolve('../../common/nodeLambdaFunction.ts'),
      namespace: TEST_NAMESPACE,
    });
    const jobMonitorFn = new NodeLambdaFunction(stack, 'JobMonitorFn', {
      entry: require.resolve('../../common/nodeLambdaFunction.ts'),
      namespace: TEST_NAMESPACE,
    });
    const jobFinalizerFn = new NodeLambdaFunction(stack, 'JobFinalizerFn', {
      entry: require.resolve('../../common/nodeLambdaFunction.ts'),
      namespace: TEST_NAMESPACE,
    });

    new LiveRaceWorkflow(stack, 'TestLiveRace', {
      dynamoDBTable: table,
      modelStorageBucket: bucket,
      simAppRepositoryUri: 'test-repo-uri',
      namespace: TEST_NAMESPACE,
      jobInitializerFunction: jobInitFn,
      jobMonitorFunction: jobMonitorFn,
      jobFinalizerFunction: jobFinalizerFn,
    });

    template = Template.fromStack(stack);
  });

  it('creates the Step Function state machine', () => {
    expect(template).toBeDefined();
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      StateMachineName: fn('LiveRaceWorkflow'),
      TracingConfiguration: { Enabled: true },
    });
  });

  it('creates orchestration Lambda functions', () => {
    expect(template).toBeDefined();
    for (const name of ['GetNextPendingFn', 'CheckAutolaunchFn', 'UpdateQueueStatusFn', 'ClearExecutionLockFn']) {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: fn(`DeepRacerIndyLiveRace-${name}`),
      });
    }
  });

  it('creates StreamHandler with DynamoDB event source', () => {
    expect(template).toBeDefined();
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: fn('DeepRacerIndyLiveRace-StreamHandlerFn'),
    });
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BisectBatchOnFunctionError: true,
      MaximumRetryAttempts: 3,
      StartingPosition: 'LATEST',
    });
  });

  it('creates StreamHandler DLQ', () => {
    expect(template).toBeDefined();
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: fn('LiveRaceStreamDLQ'),
    });
  });

  it('creates SafetyNet with EventBridge rule', () => {
    expect(template).toBeDefined();
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: fn('DeepRacerIndyLiveRace-SafetyNetFn'),
    });
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['aws.states'],
        'detail-type': ['Step Functions Execution Status Change'],
        detail: {
          status: ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED_OUT'],
        },
      },
    });
  });

  it('passes SF ARN to StreamHandler environment', () => {
    expect(template).toBeDefined();
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: fn('DeepRacerIndyLiveRace-StreamHandlerFn'),
      Environment: {
        Variables: Match.objectLike({
          LIVE_RACE_STATE_MACHINE_ARN: Match.anyValue(),
        }),
      },
    });
  });
});
