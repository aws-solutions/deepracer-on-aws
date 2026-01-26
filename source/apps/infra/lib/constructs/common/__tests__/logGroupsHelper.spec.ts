// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_NAMESPACE } from '@deepracer-indy/config/src/defaults/commonDefaults';
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { LogGroupCategory, LogGroupsHelper } from '../logGroupsHelper.js';

// Mock the KmsHelper to avoid having the static KMS key shared between stacks
vi.mock('../kmsHelper.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../kmsHelper.js')>();
  const { Key } = await import('aws-cdk-lib/aws-kms');
  return {
    ...actual,
    KmsHelper: {
      ...actual.KmsHelper,
      get: vi.fn().mockImplementation((scope, namespace) => {
        throw new Error('Mock Key');
        return new Key(scope, `MockKmsKey${namespace}${Date.now()}`, {
          description: `Mock KMS key for testing ${namespace}`,
        });
      }),
    },
  };
});

type LogGroupsHelperWithReset = typeof LogGroupsHelper & {
  reset: () => void;
};

type LogGroupsModuleWithReset = typeof import('../logGroupsHelper.js') & {
  LogGroupsHelper: LogGroupsHelperWithReset;
};

const asLogGroupsHelperWithReset = (): LogGroupsHelperWithReset => {
  return LogGroupsHelper as LogGroupsHelperWithReset;
};

vi.mock('../logGroupsHelper.js', async () => {
  const actual = await vi.importActual('../logGroupsHelper.js');

  // Add reset method to the LogGroupsHelper class to reset the static collections
  // keeping track of log groups between tests
  const mockedActual = actual as LogGroupsModuleWithReset;
  mockedActual.LogGroupsHelper.reset = () => {
    // @ts-expect-error - accessing private static property for testing
    (mockedActual.LogGroupsHelper as LogGroupsHelper).logGroups = [];
    // @ts-expect-error - accessing private static property for testing
    (mockedActual.LogGroupsHelper as LogGroupsHelper).logGroupsByCategory = new Map();
  };

  return mockedActual;
});

describe('LogGroupsHelper', () => {
  let stack: Stack;

  beforeEach(() => {
    stack = new Stack();
  });

  afterEach(() => {
    asLogGroupsHelperWithReset().reset();
  });

  describe('getOrCreateLogGroup', () => {
    it('should create a new log group with default category when none exists', () => {
      const logGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup', {
        logGroupCategory: LogGroupCategory.DEFAULT,
        namespace: TEST_NAMESPACE,
      });

      expect(logGroup).toBeInstanceOf(LogGroup);

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${TEST_NAMESPACE}-${LogGroupCategory.DEFAULT}`,
      });
    });

    it('should create a new log group with specified category', () => {
      const logGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup', {
        logGroupCategory: LogGroupCategory.API,
        namespace: TEST_NAMESPACE,
      });

      expect(logGroup).toBeInstanceOf(LogGroup);

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${TEST_NAMESPACE}-${LogGroupCategory.API}`,
      });
    });

    it('should return existing log group when category already exists', () => {
      // Create first log group
      const logGroup1 = LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup1', {
        logGroupCategory: LogGroupCategory.WORKFLOW,
        namespace: TEST_NAMESPACE,
      });

      // Try to create another log group with same category
      const logGroup2 = LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup2', {
        logGroupCategory: LogGroupCategory.WORKFLOW,
        namespace: TEST_NAMESPACE,
      });

      // Should return the same instance
      expect(logGroup1).toBe(logGroup2);
      expect(logGroup1.logGroupName).toBe(logGroup2.logGroupName);

      // Should only create one log group resource
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });

    it('should create different log groups for different categories', () => {
      const apiLogGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'ApiLogGroup', {
        logGroupCategory: LogGroupCategory.API,
        namespace: TEST_NAMESPACE,
      });

      const workflowLogGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'WorkflowLogGroup', {
        logGroupCategory: LogGroupCategory.WORKFLOW,
        namespace: TEST_NAMESPACE,
      });

      expect(apiLogGroup).not.toBe(workflowLogGroup);

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Logs::LogGroup', 2);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${TEST_NAMESPACE}-${LogGroupCategory.API}`,
      });
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${TEST_NAMESPACE}-${LogGroupCategory.WORKFLOW}`,
      });
    });

    it('should use default namespace when none provided', () => {
      const logGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup', {
        logGroupCategory: LogGroupCategory.METRICS,
      });

      expect(logGroup).toBeInstanceOf(LogGroup);

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${DEFAULT_NAMESPACE}-${LogGroupCategory.METRICS}`,
      });
    });

    it('should create log group with function name when no category provided', () => {
      const functionName = 'MyTestFunction';
      const logGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup', {
        functionName,
      });

      expect(logGroup).toBeInstanceOf(LogGroup);

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${functionName}`,
      });
    });

    it('should throw error when no category and no function name provided', () => {
      expect(() => {
        LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup', {});
      }).toThrow('Cannot create log group: log group name is undefined');
    });

    it('should create log group in the correct stack', () => {
      const logGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup', {
        logGroupCategory: LogGroupCategory.ECR_IMAGES,
        namespace: TEST_NAMESPACE,
      });

      // Verify the log group is created in the correct stack
      expect(Stack.of(logGroup)).toBe(stack);
    });

    it('should set TEN_YEARS retention for security-related log group categories', () => {
      const apiLogGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'ApiLogGroup', {
        logGroupCategory: LogGroupCategory.API,
        namespace: TEST_NAMESPACE,
      });

      const userIdentityLogGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'UserIdentityLogGroup', {
        logGroupCategory: LogGroupCategory.USER_IDENTITY,
        namespace: TEST_NAMESPACE,
      });

      expect(apiLogGroup).toBeInstanceOf(LogGroup);
      expect(userIdentityLogGroup).toBeInstanceOf(LogGroup);

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${TEST_NAMESPACE}-${LogGroupCategory.API}`,
        RetentionInDays: RetentionDays.TEN_YEARS,
      });

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${TEST_NAMESPACE}-${LogGroupCategory.USER_IDENTITY}`,
        RetentionInDays: RetentionDays.TEN_YEARS,
      });
    });

    it('should set default TWO_YEARS retention for non-security-related log group categories', () => {
      const workflowLogGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'WorkflowLogGroup', {
        logGroupCategory: LogGroupCategory.WORKFLOW,
        namespace: TEST_NAMESPACE,
      });

      const metricsLogGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'MetricsLogGroup', {
        logGroupCategory: LogGroupCategory.METRICS,
        namespace: TEST_NAMESPACE,
      });

      const defaultLogGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'DefaultLogGroup', {
        logGroupCategory: LogGroupCategory.DEFAULT,
        namespace: TEST_NAMESPACE,
      });

      expect(workflowLogGroup).toBeInstanceOf(LogGroup);
      expect(metricsLogGroup).toBeInstanceOf(LogGroup);
      expect(defaultLogGroup).toBeInstanceOf(LogGroup);

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${TEST_NAMESPACE}-${LogGroupCategory.WORKFLOW}`,
        RetentionInDays: RetentionDays.TWO_YEARS,
      });

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${TEST_NAMESPACE}-${LogGroupCategory.METRICS}`,
        RetentionInDays: RetentionDays.TWO_YEARS,
      });

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${TEST_NAMESPACE}-${LogGroupCategory.DEFAULT}`,
        RetentionInDays: RetentionDays.TWO_YEARS,
      });
    });

    it('should use custom retention when explicitly provided', () => {
      const customLogGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'CustomRetentionLogGroup', {
        logGroupCategory: LogGroupCategory.API,
        namespace: TEST_NAMESPACE,
        retention: RetentionDays.ONE_MONTH,
      });

      expect(customLogGroup).toBeInstanceOf(LogGroup);

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${TEST_NAMESPACE}-${LogGroupCategory.API}`,
        RetentionInDays: RetentionDays.ONE_MONTH,
      });
    });
  });

  describe('getAllLogGroups', () => {
    it('should return empty array when no log groups created', () => {
      const logGroups = LogGroupsHelper.getAllLogGroups();
      expect(logGroups).toEqual([]);
    });

    it('should return all created log groups', () => {
      const logGroup1 = LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup1', {
        logGroupCategory: LogGroupCategory.API,
        namespace: TEST_NAMESPACE,
      });

      const logGroup2 = LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup2', {
        logGroupCategory: LogGroupCategory.WORKFLOW,
        namespace: TEST_NAMESPACE,
      });

      const allLogGroups = LogGroupsHelper.getAllLogGroups();
      expect(allLogGroups).toHaveLength(2);
      expect(allLogGroups).toContain(logGroup1);
      expect(allLogGroups).toContain(logGroup2);
    });

    it('should return a copy of the array (not the original)', () => {
      LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup', {
        logGroupCategory: LogGroupCategory.METRICS,
        namespace: TEST_NAMESPACE,
      });

      const logGroups1 = LogGroupsHelper.getAllLogGroups();
      const logGroups2 = LogGroupsHelper.getAllLogGroups();

      // Should be different array instances
      expect(logGroups1).not.toBe(logGroups2);
      // But should have the same content
      expect(logGroups1).toEqual(logGroups2);
    });

    it('should not include duplicate log groups when same category requested multiple times', () => {
      LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup1', {
        logGroupCategory: LogGroupCategory.SCHEDULED,
        namespace: TEST_NAMESPACE,
      });

      // Request same category again - should return existing log group
      LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup2', {
        logGroupCategory: LogGroupCategory.SCHEDULED,
        namespace: TEST_NAMESPACE,
      });

      const allLogGroups = LogGroupsHelper.getAllLogGroups();
      expect(allLogGroups).toHaveLength(1);
    });
  });

  describe('LogGroupCategory enum', () => {
    it('should have all expected categories', () => {
      expect(LogGroupCategory.API).toBe('DeepRacerApis');
      expect(LogGroupCategory.WORKFLOW).toBe('DeepRacerWorkflow');
      expect(LogGroupCategory.SCHEDULED).toBe('DeepRacerScheduled');
      expect(LogGroupCategory.DEFAULT).toBe('DeepRacerDefault');
      expect(LogGroupCategory.ECR_IMAGES).toBe('DeepRacerEcrImages');
      expect(LogGroupCategory.USER_IDENTITY).toBe('DeepRacerUserIdentity');
      expect(LogGroupCategory.METRICS).toBe('DeepRacerMetrics');
      expect(LogGroupCategory.SYSTEM_EVENTS).toBe('DeepRacerSystemEvents');
    });
  });

  describe('static state management', () => {
    it('should maintain state across multiple calls', () => {
      // Create log groups in different categories
      const apiLogGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'ApiLogGroup', {
        logGroupCategory: LogGroupCategory.API,
        namespace: TEST_NAMESPACE,
      });

      const workflowLogGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'WorkflowLogGroup', {
        logGroupCategory: LogGroupCategory.WORKFLOW,
        namespace: TEST_NAMESPACE,
      });

      // Verify state is maintained
      expect(LogGroupsHelper.getAllLogGroups()).toHaveLength(2);

      // Request existing categories - should return same instances
      const apiLogGroup2 = LogGroupsHelper.getOrCreateLogGroup(stack, 'ApiLogGroup2', {
        logGroupCategory: LogGroupCategory.API,
        namespace: TEST_NAMESPACE,
      });

      const workflowLogGroup2 = LogGroupsHelper.getOrCreateLogGroup(stack, 'WorkflowLogGroup2', {
        logGroupCategory: LogGroupCategory.WORKFLOW,
        namespace: TEST_NAMESPACE,
      });

      expect(apiLogGroup).toBe(apiLogGroup2);
      expect(workflowLogGroup).toBe(workflowLogGroup2);
      expect(LogGroupsHelper.getAllLogGroups()).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string function name', () => {
      expect(() => {
        LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup', {
          functionName: '',
        });
      }).toThrow('Cannot create log group: log group name is undefined');
    });

    it('should handle all LogGroupCategory values', () => {
      const categories = Object.values(LogGroupCategory);

      categories.forEach((category, index) => {
        const logGroup = LogGroupsHelper.getOrCreateLogGroup(stack, `TestLogGroup${index}`, {
          logGroupCategory: category,
          namespace: TEST_NAMESPACE,
        });

        expect(logGroup).toBeInstanceOf(LogGroup);
      });

      expect(LogGroupsHelper.getAllLogGroups()).toHaveLength(categories.length);

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Logs::LogGroup', categories.length);

      // Verify each category creates the correct log group
      categories.forEach((category) => {
        template.hasResourceProperties('AWS::Logs::LogGroup', {
          LogGroupName: `/aws/lambda/${TEST_NAMESPACE}-${category}`,
        });
      });
    });

    it('should handle special characters in namespace', () => {
      const specialNamespace = 'test-namespace_123';
      const logGroup = LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup', {
        logGroupCategory: LogGroupCategory.DEFAULT,
        namespace: specialNamespace,
      });

      expect(logGroup).toBeInstanceOf(LogGroup);

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/${specialNamespace}-${LogGroupCategory.DEFAULT}`,
      });
    });
  });
});
