// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AttributeType, StreamViewType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { describe, expect, it } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { createNodeLambdaFunctionMock } from '../../../constants/testMocks.js';
import { NodeLambdaFunction } from '../../common/nodeLambdaFunction.js';
import { LiveRaceEvents } from '../liveRaceEvents.js';

// Mock NodeLambdaFunction to use inline code instead of esbuild bundling.
vi.mock('../../common/nodeLambdaFunction.js', () => createNodeLambdaFunctionMock());

describe('LiveRaceEvents', () => {
  const app = new App();
  const stack = new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'us-east-1' } });

  const dynamoDBTable = new TableV2(stack, 'TestTable', {
    partitionKey: { name: 'pk', type: AttributeType.STRING },
    sortKey: { name: 'sk', type: AttributeType.STRING },
    dynamoStream: StreamViewType.NEW_AND_OLD_IMAGES,
  });

  // Stand-in for the AttachPolicy Lambda (normally created by ApiConstruct).
  // vi.mock above replaces NodeLambdaFunction with an inline-code variant to avoid esbuild.
  const attachPolicyFunction = new NodeLambdaFunction(stack, 'AttachPolicyFn', {
    entry: 'index.ts',
    functionName: 'AttachPolicyFn',
  });

  new LiveRaceEvents(stack, 'LiveRaceEvents', {
    namespace: TEST_NAMESPACE,
    dynamoDBTable,
    attachPolicyFunctionName: attachPolicyFunction.functionName,
  });

  const template = Template.fromStack(stack);

  it('creates the IoT spectator policy with correct document', () => {
    expect(() =>
      template.hasResourceProperties('AWS::IoT::Policy', {
        PolicyName: `${TEST_NAMESPACE}-SpectatorIoTPolicy`,
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({ Effect: 'Allow', Action: 'iot:Connect' }),
            Match.objectLike({ Effect: 'Allow', Action: 'iot:Subscribe' }),
            Match.objectLike({ Effect: 'Allow', Action: 'iot:Receive' }),
            Match.objectLike({ Effect: 'Deny', Action: 'iot:Publish' }),
          ]),
        },
      }),
    ).not.toThrow();
  });

  it('creates the AwsCustomResource for IoT endpoint discovery', () => {
    expect(() =>
      template.hasResourceProperties('Custom::AWS', {
        Create: Match.serializedJson(
          Match.objectLike({
            service: 'IoT',
            action: 'describeEndpoint',
            parameters: { endpointType: 'iot:Data-ATS' },
          }),
        ),
      }),
    ).not.toThrow();
  });

  it('outputs the IoT endpoint via CfnOutput', () => {
    const outputs = Object.keys(template.toJSON().Outputs ?? {});
    expect(outputs.some((k) => k.includes('IoTEndpointOutput'))).toBe(true);
  });

  it('creates the DeleteIoTPolicy custom resource with policyName property', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
        policyName: `${TEST_NAMESPACE}-SpectatorIoTPolicy`,
      }),
    ).not.toThrow();
  });

  it('grants iot:ListTargetsForPolicy and iot:DetachPolicy to onEvent Lambda, iot:DeletePolicy to isComplete Lambda', () => {
    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['iot:ListTargetsForPolicy', 'iot:DetachPolicy']),
              Effect: 'Allow',
            }),
          ]),
        },
      }),
    ).not.toThrow();
    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([Match.objectLike({ Action: 'iot:DeletePolicy', Effect: 'Allow' })]),
        },
      }),
    ).not.toThrow();
  });

  it('creates the LiveBroadcastHandler Lambda', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: Match.stringLikeRegexp('LiveRace-BroadcastHandler'),
      }),
    ).not.toThrow();
  });

  it('grants iot:Publish to LiveBroadcastHandler scoped to topic prefix', () => {
    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'iot:Publish',
              Effect: 'Allow',
              Resource: Match.anyValue(),
            }),
          ]),
        },
      }),
    ).not.toThrow();
  });

  it('creates a DDB stream event source mapping with MaximumBatchingWindowInSeconds 1', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
        StartingPosition: 'LATEST',
        MaximumBatchingWindowInSeconds: 1,
        MaximumRetryAttempts: 3,
        BisectBatchOnFunctionError: true,
        FunctionResponseTypes: ['ReportBatchItemFailures'],
      }),
    ).not.toThrow();
  });

  it('creates a broadcast DLQ', () => {
    expect(() =>
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: `${TEST_NAMESPACE}-LiveRaceBroadcastDLQ`,
      }),
    ).not.toThrow();
  });

  it('creates a CloudWatch alarm on the broadcast DLQ', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        ComparisonOperator: 'GreaterThanThreshold',
        Threshold: 0,
        EvaluationPeriods: 1,
        TreatMissingData: 'notBreaching',
      }),
    ).not.toThrow();
  });

  it('creates a PublishFailure alarm on the DeepRacerIndy custom metric', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        Namespace: 'DeepRacerIndy',
        MetricName: 'IoTPublishFailure',
        Statistic: 'Sum',
        Threshold: 0,
        EvaluationPeriods: 3,
        ComparisonOperator: 'GreaterThanThreshold',
        TreatMissingData: 'notBreaching',
      }),
    ).not.toThrow();
  });

  it('creates a PublishLatency P99 alarm on the DeepRacerIndy custom metric', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        Namespace: 'DeepRacerIndy',
        MetricName: 'IoTPublishLatency',
        ExtendedStatistic: 'p99',
        Threshold: 1000,
        EvaluationPeriods: 3,
        ComparisonOperator: 'GreaterThanThreshold',
        TreatMissingData: 'notBreaching',
      }),
    ).not.toThrow();
  });

  it('creates an AuthorizerErrors alarm on the AttachPolicy Lambda error metric', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        Namespace: 'AWS/Lambda',
        MetricName: 'Errors',
        Threshold: 10,
        EvaluationPeriods: 3,
        ComparisonOperator: 'GreaterThanThreshold',
        TreatMissingData: 'notBreaching',
      }),
    ).not.toThrow();
  });
});
