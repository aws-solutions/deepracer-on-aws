// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Key } from 'aws-cdk-lib/aws-kms';
import { describe, expect, it } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { DeviceManagement } from '../deviceManagement.js';

describe('DeviceManagement (Task 5 status pipeline wiring)', () => {
  const app = new App();
  const stack = new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'us-east-1' } });
  const dynamoDBTable = new TableV2(stack, 'Table', {
    partitionKey: { name: 'pk', type: AttributeType.STRING },
    sortKey: { name: 'sk', type: AttributeType.STRING },
  });
  const userPool = new UserPool(stack, 'UserPool');
  const encryptionKey = new Key(stack, 'Key');

  new DeviceManagement(stack, 'DeviceManagement', {
    namespace: TEST_NAMESPACE,
    dynamoDBTable,
    userPool,
    encryptionKey,
  });
  const template = Template.fromStack(stack);

  it('gathers application inventory for all managed devices so the software version can be read', () => {
    expect(() =>
      template.hasResourceProperties('AWS::SSM::Association', {
        Name: 'AWS-GatherSoftwareInventory',
        Targets: [{ Key: 'tag:deepracer:managed', Values: ['true'] }],
        Parameters: Match.objectLike({ applications: ['Enabled'] }),
      }),
    ).not.toThrow();
  });

  it('schedules the status poller every 5 minutes', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Events::Rule', {
        ScheduleExpression: 'rate(5 minutes)',
        Targets: Match.anyValue(),
      }),
    ).not.toThrow();
  });

  it('creates the EmergencyStopDispatchLatency alarm on the CommandDispatchLatency metric', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'CommandDispatchLatency',
        Namespace: 'DeepRacerIndyApi',
        ExtendedStatistic: 'p99',
        Threshold: 1000,
      }),
    ).not.toThrow();
  });

  it('creates the ActivationFailureRate alarm on the ActivationFailure metric', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'ActivationFailure',
        Namespace: 'DeepRacerIndyApi',
        Statistic: 'Sum',
        Threshold: 3,
      }),
    ).not.toThrow();
  });

  it('creates the SSMCommandCompletionLatency alarm on the state-change metric', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'SSMCommandCompletionLatency',
        Namespace: 'DeepRacerIndy',
        ExtendedStatistic: 'p99',
        Threshold: 10000,
      }),
    ).not.toThrow();
  });

  it('creates the DeviceOfflineRate alarm on the poller metric', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'DeviceOfflineRate',
        Namespace: 'DeepRacerIndy',
        Statistic: 'Average',
        Threshold: 90,
      }),
    ).not.toThrow();
  });

  it('creates the EmergencyStopFailure and DevicePruningFailure error alarms', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmDescription: 'Emergency Stop (StopDevice) Lambda reported errors',
      }),
    ).not.toThrow();
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmDescription: 'Device pruning Lambda reported errors',
      }),
    ).not.toThrow();
  });

  it('enables the SSM state-change rule and gives it a Lambda target', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Events::Rule', {
        EventPattern: { source: ['aws.ssm'] },
        State: 'ENABLED',
        Targets: Match.anyValue(),
      }),
    ).not.toThrow();
  });

  it('grants the status Lambdas SSM read/list permissions (design Role 7)', () => {
    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
              Action: Match.arrayWith(['ssm:DescribeInstanceInformation', 'ssm:ListTagsForResource']),
            }),
          ]),
        },
      }),
    ).not.toThrow();
  });

  it('grants the state-change Lambda GetCommandInvocation for async command results', () => {
    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({ Effect: 'Allow', Action: Match.arrayWith(['ssm:GetCommandInvocation']) }),
          ]),
        },
      }),
    ).not.toThrow();
  });
});
