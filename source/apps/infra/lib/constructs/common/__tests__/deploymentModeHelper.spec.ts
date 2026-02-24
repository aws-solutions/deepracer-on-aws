// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, it, expect, afterEach } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { DynamoDBTable } from '../../storage/dynamoDB.js';
import { getDeploymentMode, isDevMode } from '../deploymentModeHelper.js';
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

  const mockedActual = actual as LogGroupsModuleWithReset;
  mockedActual.LogGroupsHelper.reset = () => {
    // @ts-expect-error - accessing private static property for testing
    (mockedActual.LogGroupsHelper as LogGroupsHelper).logGroups = [];
    // @ts-expect-error - accessing private static property for testing
    (mockedActual.LogGroupsHelper as LogGroupsHelper).logGroupsByCategory = new Map();
  };

  return mockedActual;
});

describe('deploymentModeHelper', () => {
  afterEach(() => {
    asLogGroupsHelperWithReset().reset();
  });

  describe('getDeploymentMode', () => {
    it('should return empty string when DEPLOYMENT_MODE context is not set', () => {
      const app = new App();
      const stack = new Stack(app, 'TestStack');

      expect(getDeploymentMode(stack)).toBe('');
    });

    it('should return the DEPLOYMENT_MODE context value when set', () => {
      const app = new App({
        context: {
          DEPLOYMENT_MODE: 'dev',
        },
      });
      const stack = new Stack(app, 'TestStack');

      expect(getDeploymentMode(stack)).toBe('dev');
    });

    it('should return the exact value including case', () => {
      const app = new App({
        context: {
          DEPLOYMENT_MODE: 'PROD',
        },
      });
      const stack = new Stack(app, 'TestStack');

      expect(getDeploymentMode(stack)).toBe('PROD');
    });
  });

  describe('isDevMode', () => {
    it('should return false when DEPLOYMENT_MODE is not set', () => {
      const app = new App();
      const stack = new Stack(app, 'TestStack');

      expect(isDevMode(stack)).toBe(false);
    });

    it('should return true when DEPLOYMENT_MODE is "dev"', () => {
      const app = new App({
        context: {
          DEPLOYMENT_MODE: 'dev',
        },
      });
      const stack = new Stack(app, 'TestStack');

      expect(isDevMode(stack)).toBe(true);
    });

    it('should return true when DEPLOYMENT_MODE is "DEV" (case insensitive)', () => {
      const app = new App({
        context: {
          DEPLOYMENT_MODE: 'DEV',
        },
      });
      const stack = new Stack(app, 'TestStack');

      expect(isDevMode(stack)).toBe(true);
    });

    it('should return true when DEPLOYMENT_MODE is "Dev" (case insensitive)', () => {
      const app = new App({
        context: {
          DEPLOYMENT_MODE: 'Dev',
        },
      });
      const stack = new Stack(app, 'TestStack');

      expect(isDevMode(stack)).toBe(true);
    });

    it('should return false when DEPLOYMENT_MODE is "prod"', () => {
      const app = new App({
        context: {
          DEPLOYMENT_MODE: 'prod',
        },
      });
      const stack = new Stack(app, 'TestStack');

      expect(isDevMode(stack)).toBe(false);
    });

    it('should return false when DEPLOYMENT_MODE is empty string', () => {
      const app = new App({
        context: {
          DEPLOYMENT_MODE: '',
        },
      });
      const stack = new Stack(app, 'TestStack');

      expect(isDevMode(stack)).toBe(false);
    });
  });

  describe('DynamoDB table removal policy based on deployment mode', () => {
    it('should set RemovalPolicy.RETAIN when DEPLOYMENT_MODE is not set', () => {
      const app = new App();
      const stack = new Stack(app, 'TestStack');

      new DynamoDBTable(stack, 'TestDynamoDB', {
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(() => {
        template.hasResource('AWS::DynamoDB::GlobalTable', {
          DeletionPolicy: 'Retain',
          UpdateReplacePolicy: 'Retain',
        });
      }).not.toThrow();
    });

    it('should set RemovalPolicy.DESTROY when DEPLOYMENT_MODE is "dev"', () => {
      const app = new App({
        context: {
          DEPLOYMENT_MODE: 'dev',
        },
      });
      const stack = new Stack(app, 'TestStack');

      new DynamoDBTable(stack, 'TestDynamoDB', {
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(() => {
        template.hasResource('AWS::DynamoDB::GlobalTable', {
          DeletionPolicy: 'Delete',
          UpdateReplacePolicy: 'Delete',
        });
      }).not.toThrow();
    });

    it('should set RemovalPolicy.RETAIN when DEPLOYMENT_MODE is "prod"', () => {
      const app = new App({
        context: {
          DEPLOYMENT_MODE: 'prod',
        },
      });
      const stack = new Stack(app, 'TestStack');

      new DynamoDBTable(stack, 'TestDynamoDB', {
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(() => {
        template.hasResource('AWS::DynamoDB::GlobalTable', {
          DeletionPolicy: 'Retain',
          UpdateReplacePolicy: 'Retain',
        });
      }).not.toThrow();
    });
  });

  describe('LogGroup removal policy based on deployment mode', () => {
    it('should set RemovalPolicy.RETAIN when DEPLOYMENT_MODE is not set', () => {
      const app = new App();
      const stack = new Stack(app, 'TestStack');

      LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup', {
        logGroupCategory: LogGroupCategory.DEFAULT,
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(() => {
        template.hasResource('AWS::Logs::LogGroup', {
          DeletionPolicy: 'Retain',
          UpdateReplacePolicy: 'Retain',
        });
      }).not.toThrow();
    });

    it('should set RemovalPolicy.DESTROY when DEPLOYMENT_MODE is "dev"', () => {
      const app = new App({
        context: {
          DEPLOYMENT_MODE: 'dev',
        },
      });
      const stack = new Stack(app, 'TestStack');

      LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup', {
        logGroupCategory: LogGroupCategory.WORKFLOW,
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(() => {
        template.hasResource('AWS::Logs::LogGroup', {
          DeletionPolicy: 'Delete',
          UpdateReplacePolicy: 'Delete',
        });
      }).not.toThrow();
    });

    it('should set RemovalPolicy.RETAIN when DEPLOYMENT_MODE is "prod"', () => {
      const app = new App({
        context: {
          DEPLOYMENT_MODE: 'prod',
        },
      });
      const stack = new Stack(app, 'TestStack');

      LogGroupsHelper.getOrCreateLogGroup(stack, 'TestLogGroup', {
        logGroupCategory: LogGroupCategory.API,
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(() => {
        template.hasResource('AWS::Logs::LogGroup', {
          DeletionPolicy: 'Retain',
          UpdateReplacePolicy: 'Retain',
        });
      }).not.toThrow();
    });
  });
});
