// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Duration, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { describe, it, expect, beforeAll } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { functionNamePrefix } from '../../common/nodeLambdaFunction.js';
import { MonthlyQuotaReset } from '../monthlyQuotaReset';

describe('MonthlyQuotaReset', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    new MonthlyQuotaReset(stack, 'TestMonthlyQuotaReset', {
      dynamoDBTable: table,
      namespace: TEST_NAMESPACE,
    });

    template = Template.fromStack(stack);
  });

  it('creates a Lambda function with correct configuration', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-MonthlyQuotaResetFn`,
        Handler: 'index.lambdaHandler',
        Timeout: Duration.minutes(15).toSeconds(),
      }),
    ).not.toThrow();
  });

  it('creates an IAM role for EventBridge Scheduler', () => {
    expect(() =>
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'scheduler.amazonaws.com',
              },
            },
          ],
          Version: '2012-10-17',
        },
      }),
    ).not.toThrow();
  });

  it('creates IAM policy for Lambda invocation', () => {
    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Action: 'lambda:InvokeFunction',
              Effect: 'Allow',
              Resource: Match.anyValue(),
            },
          ]),
          Version: '2012-10-17',
        },
      }),
    ).not.toThrow();
  });

  it('creates EventBridge Schedule with correct configuration', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Scheduler::Schedule', {
        FlexibleTimeWindow: {
          Mode: 'FLEXIBLE',
          MaximumWindowInMinutes: 240,
        },
        ScheduleExpression: 'cron(0 0 1 * ? *)', // 1st of every month at midnight UTC
        State: 'ENABLED',
        Description: 'Triggers monthly quota reset function on the 1st of every month at midnight UTC',
        Target: {
          Arn: Match.anyValue(),
          RoleArn: Match.anyValue(),
        },
      }),
    ).not.toThrow();
  });

  it('grants DynamoDB permissions to Lambda function', () => {
    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:BatchGetItem',
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:Query',
                'dynamodb:GetItem',
                'dynamodb:Scan',
                'dynamodb:ConditionCheckItem',
                'dynamodb:BatchWriteItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:DescribeTable',
              ]),
              Effect: 'Allow',
              Resource: Match.anyValue(),
            }),
          ]),
          Version: '2012-10-17',
        },
      }),
    ).not.toThrow();
  });

  it('creates Lambda function with X-Ray tracing enabled', () => {
    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Action: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
              Effect: 'Allow',
              Resource: '*',
            },
          ]),
          Version: '2012-10-17',
        },
      }),
    ).not.toThrow();
  });

  it('creates all required resources', () => {
    expect(() => template.resourceCountIs('AWS::Lambda::Function', 1)).not.toThrow();
    expect(() => template.resourceCountIs('AWS::IAM::Role', 2)).not.toThrow();
    expect(() => template.resourceCountIs('AWS::Scheduler::Schedule', 1)).not.toThrow();
    expect(() => template.resourceCountIs('AWS::IAM::Policy', 2)).not.toThrow();
  });

  it('configures schedule target correctly', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Scheduler::Schedule', {
        Target: Match.objectLike({
          Arn: Match.anyValue(),
          RoleArn: Match.anyValue(),
        }),
      }),
    ).not.toThrow();
  });
});
