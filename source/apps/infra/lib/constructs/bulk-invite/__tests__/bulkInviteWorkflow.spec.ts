// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { beforeEach, describe, expect, it } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import {
  createKmsHelperMock,
  createLogGroupsHelperMock,
  createNodeLambdaFunctionMock,
} from '../../../constants/testMocks.js';
import { BulkInviteWorkflow } from '../bulkInviteWorkflow.js';

// Use inline Lambda code instead of esbuild bundling.
vi.mock('../../common/nodeLambdaFunction.js', () => createNodeLambdaFunctionMock());
vi.mock('#constructs/common/logGroupsHelper.js', () => createLogGroupsHelperMock());
vi.mock('#constructs/common/kmsHelper.js', () => createKmsHelperMock());

describe('BulkInviteWorkflow', () => {
  let template: Template;

  beforeEach(() => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });
    const userPool = new UserPool(stack, 'TestPool');

    new BulkInviteWorkflow(stack, 'TestBulkInvite', {
      namespace: TEST_NAMESPACE,
      dynamoDBTable: table,
      userPool,
    });

    template = Template.fromStack(stack);
  });

  it('creates a Standard Step Functions state machine', () => {
    expect(() =>
      template.hasResourceProperties(
        'AWS::StepFunctions::StateMachine',
        Match.objectLike({ StateMachineType: 'STANDARD' }),
      ),
    ).not.toThrow();
  });

  it('processes entries via an inline Map at MaxConcurrency 1', () => {
    const machines = template.findResources('AWS::StepFunctions::StateMachine');
    // DefinitionString is an Fn::Join; strip the JSON escaping so the ASL tokens are matchable.
    const definition = JSON.stringify(Object.values(machines)[0].Properties.DefinitionString).replace(/\\/g, '');
    expect(definition).toContain('"Type":"Map"');
    expect(definition).toContain('"MaxConcurrency":1');
    expect(definition).toContain('"Mode":"INLINE"');
  });

  it('creates the execution-failed (secondary), execution-timed-out, job-failed, orphaned-user, and high-failure-rate alarms', () => {
    expect(() => template.resourceCountIs('AWS::CloudWatch::Alarm', 5)).not.toThrow();
    // The primary FAILED-job signal: a plain-metric alarm on BulkInviteJobFailed.
    expect(() =>
      template.hasResourceProperties(
        'AWS::CloudWatch::Alarm',
        Match.objectLike({ MetricName: 'BulkInviteJobFailed', Namespace: 'DeepRacerIndyBulkInvite' }),
      ),
    ).not.toThrow();
    // Runaway-execution guard: alarms on the state machine's native ExecutionsTimedOut metric
    // (distinct from ExecutionsFailed), covering the 20-minute execution timeout.
    expect(() =>
      template.hasResourceProperties(
        'AWS::CloudWatch::Alarm',
        Match.objectLike({ MetricName: 'ExecutionsTimedOut', Namespace: 'AWS/States' }),
      ),
    ).not.toThrow();
  });
});
