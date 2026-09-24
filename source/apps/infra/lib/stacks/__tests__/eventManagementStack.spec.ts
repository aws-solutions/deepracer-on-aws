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
import type { EventManagementStack } from '../eventManagementStack.js';

// Mock NodeLambdaFunction to use inline code instead of esbuild bundling.
vi.mock('../../constructs/common/nodeLambdaFunction.js', () => createNodeLambdaFunctionMock());
vi.mock('../../constructs/common/kmsHelper.js', () => createKmsHelperMock());
vi.mock('../../constructs/common/logGroupsHelper.js', () => createLogGroupsHelperMock());

// Minimal GlobalSettings stub — avoids real AppConfig construct in tests
vi.mock('../../constructs/storage/appConfig.js', () => ({
  GlobalSettings: class GlobalSettings {
    app = { attrApplicationId: 'mock-app-id' };
    environment = { attrEnvironmentId: 'mock-env-id' };
    configurationProfile = { attrConfigurationProfileId: 'mock-profile-id' };
    deploymentStrategy = { attrId: 'mock-strategy-id' };
  },
}));

// grantAppConfigAccess uses PolicyStatement internally; stub it out to keep the test fast
vi.mock('../../constructs/common/permissionsHelper.js', () => ({
  grantAppConfigAccess: vi.fn(),
}));

const EXPECTED_EVENT_OPERATIONS = [
  'CreateEvent',
  'GetEvent',
  'ListEvents',
  'EditEvent',
  'DeleteEvent',
  'TransitionEventStatus',
  'CreateRun',
  'GetRun',
  'ListRuns',
  'TransitionRunStatus',
  'CreateLap',
  'UpdateLap',
  'SetLapValidity',
  'GetEventStatistics',
  'AddTrackToEvent',
  'RemoveTrackFromEvent',
  'ListEventTracks',
  'GetCombinedLeaderboard',
] as const;

describe('EventManagementStack', () => {
  let parentStack: Stack;
  let eventManagementStack: EventManagementStack;
  let template: Template;

  beforeAll(async () => {
    // Dynamically import after mocks are registered
    const [{ EventManagementStack }, { GlobalSettings }] = await Promise.all([
      import('../eventManagementStack.js'),
      import('../../constructs/storage/appConfig.js'),
    ]);

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

    // @ts-expect-error — mocked constructor takes no real args
    const globalSettings = new GlobalSettings();

    eventManagementStack = new EventManagementStack(parentStack, 'EventManagement', {
      namespace: TEST_NAMESPACE,
      dynamoDBTable,
      userPool,
      globalSettings,
      encryptionKey,
    });

    template = Template.fromStack(eventManagementStack);
  });

  describe('Lambda functions', () => {
    it('creates one Lambda per event operation plus the asynchronous delete worker', () => {
      template.resourceCountIs('AWS::Lambda::Function', EXPECTED_EVENT_OPERATIONS.length + 1);
      expect(template).toBeDefined();
    });

    it('creates a function with a name matching each operation', () => {
      const functions = template.findResources('AWS::Lambda::Function');
      const functionNames = Object.values(functions).map(
        (f) => (f as { Properties: { FunctionName: string } }).Properties.FunctionName as string,
      );

      for (const op of EXPECTED_EVENT_OPERATIONS) {
        const hasFunction = functionNames.some((name) => name.includes(op));
        expect(hasFunction).toBe(true);
      }
      expect(functionNames.some((name) => name.includes('DeleteWorkerFn'))).toBe(true);
    });
  });

  describe('handlerArns', () => {
    it('exposes handlerArns for all event management operations with string ARNs', () => {
      for (const op of EXPECTED_EVENT_OPERATIONS) {
        expect(eventManagementStack.handlerArns).toHaveProperty(op);
        expect((eventManagementStack.handlerArns as Record<string, string>)[op]).toBeTypeOf('string');
      }
    });

    it('does not expose operations outside the Event Management domain', () => {
      expect(eventManagementStack.handlerArns).not.toHaveProperty('CreateModel');
      expect(eventManagementStack.handlerArns).not.toHaveProperty('CreateLeaderboard');
    });
  });

  describe('framework contract (nested-stack-decomposition §7.1)', () => {
    it('exposes exactly the operations OPERATION_OWNER assigns to this stack', () => {
      // Guards against drift in both directions: an operation assigned to this epic but
      // never wired to a handler, or a handler for an operation this epic does not own.
      expect(Object.keys(eventManagementStack.handlerArns).sort()).toEqual(
        [...operationsOwnedBy('eventManagement')].sort(),
      );
    });

    it('references only root-owned resources in its template parameters', () => {
      // An epic stack may depend on platform resources passed down by root. It must not
      // reference a sibling epic or the gateway — that is how cycles get introduced.
      const parameters = Object.keys(template.toJSON().Parameters ?? {});
      expect(parameters.length).toBeGreaterThan(0);
      for (const parameter of parameters) {
        expect(parameter).not.toMatch(/Gateway/i);
        expect(parameter).not.toMatch(/ModelManagement|DeviceManagement|RealTimeRoles/i);
      }
    });

    it('exposes alarms and log groups for root to wire into observability', () => {
      // Required by EpicStack<K>. An unexposed alarm is an unmonitored Lambda, and an
      // unexposed log group is absent from every LogInsights query.
      expect(eventManagementStack.alarms.length).toBeGreaterThan(0);
      // One shared API log group (createEpicFunctions) + the delete worker's own log group.
      expect(eventManagementStack.logGroups.length).toBe(2);
    });

    it('creates a composite alarm covering the handlers', () => {
      template.resourceCountIs('AWS::CloudWatch::CompositeAlarm', 1);
      template.resourceCountIs('AWS::CloudWatch::Alarm', EXPECTED_EVENT_OPERATIONS.length + 2);
      expect(template).toBeDefined();
    });
  });

  describe('IAM permissions', () => {
    it('creates IAM execution roles for Lambda functions', () => {
      const roles = template.findResources('AWS::IAM::Role');
      expect(Object.keys(roles).length).toBeGreaterThanOrEqual(EXPECTED_EVENT_OPERATIONS.length);
    });

    it('creates NO Lambda::Permission resources — GatewayStack owns them', () => {
      // The stack that owns the RestApi owns every Lambda::Permission for it. If an
      // epic stack created its own, it would need the REST API ID while the gateway
      // needs this stack's function ARNs — a CloudFormation cycle between siblings.
      template.resourceCountIs('AWS::Lambda::Permission', 0);
      expect(template).toBeDefined();
    });

    it('references no API Gateway resource anywhere in its template', () => {
      // Guards the acyclicity invariant from the other direction: no execute-api ARN,
      // no RestApi reference, no gateway stack parameter.
      const rendered = JSON.stringify(template.toJSON());
      expect(rendered).not.toContain('execute-api');
      expect(rendered).not.toContain('ApiGateway');
      expect(rendered).not.toMatch(/Gateway.*Outputs/);
    });
  });
});
