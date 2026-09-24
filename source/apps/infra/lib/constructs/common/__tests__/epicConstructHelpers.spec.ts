// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Key } from 'aws-cdk-lib/aws-kms';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { describe, it, expect, beforeAll } from 'vitest';

import { createEpicFunctions, epicLambdaFunctionName, lambdaEntryPath } from '../epicConstructHelpers.js';

vi.mock('../nodeLambdaFunction.js', async () => {
  const { createNodeLambdaFunctionMock } = await import('../../../constants/testMocks.js');
  return createNodeLambdaFunctionMock();
});
vi.mock('../kmsHelper.js', async () => {
  const { createKmsHelperMock } = await import('../../../constants/testMocks.js');
  return createKmsHelperMock();
});
vi.mock('../logGroupsHelper.js', async () => {
  const { createLogGroupsHelperMock } = await import('../../../constants/testMocks.js');
  return createLogGroupsHelperMock();
});

// Simulate the __dirname of a construct file located at:
//   source/apps/infra/lib/constructs/event-management/eventManagement.ts
// From __tests__/ (inside common/), go up 2 levels to reach constructs/, then into event-management/
const MOCK_CONSTRUCT_DIR = path.join(
  __dirname, // source/apps/infra/lib/constructs/common/__tests__
  '../../event-management', // → source/apps/infra/lib/constructs/event-management
);

// ── lambdaEntryPath ────────────────────────────────────────────────────────────

describe('lambdaEntryPath', () => {
  it('resolves to the correct absolute path for a handler', () => {
    const result = lambdaEntryPath(MOCK_CONSTRUCT_DIR, 'api/handlers/createEvent');
    expect(result).toContain(path.join('source', 'libs', 'lambda', 'src', 'api', 'handlers', 'createEvent.ts'));
    expect(result.endsWith('.ts')).toBe(true);
  });

  it('appends .ts extension to the handler relative path', () => {
    const result = lambdaEntryPath(MOCK_CONSTRUCT_DIR, 'api/handlers/getEvent');
    expect(result.endsWith('getEvent.ts')).toBe(true);
  });

  it('resolves to a path under source/ not the workspace root', () => {
    const result = lambdaEntryPath(MOCK_CONSTRUCT_DIR, 'api/handlers/createEvent');
    expect(result).toContain(`${path.sep}source${path.sep}`);
  });

  it('produces the same path as the api.ts 5-level relative approach', () => {
    const apiConstructDir = path.join(MOCK_CONSTRUCT_DIR, '../api');
    const apiStylePath = path.join(apiConstructDir, '../../../../../libs/lambda/src', 'api/handlers/createEvent.ts');
    const helperPath = lambdaEntryPath(MOCK_CONSTRUCT_DIR, 'api/handlers/createEvent');
    expect(helperPath).toBe(apiStylePath);
  });
});

// ── epicLambdaFunctionName ─────────────────────────────────────────────────────

describe('epicLambdaFunctionName', () => {
  it('prefixes with DeepRacerIndyApi- and suffixes with Function', () => {
    expect(epicLambdaFunctionName('CreateEvent')).toBe('DeepRacerIndyApi-CreateEventFunction');
  });

  it('handles any operation name', () => {
    expect(epicLambdaFunctionName('GetEventStatistics')).toBe('DeepRacerIndyApi-GetEventStatisticsFunction');
  });

  it('matches the naming convention used in api.ts', () => {
    const operation = 'TransitionEventStatus';
    expect(epicLambdaFunctionName(operation)).toBe(`DeepRacerIndyApi-${operation}Function`);
  });
});

// ── createEpicFunctions ────────────────────────────────────────────────────────

const TEST_ENTRY_POINTS = {
  OpAlpha: 'api/handlers/createEvent',
  OpBeta: 'api/handlers/getEvent',
} as const;

describe('createEpicFunctions', () => {
  let stack: Stack;
  let template: Template;

  beforeAll(() => {
    const app = new App();
    stack = new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'us-east-1' } });

    const dynamoDBTable = new TableV2(stack, 'Table', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
    });
    const userPool = new UserPool(stack, 'Pool');
    const encryptionKey = Key.fromKeyArn(stack, 'TestKey', 'arn:aws:kms:us-east-1:123456789012:key/test-key-id');

    createEpicFunctions(stack, MOCK_CONSTRUCT_DIR, TEST_ENTRY_POINTS, {
      namespace: 'test',
      stackKey: 'eventManagement',
      dynamoDBTable,
      userPool,
      encryptionKey,
      extraEnv: { MY_EXTRA: 'value' },
    });

    template = Template.fromStack(stack);
  });

  it('creates one Lambda function per entry point', () => {
    template.resourceCountIs('AWS::Lambda::Function', Object.keys(TEST_ENTRY_POINTS).length);
    expect(template).toBeDefined();
  });

  it('creates no API Gateway invoke permissions — the gateway stack owns those', () => {
    // permission ownership follows API ownership, so this factory must not grant invoke rights.
    template.resourceCountIs('AWS::Lambda::Permission', 0);
    expect(template).toBeDefined();
  });

  it('grants DynamoDB read/write to functions (IAM policy present)', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const hasTablePolicy = Object.values(policies).some((p) => JSON.stringify(p).includes('dynamodb:'));
    expect(hasTablePolicy).toBe(true);
  });

  it('grants Cognito profile and group lookup permissions on the user pool', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const policyJson = JSON.stringify(policies);
    expect(policyJson).toContain('cognito-idp:ListUsers');
    expect(policyJson).toContain('cognito-idp:AdminListGroupsForUser');
    expect(policyJson).toContain('userpool');
  });

  it('merges extraEnv into Lambda environment', () => {
    const functions = template.findResources('AWS::Lambda::Function');
    const templateJson = JSON.stringify(functions);
    expect(templateJson).toContain('MY_EXTRA');
    expect(templateJson).toContain('value');
  });

  it('defaults the shared per-epic LogGroup retention to TEN_YEARS when logRetention is not provided', () => {
    template.resourceCountIs('AWS::Logs::LogGroup', 1);
    const logGroups = template.findResources('AWS::Logs::LogGroup');
    const allTenYears = Object.values(logGroups).every((lg) => lg.Properties?.RetentionInDays === 3653);
    expect(allTenYears).toBe(true);
  });
});

describe('createEpicFunctions with an explicit logRetention override', () => {
  let overrideTemplate: Template;

  beforeAll(() => {
    const app = new App();
    const overrideStack = new Stack(app, 'TestStackWithRetentionOverride', {
      env: { account: '123456789012', region: 'us-east-1' },
    });

    const dynamoDBTable = new TableV2(overrideStack, 'Table', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
    });
    const userPool = new UserPool(overrideStack, 'Pool');
    const encryptionKey = Key.fromKeyArn(
      overrideStack,
      'TestKey',
      'arn:aws:kms:us-east-1:123456789012:key/test-key-id',
    );

    createEpicFunctions(overrideStack, MOCK_CONSTRUCT_DIR, TEST_ENTRY_POINTS, {
      namespace: 'test',
      stackKey: 'eventManagement',
      dynamoDBTable,
      userPool,
      encryptionKey,
      logRetention: RetentionDays.THREE_MONTHS,
    });

    overrideTemplate = Template.fromStack(overrideStack);
  });

  it('applies the provided logRetention to the shared per-epic LogGroup', () => {
    overrideTemplate.resourceCountIs('AWS::Logs::LogGroup', 1);
    const logGroups = overrideTemplate.findResources('AWS::Logs::LogGroup');
    const allNinetyDays = Object.values(logGroups).every((lg) => lg.Properties?.RetentionInDays === 90);
    expect(allNinetyDays).toBe(true);
  });
});
