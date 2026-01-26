// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';
import path from 'node:path';

import { App, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { EcrStack } from '../../../stacks/ecrStack.js';
import { ImageRepositoryMapping } from '../../ecr-image-downloader/index.js';
import { GlobalSettings } from '../../storage/appConfig.js';
import { Api } from '../api.js';

// Interface for testing private methods
interface ApiTestInterface {
  getOpenApiDef: (functions: Record<string, NodejsFunction>, userPool: UserPool) => void;
}

// Mock EcrStack for testing
class MockEcrStack extends Construct {
  public readonly imageRepositoryMappings: ImageRepositoryMapping[] = [
    {
      publicImageUri: 'public.ecr.aws/aws-solutions/deepracer-on-aws-reward-function-validation',
      imageTag: 'v0.0.1',
      repository: new Repository(this, 'MockRewardValidationRepository', {
        repositoryName: 'deepracer-on-aws-reward-function-validation',
      }),
      repositoryId: 'deepracer-on-aws-reward-function-validation',
      privateRepositoryName: `${TEST_NAMESPACE}-deepracer-on-aws-reward-function-validation`,
    },
    {
      publicImageUri: 'public.ecr.aws/aws-solutions/deepracer-on-aws-model-validation',
      imageTag: 'v0.0.1',
      repository: new Repository(this, 'MockModelValidationRepository', {
        repositoryName: 'deepracer-on-aws-model-validation',
      }),
      repositoryId: 'deepracer-on-aws-model-validation',
      privateRepositoryName: `${TEST_NAMESPACE}-deepracer-on-aws-model-validation`,
    },
  ];
}

// Mock EcrStack without reward validation for testing error cases
class MockEcrStackWithoutReward extends Construct {
  public readonly imageRepositoryMappings: ImageRepositoryMapping[] = [
    {
      publicImageUri: 'public.ecr.aws/aws-solutions/deepracer-on-aws-model-validation',
      imageTag: 'v0.0.1',
      repository: new Repository(this, 'MockModelValidationRepository', {
        repositoryName: 'deepracer-on-aws-model-validation',
      }),
      repositoryId: 'deepracer-on-aws-model-validation',
      privateRepositoryName: `${TEST_NAMESPACE}-deepracer-on-aws-model-validation`,
    },
  ];
}

describe('Api', () => {
  let app: App;
  let stack: Stack;
  let template: Template;
  let userPool: UserPool;

  beforeAll(() => {
    app = new App({
      context: {
        REWARD_VALIDATION_REPO_NAME: 'deepracer-on-aws-reward-function-validation',
        MODEL_VALIDATION_REPO_NAME: 'deepracer-on-aws-model-validation',
      },
    });
    stack = new Stack(app, 'TestStack');

    // Create required resources
    userPool = new UserPool(stack, 'TestUserPool', {
      userPoolName: 'test-user-pool',
    });

    const table = new TableV2(stack, 'TestTable', {
      tableName: 'TestTable',
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    const modelStorageBucket = new Bucket(stack, 'TestModelStorageBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const virtualModelBucket = new Bucket(stack, 'TestVirtualModelBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const uploadBucket = new Bucket(stack, 'TestUploadBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const vpc = new Vpc(stack, 'TestVpc');
    expect(stack).toBeDefined();
    const securityGroup = new SecurityGroup(stack, 'TestSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });

    const globalSettings = new GlobalSettings(stack, 'TestGlobalSettings', {
      namespace: TEST_NAMESPACE,
    });
    expect(stack).toBeDefined();

    // Create mock EcrStack
    const mockEcrStack = new MockEcrStack(stack, 'MockEcrStack') as unknown as EcrStack;

    // Create the Api construct
    new Api(stack, 'TestApi', {
      userPool,
      dynamoDBTable: table,
      modelStorageBucket,
      uploadBucket,
      ecrStack: mockEcrStack,
      userExecutionVpc: vpc,
      userExecutionSecurityGroup: securityGroup,
      virtualModelBucket,
      globalSettings,
      namespace: TEST_NAMESPACE,
    });

    template = Template.fromStack(stack);
  });

  describe('Core Infrastructure', () => {
    it('creates required resources with correct configuration', () => {
      expect(() =>
        template.hasResourceProperties('AWS::SQS::Queue', {
          FifoQueue: true,
          MessageRetentionPeriod: Duration.days(14).toSeconds(),
          KmsMasterKeyId: 'alias/aws/sqs',
          VisibilityTimeout: Duration.minutes(1).toSeconds(),
        }),
      ).not.toThrow();

      // Test API Gateway
      expect(() =>
        template.hasResourceProperties('AWS::ApiGateway::RestApi', {
          Name: `${TEST_NAMESPACE}-DeepRacerIndyApi`,
        }),
      ).not.toThrow();
      expect(() =>
        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: `${TEST_NAMESPACE}-DeepRacerIndy-AssetPackagingFunction`,
          Timeout: Duration.minutes(15).toSeconds(),
          Architectures: ['x86_64'],
        }),
      ).not.toThrow();

      // Test DLQ alarm
      expect(() =>
        template.hasResourceProperties('AWS::CloudWatch::Alarm', {
          MetricName: 'ApproximateNumberOfMessagesVisible',
          Namespace: 'AWS/SQS',
          Threshold: 5,
          EvaluationPeriods: 1,
          TreatMissingData: 'notBreaching',
        }),
      ).not.toThrow();
      expect(() =>
        template.hasResourceProperties('AWS::SQS::Queue', {
          MessageRetentionPeriod: Duration.days(1).toSeconds(),
          KmsMasterKeyId: 'alias/aws/sqs',
        }),
      ).not.toThrow();
    });

    it('configures API Gateway error responses', () => {
      ['BAD_REQUEST_BODY', 'BAD_REQUEST_PARAMETERS'].forEach((responseType) => {
        expect(() =>
          template.hasResourceProperties('AWS::ApiGateway::GatewayResponse', {
            ResponseType: responseType,
            ResponseParameters: {
              'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
              'gatewayresponse.header.Access-Control-Allow-Headers': "'*'",
            },
            StatusCode: '400',
          }),
        ).not.toThrow();
      });
    });
  });

  describe('OpenAPI Integration', () => {
    it('throws error when x-amazon-apigateway-integration is missing', () => {
      // Create minimal test resources
      const testApp = new App({
        context: {
          REWARD_VALIDATION_REPO_NAME: 'deepracer-on-aws-reward-function-validation',
          MODEL_VALIDATION_REPO_NAME: 'deepracer-on-aws-model-validation',
        },
      });
      const testStack = new Stack(testApp, 'TestStack');
      const testUserPool = new UserPool(testStack, 'TestUserPool');
      const testTable = new TableV2(testStack, 'TestTable', {
        partitionKey: { name: 'pk', type: AttributeType.STRING },
        sortKey: { name: 'sk', type: AttributeType.STRING },
      });
      const testBucket = new Bucket(testStack, 'TestBucket');
      const testVpc = new Vpc(testStack, 'TestVpc');
      const testSecurityGroup = new SecurityGroup(testStack, 'TestSecurityGroup', {
        vpc: testVpc,
      });
      const testGlobalSettings = new GlobalSettings(testStack, 'TestGlobalSettings', {
        namespace: TEST_NAMESPACE,
      });

      // Create mock EcrStack
      const mockEcrStack = new MockEcrStack(testStack, 'MockEcrStack1') as unknown as EcrStack;

      // Create API instance
      const testApi = new Api(testStack, 'TestApi', {
        userPool: testUserPool,
        dynamoDBTable: testTable,
        modelStorageBucket: testBucket,
        uploadBucket: testBucket,
        ecrStack: mockEcrStack,
        userExecutionVpc: testVpc,
        userExecutionSecurityGroup: testSecurityGroup,
        virtualModelBucket: testBucket,
        globalSettings: testGlobalSettings,
        namespace: TEST_NAMESPACE,
      });

      // Mock fs.readFileSync to return an OpenAPI spec without integration
      const mockFs = vi.spyOn(fs, 'readFileSync');
      mockFs.mockReturnValue(
        JSON.stringify({
          components: {},
          paths: {
            '/test': {
              get: {
                operationId: 'GetModel',
                // Intentionally missing x-amazon-apigateway-integration
              },
            },
          },
        }),
      );

      // Verify error is thrown
      expect(() => {
        (testApi as unknown as ApiTestInterface).getOpenApiDef(
          {
            GetModel: new NodejsFunction(testStack, 'TestFunction', {
              entry: path.join(__dirname, '../api.ts'),
            }),
          },
          testUserPool,
        );
      }).toThrow('No x-amazon-apigateway-integration for GetModel. Make sure API Gateway integration is configured.');

      mockFs.mockRestore();
    });

    it('throws error when function is missing for operation', () => {
      // Create minimal test resources
      const testApp = new App({
        context: {
          REWARD_VALIDATION_REPO_NAME: 'deepracer-on-aws-reward-function-validation',
          MODEL_VALIDATION_REPO_NAME: 'deepracer-on-aws-model-validation',
        },
      });
      const testStack = new Stack(testApp, 'TestStack');
      const testUserPool = new UserPool(testStack, 'TestUserPool');
      const testTable = new TableV2(testStack, 'TestTable', {
        partitionKey: { name: 'pk', type: AttributeType.STRING },
        sortKey: { name: 'sk', type: AttributeType.STRING },
      });
      const testBucket = new Bucket(testStack, 'TestBucket');
      const testVpc = new Vpc(testStack, 'TestVpc');
      const testSecurityGroup = new SecurityGroup(testStack, 'TestSecurityGroup', {
        vpc: testVpc,
      });
      const testGlobalSettings = new GlobalSettings(testStack, 'TestGlobalSettings', {
        namespace: TEST_NAMESPACE,
      });

      // Create mock EcrStack
      const mockEcrStack = new MockEcrStack(testStack, 'MockEcrStack2') as unknown as EcrStack;

      // Create API instance
      const testApi = new Api(testStack, 'TestApi', {
        userPool: testUserPool,
        dynamoDBTable: testTable,
        modelStorageBucket: testBucket,
        uploadBucket: testBucket,
        ecrStack: mockEcrStack,
        userExecutionVpc: testVpc,
        userExecutionSecurityGroup: testSecurityGroup,
        virtualModelBucket: testBucket,
        globalSettings: testGlobalSettings,
        namespace: TEST_NAMESPACE,
      });

      // Mock fs.readFileSync to return an OpenAPI spec with integration but missing function
      const mockFs = vi.spyOn(fs, 'readFileSync');
      mockFs.mockReturnValue(
        JSON.stringify({
          components: {},
          paths: {
            '/test': {
              get: {
                operationId: 'GetModel',
                'x-amazon-apigateway-integration': {
                  type: 'aws_proxy',
                },
              },
            },
          },
        }),
      );

      // Verify error is thrown when function is missing from functions map
      expect(() => {
        (testApi as unknown as ApiTestInterface).getOpenApiDef(
          {
            // Intentionally empty functions map
          },
          testUserPool,
        );
      }).toThrow('No function for GetModel');

      mockFs.mockRestore();
    });

    it('throws error when reward validation ECR repository mapping is missing', () => {
      // Create minimal test resources
      const testApp = new App({
        context: {
          REWARD_VALIDATION_REPO_NAME: 'deepracer-on-aws-reward-function-validation',
          MODEL_VALIDATION_REPO_NAME: 'deepracer-on-aws-model-validation',
        },
      });
      const testStack = new Stack(testApp, 'TestStack');
      const testUserPool = new UserPool(testStack, 'TestUserPool');
      const testTable = new TableV2(testStack, 'TestTable', {
        partitionKey: { name: 'pk', type: AttributeType.STRING },
        sortKey: { name: 'sk', type: AttributeType.STRING },
      });
      const testBucket = new Bucket(testStack, 'TestBucket');
      const testVpc = new Vpc(testStack, 'TestVpc');
      const testSecurityGroup = new SecurityGroup(testStack, 'TestSecurityGroup', {
        vpc: testVpc,
      });
      const testGlobalSettings = new GlobalSettings(testStack, 'TestGlobalSettings', {
        namespace: TEST_NAMESPACE,
      });

      // Create mock EcrStack without reward validation mapping
      const mockEcrStackWithoutReward = new MockEcrStackWithoutReward(
        testStack,
        'MockEcrStack3',
      ) as unknown as EcrStack;

      // Verify error is thrown when reward validation mapping is missing
      expect(() => {
        new Api(testStack, 'TestApi2', {
          userPool: testUserPool,
          dynamoDBTable: testTable,
          modelStorageBucket: testBucket,
          uploadBucket: testBucket,
          ecrStack: mockEcrStackWithoutReward,
          userExecutionVpc: testVpc,
          userExecutionSecurityGroup: testSecurityGroup,
          virtualModelBucket: testBucket,
          globalSettings: testGlobalSettings,
          namespace: TEST_NAMESPACE,
        });
      }).toThrow('Reward validation ECR repository mapping not found in EcrStack');
    });
  });

  describe('Lambda Functions', () => {
    it('creates an API handler lambda with correct configuration', () => {
      expect(() =>
        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyApi-CreateModelFunction`,
          Environment: {
            Variables: {
              POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyApi',
            },
          },
        }),
      ).not.toThrow();
    });

    it('creates UpdateGroupMembership lambda function', () => {
      expect(() =>
        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyApi-UpdateGroupMembershipFunction`,
        }),
      ).not.toThrow();
    });

    it('grants cognito permissions to API lambda handlers', () => {
      ['CreateModel', 'GetModel'].forEach((operation) => {
        expect(() =>
          template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyName: Match.stringLikeRegexp(`.*${operation}Function.*`),
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: Match.arrayWith([
                Match.objectLike({
                  Effect: 'Allow',
                  Action: 'cognito-idp:ListUsers',
                  Resource: { 'Fn::GetAtt': [Match.stringLikeRegexp('TestUserPool.*'), 'Arn'] },
                }),
              ]),
            },
          }),
        ).not.toThrow();
      });

      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyName: Match.stringLikeRegexp('.*CreateProfileFunction.*'),
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: Match.arrayWith([
              Match.objectLike({
                Effect: 'Allow',
                Action: [
                  'cognito-idp:AdminCreateUser',
                  'cognito-idp:AdminAddUserToGroup',
                  'cognito-idp:AdminDeleteUser',
                ],
                Resource: { 'Fn::GetAtt': [Match.stringLikeRegexp('TestUserPool.*'), 'Arn'] },
              }),
            ]),
          },
        }),
      ).not.toThrow();

      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyName: Match.stringLikeRegexp('.*UpdateGroupMembershipFunction.*'),
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: Match.arrayWith([
              Match.objectLike({
                Effect: 'Allow',
                Action: [
                  'cognito-idp:AdminAddUserToGroup',
                  'cognito-idp:AdminRemoveUserFromGroup',
                  'cognito-idp:AdminListGroupsForUser',
                ],
                Resource: { 'Fn::GetAtt': [Match.stringLikeRegexp('TestUserPool.*'), 'Arn'] },
              }),
            ]),
          },
        }),
      ).not.toThrow();
    });
  });
});
