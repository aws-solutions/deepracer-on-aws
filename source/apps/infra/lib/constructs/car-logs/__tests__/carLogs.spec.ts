// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { describe, expect, it } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { CarLogs } from '../carLogs.js';

describe('CarLogs', () => {
  const app = new App();
  const stack = new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'us-east-1' } });
  const carLogs = new CarLogs(stack, 'CarLogs', {
    namespace: TEST_NAMESPACE,
    dynamoDBTable: new TableV2(stack, 'Table', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    }),
    userPool: new UserPool(stack, 'UserPool'),
    encryptionKey: new Key(stack, 'Key'),
    deviceLogsBucket: new Bucket(stack, 'DeviceLogsBucket'),
    modelStorageBucket: new Bucket(stack, 'ModelBucket'),
    videoProcessorRepository: new Repository(stack, 'Repository'),
    videoProcessorImageTag: 'v1',
  });
  const template = Template.fromStack(stack);

  it('exposes a handler for each car log operation', () => {
    expect(Object.keys(carLogs.handlerArns).sort()).toEqual([
      'CreateCarLogUpload',
      'DeleteCarLogAsset',
      'GetCarLogAssetUrls',
      'GetCarLogFetch',
      'ListCarLogAssets',
      'ListCarLogFetches',
      'StartCarLogFetch',
    ]);
  });

  it('starts the workflow for archives that land under the manual upload prefix only', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Events::Rule', {
        EventPattern: {
          source: ['aws.s3'],
          'detail-type': ['Object Created'],
          detail: { object: { key: [{ prefix: 'staging/manual/' }] } },
        },
        Targets: [Match.objectLike({ InputTransformer: Match.anyValue() })],
      }),
    ).not.toThrow();
  });

  it('gives the API handlers the bucket name and the state machine ARN', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: Match.stringLikeRegexp('StartCarLogFetch'),
        Environment: {
          Variables: Match.objectLike({
            DEVICE_LOGS_BUCKET_NAME: Match.anyValue(),
            CAR_LOG_STATE_MACHINE_ARN: Match.anyValue(),
          }),
        },
      }),
    ).not.toThrow();
  });

  it('runs the video processor as a Fargate job without a NAT gateway', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
    expect(() =>
      template.hasResourceProperties('AWS::Batch::JobDefinition', {
        PlatformCapabilities: ['FARGATE'],
        ContainerProperties: Match.objectLike({
          NetworkConfiguration: { AssignPublicIp: 'ENABLED' },
          EphemeralStorage: { SizeInGiB: 100 },
        }),
      }),
    ).not.toThrow();
  });

  it('only allows HTTPS out of the Batch security group', () => {
    expect(() =>
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Car log video processor: HTTPS egress only',
        SecurityGroupEgress: [Match.objectLike({ FromPort: 443, ToPort: 443, IpProtocol: 'tcp' })],
      }),
    ).not.toThrow();
  });

  it('limits the job role to the car log prefixes of the logs bucket', () => {
    const policies = template.findResources('AWS::IAM::Policy', {
      Properties: { PolicyName: Match.stringLikeRegexp('JobRole') },
    });
    const statements = JSON.stringify(Object.values(policies));
    expect(statements).toContain('/job-configs/*');
    expect(statements).toContain('/carlogs/*/videos/*');
    expect(statements).not.toContain('"s3:DeleteObject"');
  });

  it('creates a state machine that submits the Batch job and registers the results', () => {
    const [stateMachine] = Object.values(template.findResources('AWS::StepFunctions::StateMachine'));
    const definition = JSON.stringify(stateMachine.Properties.DefinitionString);
    expect(definition).toContain('batch:submitJob.sync');
    expect(definition).toContain('QUEUED_FOR_PROCESSING');
    expect(definition).toContain('MarkFailed');
  });

  it('alarms on failed and timed out executions and on Lambda errors', () => {
    template.resourceCountIs('AWS::CloudWatch::CompositeAlarm', 1);
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', { MetricName: 'ExecutionsFailed' }),
    ).not.toThrow();
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', { MetricName: 'ExecutionsTimedOut' }),
    ).not.toThrow();
    expect(carLogs.alarms).toHaveLength(3);
  });
});
