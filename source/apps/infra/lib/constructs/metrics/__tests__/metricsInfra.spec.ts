// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { describe, it, expect, beforeAll } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { LogGroupsHelper } from '../../common/logGroupsHelper.js';
import { functionNamePrefix } from '../../common/nodeLambdaFunction.js';
import { MetricsInfra } from '../metricsInfra.js';

// Mock the LogGroupsHelper to avoid having the static log groups shared between stacks
vi.mock('#constructs/common/logGroupsHelper.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#constructs/common/logGroupsHelper.js')>();
  return {
    ...actual,
    LogGroupsHelper: {
      ...actual.LogGroupsHelper,
      getAllLogGroups: () => [],
      getOrCreateLogGroup: vi.fn().mockImplementation((scope, id, props) => {
        return {
          logGroupName: `mocked-log-group-${id}`,
          logGroupArn: `arn:aws:logs:us-east-1:123456789012:log-group:mocked-log-group-${id}`,
        };
      }),
    },
  };
});

describe('MetricsInfra', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    const dynamoDBTable = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    new MetricsInfra(stack, 'TestMetricsInfra', {
      solutionId: 'test-solution-id',
      solutionVersion: 'v1.0.0',
      dynamoDBTable,
      namespace: TEST_NAMESPACE,
    });

    template = Template.fromStack(stack);
  });

  it('should create metrics infrastructure with all components', () => {
    // There are 2 Lambda functions: DailyHeartbeat + MetricsReporter/ProcessSubscribedMetricsLogs
    expect(() => template.resourceCountIs('AWS::Lambda::Function', 2)).not.toThrow();
    expect(() => template.resourceCountIs('AWS::Scheduler::Schedule', 1)).not.toThrow();
  });

  it('should create daily heartbeat resources', () => {
    expect(() => template.resourceCountIs('AWS::Scheduler::Schedule', 1)).not.toThrow();

    expect(() =>
      template.hasResourceProperties('AWS::Scheduler::Schedule', {
        ScheduleExpression: 'cron(10 0 * * ? *)',
        State: 'ENABLED',
        Description: 'Triggers daily heartbeat function at 12:10 AM every day',
      }),
    ).not.toThrow();

    expect(() => template.resourceCountIs('AWS::IAM::Role', 3)).not.toThrow(); // Scheduler role + Lambda execution roles
  });

  it('should create metrics reporter with log subscription filters', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-ProcessSubscribedMetricsLogsFn`,
        Environment: {
          Variables: {
            SOLUTION_ID: 'test-solution-id',
            SOLUTION_VERSION: 'v1.0.0',
            METRICS_ENDPOINT: 'https://metrics.awssolutionsbuilder.com/generic',
          },
        },
      }),
    ).not.toThrow();

    // Verify Lambda permission for CloudWatch Logs
    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        Principal: 'logs.amazonaws.com',
      }),
    ).not.toThrow();
  });

  it('should apply condition aspect to all resources', () => {
    const resources = template.toJSON().Resources;
    const resourceKeys = Object.keys(resources);

    expect(resourceKeys.length).toBeGreaterThan(0);

    const resourcesWithConditions = resourceKeys.filter((key) =>
      resources[key].Condition?.includes('SendAnonymizedData'),
    );

    expect(resourcesWithConditions.length).toBeGreaterThan(0);
    // the table shouldn't have the condition
    expect(resourcesWithConditions.length + 1).toEqual(resourceKeys.length);
  });

  it('should grant DynamoDB read permissions to heartbeat function', () => {
    const templateJson = template.toJSON();
    const resources = templateJson.Resources || {};

    // Look for IAM policies that contain DynamoDB actions
    const hasDynamoDbPolicy = Object.values(resources).some((resource: unknown) => {
      const res = resource as Record<string, unknown>;
      if (res.Type !== 'AWS::IAM::Policy') return false;

      const props = res.Properties as Record<string, unknown>;
      const policyDoc = props?.PolicyDocument as Record<string, unknown>;
      const statements = policyDoc?.Statement;

      if (!Array.isArray(statements)) return false;

      return statements.some((statement: unknown) => {
        const stmt = statement as Record<string, unknown>;
        const actions = stmt.Action;
        if (!Array.isArray(actions)) return false;
        return actions.some((action: unknown) => typeof action === 'string' && action.startsWith('dynamodb:'));
      });
    });

    expect(hasDynamoDbPolicy).toBe(true);
  });

  describe('when anonymized data is disabled', () => {
    let templateDisabled: Template;

    beforeAll(() => {
      // Clear the static log groups array before creating the stack
      // @ts-expect-error - accessing private static property for testing
      LogGroupsHelper.logGroups = [];

      // Create a separate stack for testing disabled metrics
      const app = new App();
      const stack = new Stack(app, 'TestStackDisabled');

      // Create a test DynamoDB table
      const dynamoDBTable = new TableV2(stack, 'TestTable', {
        partitionKey: { name: 'pk', type: AttributeType.STRING },
        sortKey: { name: 'sk', type: AttributeType.STRING },
      });

      // Create the MetricsInfra construct with anonymized data disabled
      new MetricsInfra(stack, 'TestMetricsInfra', {
        solutionId: 'test-solution-id',
        solutionVersion: 'v1.0.0',
        dynamoDBTable,
        sendAnonymizedData: 'No',
        namespace: TEST_NAMESPACE,
      });

      // Generate the template for disabled metrics
      templateDisabled = Template.fromStack(stack);
    });

    it('should create condition that evaluates to false when anonymized data is disabled', () => {
      const templateJson = templateDisabled.toJSON();

      const conditions = templateJson.Conditions || {};
      const sendAnonymizedDataCondition = Object.keys(conditions).find((key) => key.includes('SendAnonymizedData'));

      const mappings = templateJson.Mappings || {};
      const anonymizedDataMapping = Object.keys(mappings).find((key) => key.includes('AnonymizedData'));

      expect(anonymizedDataMapping).toBeDefined();
      expect(mappings[anonymizedDataMapping as string]).toEqual({
        SendAnonymizedData: {
          Data: 'No',
        },
      });

      const resources = templateJson.Resources || {};
      const conditionalResources = Object.keys(resources).filter((key) =>
        resources[key].Condition?.includes('SendAnonymizedData'),
      );

      expect(conditionalResources.length).toBeGreaterThan(0);

      // All conditional resources should reference the same condition
      conditionalResources.forEach((resourceKey) => {
        expect(resources[resourceKey].Condition).toBe(sendAnonymizedDataCondition);
      });
    });
  });
});
