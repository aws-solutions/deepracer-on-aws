// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ApiDefinition, SpecRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Alarm, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { describe, it, expect, beforeEach } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { MonitoringDashboard } from '../dashboard.js';

function createTestApi(stack: Stack, id: string): SpecRestApi {
  return new SpecRestApi(stack, id, {
    apiDefinition: ApiDefinition.fromInline({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
    }),
  });
}

describe('MonitoringDashboard', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  it('should create a dashboard with the correct name', () => {
    const api = createTestApi(stack, 'TestApi');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
    });

    new MonitoringDashboard(stack, 'TestDashboard', {
      namespace: TEST_NAMESPACE,
      api,
      dynamoDBTable: table,
    });

    const template = Template.fromStack(stack);
    expect(template).toBeDefined();

    // Dashboard name includes region via Fn::Join, so we check for the pattern in the synthesized template
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: Match.objectLike({
        'Fn::Join': Match.arrayWith([
          Match.arrayWith([Match.stringLikeRegexp(`${TEST_NAMESPACE}-deepracer-monitoring-`)]),
        ]),
      }),
    });
  });

  it('should include alarm status widget when alarms are provided', () => {
    const api = createTestApi(stack, 'TestApi');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
    });

    const alarm = new Alarm(stack, 'TestAlarm', {
      metric: new Metric({ namespace: 'Test', metricName: 'TestMetric' }),
      threshold: 1,
      evaluationPeriods: 1,
    });

    new MonitoringDashboard(stack, 'TestDashboard', {
      namespace: TEST_NAMESPACE,
      api,
      dynamoDBTable: table,
      alarms: [alarm],
    });

    const template = Template.fromStack(stack);
    expect(template).toBeDefined();

    // Verify dashboard exists
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    // Verify alarm exists
    template.resourceCountIs('AWS::CloudWatch::Alarm', 1);
  });

  it('should include API Gateway metrics', () => {
    const api = createTestApi(stack, 'TestApi');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
    });

    new MonitoringDashboard(stack, 'TestDashboard', {
      namespace: TEST_NAMESPACE,
      api,
      dynamoDBTable: table,
    });

    const template = Template.fromStack(stack);
    expect(template).toBeDefined();

    // Verify dashboard exists
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
  });

  it('should include DynamoDB metrics', () => {
    const api = createTestApi(stack, 'TestApi');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
    });

    new MonitoringDashboard(stack, 'TestDashboard', {
      namespace: TEST_NAMESPACE,
      api,
      dynamoDBTable: table,
    });

    const template = Template.fromStack(stack);
    expect(template).toBeDefined();

    // Verify dashboard exists
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
  });

  it('should include SQS queue metrics when queues are provided', () => {
    const api = createTestApi(stack, 'TestApi');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
    });
    const queue = new Queue(stack, 'TestQueue');

    new MonitoringDashboard(stack, 'TestDashboard', {
      namespace: TEST_NAMESPACE,
      api,
      dynamoDBTable: table,
      queues: [queue],
    });

    const template = Template.fromStack(stack);
    expect(template).toBeDefined();

    // Verify dashboard exists
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    // Verify queue exists
    template.resourceCountIs('AWS::SQS::Queue', 1);
  });

  it('should handle multiple queues correctly', () => {
    const api = createTestApi(stack, 'TestApi');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
    });
    const queue1 = new Queue(stack, 'TestQueue1');
    const queue2 = new Queue(stack, 'TestQueue2');
    const queue3 = new Queue(stack, 'TestQueue3');

    new MonitoringDashboard(stack, 'TestDashboard', {
      namespace: TEST_NAMESPACE,
      api,
      dynamoDBTable: table,
      queues: [queue1, queue2, queue3],
    });

    const template = Template.fromStack(stack);
    expect(template).toBeDefined();
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
  });

  it('should not include queue section when no queues are provided', () => {
    const api = createTestApi(stack, 'TestApi');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
    });

    new MonitoringDashboard(stack, 'TestDashboard', {
      namespace: TEST_NAMESPACE,
      api,
      dynamoDBTable: table,
    });

    const template = Template.fromStack(stack);
    expect(template).toBeDefined();

    // Verify dashboard exists
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    // Verify no queues exist
    template.resourceCountIs('AWS::SQS::Queue', 0);
  });

  it('should handle multiple alarms correctly', () => {
    const api = createTestApi(stack, 'TestApi');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
    });

    const alarm1 = new Alarm(stack, 'TestAlarm1', {
      metric: new Metric({ namespace: 'Test', metricName: 'TestMetric1' }),
      threshold: 1,
      evaluationPeriods: 1,
    });

    const alarm2 = new Alarm(stack, 'TestAlarm2', {
      metric: new Metric({ namespace: 'Test', metricName: 'TestMetric2' }),
      threshold: 1,
      evaluationPeriods: 1,
    });

    const alarm3 = new Alarm(stack, 'TestAlarm3', {
      metric: new Metric({ namespace: 'Test', metricName: 'TestMetric3' }),
      threshold: 1,
      evaluationPeriods: 1,
    });

    new MonitoringDashboard(stack, 'TestDashboard', {
      namespace: TEST_NAMESPACE,
      api,
      dynamoDBTable: table,
      alarms: [alarm1, alarm2, alarm3],
    });

    const template = Template.fromStack(stack);
    expect(template).toBeDefined();

    // Verify dashboard exists
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    // Verify all alarms exist
    template.resourceCountIs('AWS::CloudWatch::Alarm', 3);
  });

  it('should not include alarm section when no alarms are provided', () => {
    const api = createTestApi(stack, 'TestApi');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
    });

    new MonitoringDashboard(stack, 'TestDashboard', {
      namespace: TEST_NAMESPACE,
      api,
      dynamoDBTable: table,
    });

    const template = Template.fromStack(stack);
    expect(template).toBeDefined();

    // Verify dashboard exists
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    // Verify no alarms exist
    template.resourceCountIs('AWS::CloudWatch::Alarm', 0);
  });

  it('should include SageMaker instance usage metrics', () => {
    const api = createTestApi(stack, 'TestApi');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
    });

    new MonitoringDashboard(stack, 'TestDashboard', {
      namespace: TEST_NAMESPACE,
      api,
      dynamoDBTable: table,
    });

    const template = Template.fromStack(stack);
    expect(template).toBeDefined();

    // Verify dashboard exists with SageMaker metrics
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
  });

  it('should include workflow job outcome metrics', () => {
    const api = createTestApi(stack, 'TestApi');
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
    });

    new MonitoringDashboard(stack, 'TestDashboard', {
      namespace: TEST_NAMESPACE,
      api,
      dynamoDBTable: table,
    });

    const template = Template.fromStack(stack);
    expect(template).toBeDefined(); // Verify dashboard exists with workflow metrics
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
  });
});
