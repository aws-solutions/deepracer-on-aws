// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Key } from 'aws-cdk-lib/aws-kms';
import { describe, it, expect, beforeAll } from 'vitest';

import { operationsOwnedBy } from '../../constants/operationOwnership.js';
import { TEST_NAMESPACE } from '../../constants/testConstants.js';
import {
  createNodeLambdaFunctionMock,
  createLogGroupsHelperMock,
  createKmsHelperMock,
} from '../../constants/testMocks.js';
import type { RealTimeRolesStack } from '../realTimeRolesStack.js';

// Mock NodeLambdaFunction to use inline code instead of esbuild bundling.
vi.mock('../../constructs/common/nodeLambdaFunction.js', () => createNodeLambdaFunctionMock());
vi.mock('../../constructs/common/kmsHelper.js', () => createKmsHelperMock());
vi.mock('../../constructs/common/logGroupsHelper.js', () => createLogGroupsHelperMock());

const EXPECTED_OPERATIONS = ['GetEventLeaderboard', 'RegisterUser'] as const;

describe('RealTimeRolesStack', () => {
  let parentStack: Stack;
  let realTimeRolesStack: RealTimeRolesStack;
  let template: Template;

  beforeAll(async () => {
    const { RealTimeRolesStack } = await import('../realTimeRolesStack.js');

    const app = new App();
    parentStack = new Stack(app, 'ParentStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });

    const dynamoDBTable = new TableV2(parentStack, 'Table', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
    });

    const userPool = new UserPool(parentStack, 'UserPool');
    const encryptionKey = Key.fromKeyArn(parentStack, 'TestKey', 'arn:aws:kms:us-east-1:123456789012:key/test-key-id');

    realTimeRolesStack = new RealTimeRolesStack(parentStack, 'RealTimeRoles', {
      namespace: TEST_NAMESPACE,
      dynamoDBTable,
      userPool,
      encryptionKey,
    });

    template = Template.fromStack(realTimeRolesStack);
  });

  describe('Lambda functions', () => {
    it('creates exactly 2 Lambda functions (one per real-time roles operation)', () => {
      template.resourceCountIs('AWS::Lambda::Function', EXPECTED_OPERATIONS.length);
      expect(template).toBeDefined();
    });

    it('creates a function with a name matching each operation', () => {
      const functions = template.findResources('AWS::Lambda::Function');
      const functionNames = Object.values(functions).map(
        (f) => (f as { Properties: { FunctionName: string } }).Properties.FunctionName as string,
      );

      for (const op of EXPECTED_OPERATIONS) {
        const hasFunction = functionNames.some((name) => name.includes(op));
        expect(hasFunction).toBe(true);
      }
    });
  });

  describe('handlerArns', () => {
    it('exposes handlerArns for all real-time roles operations with string ARNs', () => {
      for (const op of EXPECTED_OPERATIONS) {
        expect(realTimeRolesStack.handlerArns).toHaveProperty(op);
        expect((realTimeRolesStack.handlerArns as Record<string, string>)[op]).toBeTypeOf('string');
      }
    });

    it('does not expose operations outside the Real-Time Roles domain', () => {
      expect(realTimeRolesStack.handlerArns).not.toHaveProperty('CreateModel');
      expect(realTimeRolesStack.handlerArns).not.toHaveProperty('CreateEvent');
    });
  });

  describe('framework contract (nested-stack-decomposition §7.1)', () => {
    it('exposes exactly the operations OPERATION_OWNER assigns to this stack', () => {
      expect(Object.keys(realTimeRolesStack.handlerArns).sort()).toEqual(
        [...operationsOwnedBy('realTimeRoles')].sort(),
      );
    });

    it('references only root-owned resources in its template parameters', () => {
      const parameters = Object.keys(template.toJSON().Parameters ?? {});
      expect(parameters.length).toBeGreaterThan(0);
      for (const parameter of parameters) {
        expect(parameter).not.toMatch(/Gateway/i);
        expect(parameter).not.toMatch(/EventManagement|ModelManagement|DeviceManagement/i);
      }
    });

    it('exposes alarms and log groups for root to wire into observability', () => {
      expect(realTimeRolesStack.alarms.length).toBeGreaterThan(0);
      expect(realTimeRolesStack.logGroups.length).toBe(1);
    });

    it('creates a composite alarm covering the handlers', () => {
      template.resourceCountIs('AWS::CloudWatch::CompositeAlarm', 1);
      template.resourceCountIs('AWS::CloudWatch::Alarm', EXPECTED_OPERATIONS.length);
      expect(template).toBeDefined();
    });
  });

  describe('IAM permissions', () => {
    it('creates IAM execution roles for Lambda functions', () => {
      const roles = template.findResources('AWS::IAM::Role');
      expect(Object.keys(roles).length).toBeGreaterThanOrEqual(EXPECTED_OPERATIONS.length);
    });

    it('creates NO Lambda::Permission resources — GatewayStack owns them', () => {
      template.resourceCountIs('AWS::Lambda::Permission', 0);
      expect(template).toBeDefined();
    });

    it('references no API Gateway resource anywhere in its template', () => {
      const rendered = JSON.stringify(template.toJSON());
      expect(rendered).not.toContain('execute-api');
      expect(rendered).not.toContain('ApiGateway');
      expect(rendered).not.toMatch(/Gateway.*Outputs/);
    });

    it('grants RegisterUser Cognito permissions to create and manage users', () => {
      const policies = template.findResources('AWS::IAM::Policy');
      const rendered = JSON.stringify(policies);
      expect(rendered).toContain('cognito-idp:AdminCreateUser');
      expect(rendered).toContain('cognito-idp:AdminAddUserToGroup');
      expect(rendered).toContain('cognito-idp:AdminDeleteUser');
    });
  });
});
