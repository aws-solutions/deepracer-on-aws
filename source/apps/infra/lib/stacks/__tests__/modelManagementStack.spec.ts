// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { describe, it, expect, beforeAll } from 'vitest';

import { operationsOwnedBy } from '../../constants/operationOwnership.js';
import { TEST_NAMESPACE } from '../../constants/testConstants.js';
import {
  createNodeLambdaFunctionMock,
  createLogGroupsHelperMock,
  createKmsHelperMock,
} from '../../constants/testMocks.js';
import type { ModelManagementStack } from '../modelManagementStack.js';

// Mock EcrStack with minimal imageRepositoryMappings

// Mock NodeLambdaFunction to use inline code instead of esbuild bundling.
vi.mock('../../constructs/common/nodeLambdaFunction.js', () => createNodeLambdaFunctionMock());
vi.mock('../../constructs/common/kmsHelper.js', () => createKmsHelperMock());
vi.mock('../../constructs/common/logGroupsHelper.js', () => createLogGroupsHelperMock());

let mockEcrRepository: Repository;

const EXPECTED_MODEL_OPERATIONS = [
  'PackageModel',
  'ImportPhysicalModel',
  'DeployModel',
  'GetDeployment',
  'ListAdminModels',
  'ListDeployments',
  'ListDeploymentsByBatch',
  'ListDeploymentsByEvent',
] as const;

describe('ModelManagementStack', () => {
  let parentStack: Stack;
  let modelManagementStack: ModelManagementStack;
  let template: Template;

  beforeAll(async () => {
    const { ModelManagementStack } = await import('../modelManagementStack.js');

    const app = new App({ context: { MODEL_OPTIMIZER_REPO_NAME: 'deepracer-on-aws-model-optimizer' } });
    parentStack = new Stack(app, 'ParentStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });

    const dynamoDBTable = new TableV2(parentStack, 'Table', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
    });

    const userPool = new UserPool(parentStack, 'UserPool');
    const encryptionKey = Key.fromKeyArn(parentStack, 'TestKey', 'arn:aws:kms:us-east-1:123456789012:key/test-key-id');
    const modelStorageBucket = new Bucket(parentStack, 'ModelBucket');
    const uploadBucket = new Bucket(parentStack, 'UploadBucket');

    mockEcrRepository = new Repository(parentStack, 'MockOptimizerRepo', {
      repositoryName: 'deepracer-on-aws-model-optimizer',
    });

    modelManagementStack = new ModelManagementStack(parentStack, 'ModelManagement', {
      namespace: TEST_NAMESPACE,
      dynamoDBTable,
      modelStorageBucket,
      uploadBucket,
      userPool,
      encryptionKey,
      modelOptimizerRepositoryArn: mockEcrRepository.repositoryArn,
      modelOptimizerRepositoryName: mockEcrRepository.repositoryName,
      modelOptimizerImageTag: 'latest',
      importModelJobQueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/mock-import-queue',
      importModelJobQueueArn: 'arn:aws:sqs:us-east-1:123456789012:mock-import-queue',
    });

    template = Template.fromStack(modelManagementStack);
  });

  describe('Lambda functions', () => {
    it('creates Lambda functions for all model management operations plus workflow handlers', () => {
      // 7 API handlers + 1 optimizer + 3 push handlers + 1 DLQ processor = 12
      const functions = template.findResources('AWS::Lambda::Function');
      expect(Object.keys(functions).length).toBeGreaterThanOrEqual(EXPECTED_MODEL_OPERATIONS.length);
    });

    it('creates a function with a name matching each API operation', () => {
      const functions = template.findResources('AWS::Lambda::Function');
      const functionNames = Object.values(functions).map(
        (f) => (f as { Properties: { FunctionName: string } }).Properties.FunctionName as string,
      );

      for (const op of EXPECTED_MODEL_OPERATIONS) {
        const hasFunction = functionNames.some((name) => name.includes(op));
        expect(hasFunction).toBe(true);
      }
    });
  });

  describe('handlerArns', () => {
    it('exposes handlerArns for all 7 model management operations with string ARNs', () => {
      for (const op of EXPECTED_MODEL_OPERATIONS) {
        expect(modelManagementStack.handlerArns).toHaveProperty(op);
        expect((modelManagementStack.handlerArns as Record<string, string>)[op]).toBeTypeOf('string');
      }
    });

    it('does not expose operations outside the Model Management domain', () => {
      expect(modelManagementStack.handlerArns).not.toHaveProperty('CreateModel');
      expect(modelManagementStack.handlerArns).not.toHaveProperty('CreateEvent');
      expect(modelManagementStack.handlerArns).not.toHaveProperty('CreateProfile');
    });
  });

  describe('framework contract (nested-stack-decomposition §7.1)', () => {
    it('exposes exactly the operations OPERATION_OWNER assigns to this stack', () => {
      expect(Object.keys(modelManagementStack.handlerArns).sort()).toEqual(
        [...operationsOwnedBy('modelManagement')].sort(),
      );
    });

    it('references only root-owned resources in its template parameters', () => {
      const parameters = Object.keys(template.toJSON().Parameters ?? {});
      for (const parameter of parameters) {
        expect(parameter).not.toMatch(/Gateway/i);
        expect(parameter).not.toMatch(/EventManagement|DeviceManagement|RealTimeRoles/i);
      }
    });

    it('exposes alarms and log groups for root to wire into observability', () => {
      expect(modelManagementStack.alarms.length).toBeGreaterThan(0);
      expect(modelManagementStack.logGroups.length).toBe(3); // shared API + optimizer + push workflow
    });

    it('creates composite and individual alarms', () => {
      template.resourceCountIs('AWS::CloudWatch::CompositeAlarm', 1);
      // 7 API handler alarms + 1 DLQ depth alarm = 8
      const alarms = template.findResources('AWS::CloudWatch::Alarm');
      expect(Object.keys(alarms).length).toBeGreaterThanOrEqual(EXPECTED_MODEL_OPERATIONS.length);
    });
  });

  describe('IAM permissions', () => {
    it('creates IAM execution roles for Lambda functions', () => {
      const roles = template.findResources('AWS::IAM::Role');
      expect(Object.keys(roles).length).toBeGreaterThanOrEqual(EXPECTED_MODEL_OPERATIONS.length);
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
  });

  describe('Step Functions', () => {
    it('creates a Push Step Function state machine', () => {
      template.resourceCountIs('AWS::StepFunctions::StateMachine', 1);
      expect(template).toBeDefined();
    });
  });

  describe('SQS', () => {
    it('creates the async optimizer DLQ', () => {
      template.resourceCountIs('AWS::SQS::Queue', 1);
      expect(template).toBeDefined();
    });

    it('creates a DLQ processor with reportBatchItemFailures', () => {
      expect(() =>
        template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
          FunctionResponseTypes: ['ReportBatchItemFailures'],
        }),
      ).not.toThrow();
    });
  });

  describe('Model Optimizer (Docker Lambda)', () => {
    it('creates a Docker image Lambda function with expected configuration', () => {
      expect(() =>
        template.hasResourceProperties('AWS::Lambda::Function', {
          PackageType: 'Image',
          MemorySize: 10240,
          Timeout: 300,
          Architectures: ['x86_64'],
        }),
      ).not.toThrow();
    });

    it('configures ephemeral storage for model conversion workspace', () => {
      expect(() =>
        template.hasResourceProperties('AWS::Lambda::Function', {
          PackageType: 'Image',
          EphemeralStorage: { Size: 4096 },
        }),
      ).not.toThrow();
    });
  });

  describe('GuardDuty Malware Protection', () => {
    it('creates a MalwareProtectionPlan resource', () => {
      template.resourceCountIs('AWS::GuardDuty::MalwareProtectionPlan', 1);
      expect(template).toBeDefined();
    });
  });

  describe('IAM least-privilege', () => {
    it('grants AdminListGroupsForUser scoped to the specific user pool', () => {
      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyDocument: Match.objectLike({
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: 'cognito-idp:AdminListGroupsForUser',
                Resource: { Ref: Match.stringLikeRegexp('UserPool.*Arn') },
              }),
            ]),
          }),
        }),
      ).not.toThrow();
    });

    it('does not grant wildcard cognito-idp actions', () => {
      const rendered = JSON.stringify(template.toJSON());
      expect(rendered).not.toContain('"cognito-idp:*"');
    });

    it('scopes ssm:SendCommand on the document resource without a tag condition', () => {
      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyDocument: Match.objectLike({
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: 'ssm:SendCommand',
                Resource: {
                  'Fn::Join': Match.arrayWith([
                    Match.arrayWith([Match.stringLikeRegexp('document/AWS-RunShellScript')]),
                  ]),
                },
              }),
            ]),
          }),
        }),
      ).not.toThrow();
    });

    it('scopes ssm:SendCommand on managed-instance with deepracer:managed tag condition', () => {
      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyDocument: Match.objectLike({
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: 'ssm:SendCommand',
                Resource: {
                  'Fn::Join': Match.arrayWith([Match.arrayWith([Match.stringLikeRegexp('managed-instance')])]),
                },
                Condition: {
                  StringEquals: { 'ssm:resourceTag/deepracer:managed': 'true' },
                },
              }),
            ]),
          }),
        }),
      ).not.toThrow();
    });

    it('does not grant wildcard ssm:SendCommand', () => {
      const policies = template.findResources('AWS::IAM::Policy');
      const sendCommandStatements = Object.values(policies)
        .flatMap(
          (p) =>
            (p as { Properties: { PolicyDocument: { Statement: unknown[] } } }).Properties.PolicyDocument.Statement,
        )
        .filter((s) => {
          const stmt = s as { Action?: string | string[] };
          return (
            stmt.Action === 'ssm:SendCommand' || (Array.isArray(stmt.Action) && stmt.Action.includes('ssm:SendCommand'))
          );
        });

      for (const stmt of sendCommandStatements) {
        expect((stmt as { Resource?: string }).Resource).not.toBe('*');
      }
    });
  });

  describe('Lambda environment variables', () => {
    it('sets DATABASE_NAME on API handler functions', () => {
      expect(() =>
        template.hasResourceProperties('AWS::Lambda::Function', {
          Environment: {
            Variables: Match.objectLike({
              DATABASE_NAME: Match.anyValue(),
            }),
          },
        }),
      ).not.toThrow();
    });
  });
});
