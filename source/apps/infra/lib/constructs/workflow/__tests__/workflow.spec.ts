// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { describe, expect, it } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { Workflow } from '../workflow.js';

// Mock the KmsHelper to avoid having the single key shared between stacks
vi.mock('#constructs/common/kmsHelper.js', () => {
  return {
    KmsHelper: {
      get: vi.fn(() => {
        return {
          grantEncryptDecrypt: vi.fn(),
          keyId: 'mock-key-id',
          keyArn: 'arn:aws:kms:us-east-1:123456789012:key/mock-key-id',
        };
      }),
    },
  };
});

// Mock the LogGroupsHelper to avoid having the static log groups shared between stacks
vi.mock('#constructs/common/logGroupsHelper.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#constructs/common/logGroupsHelper.js')>();
  return {
    ...actual,
    LogGroupsHelper: {
      ...actual.LogGroupsHelper,
      getOrCreateLogGroup: vi.fn().mockImplementation((scope, id, props) => {
        return {
          logGroupName: `mocked-log-group-${id}`,
          logGroupArn: `arn:aws:logs:us-east-1:123456789012:log-group:mocked-log-group-${id}`,
        };
      }),
    },
  };
});

describe('Workflow', () => {
  let app: App;
  let stack: Stack;
  let table: TableV2;
  let bucket: Bucket;
  let queue: Queue;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');

    table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });

    bucket = new Bucket(stack, 'TestBucket');
    expect(stack).toBeDefined();
    queue = new Queue(stack, 'TestQueue');
    expect(stack).toBeDefined();
  });

  describe('Core Infrastructure', () => {
    it('creates workflow with required resources', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Verify SageMaker role
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'sagemaker.amazonaws.com',
              },
            },
          ],
        },
      });

      // Verify Lambda functions
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyWorkflow-JobInitializerFn`,
      });

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyWorkflow-JobMonitorFn`,
      });

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyWorkflow-JobFinalizerFn`,
      });

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyWorkflow-JobDispatcherFn`,
      });

      // Verify Step Function
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        StateMachineName: `${TEST_NAMESPACE}-DeepRacerIndyWorkflow`,
        TracingConfiguration: {
          Enabled: true,
        },
      });

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: Match.anyValue(),
      });
    });
  });

  describe('SageMaker Role Permissions', () => {
    it('configures SageMaker role with correct permissions', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Check for SageMaker role with correct assume role policy
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'sagemaker.amazonaws.com',
              },
            },
          ],
        },
      });

      // Check for the resource policy on the SageMaker role
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Principal: { Service: 'sagemaker.amazonaws.com' },
            }),
          ]),
        }),
      });

      // check for the attached policies
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sagemaker:*TrainingJob*',
              Effect: 'Allow',
              Resource: Match.anyValue(),
            }),
            Match.objectLike({
              Action: 'ecr:GetAuthorizationToken',
              Effect: 'Allow',
              Resource: '*',
            }),
            Match.objectLike({
              Action: ['ecr:BatchCheckLayerAvailability', 'ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
              Effect: 'Allow',
              Resource: Match.anyValue(),
            }),
            Match.objectLike({
              Action: ['kinesisvideo:DescribeStream', 'kinesisvideo:GetDataEndpoint', 'kinesisvideo:PutMedia'],
              Effect: 'Allow',
              Resource: Match.anyValue(),
            }),
            Match.objectLike({
              Action: 'cloudwatch:PutMetricData',
              Effect: 'Allow',
              Resource: '*',
            }),
            Match.objectLike({
              Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:DescribeLogStreams', 'logs:PutLogEvents'],
              Effect: 'Allow',
              Resource: Match.anyValue(),
            }),
            Match.objectLike({
              Action: [
                'ec2:CreateNetworkInterface',
                'ec2:CreateNetworkInterfacePermission',
                'ec2:DeleteNetworkInterface',
                'ec2:DeleteNetworkInterfacePermission',
                'ec2:DescribeDhcpOptions',
                'ec2:DescribeNetworkInterfaces',
                'ec2:DescribeSecurityGroups',
                'ec2:DescribeSubnets',
                'ec2:DescribeVpcs',
              ],
              Effect: 'Allow',
              Resource: Match.anyValue(),
            }),
          ]),
        },
        Roles: [
          {
            Ref: Match.stringLikeRegexp('.*WorkflowSageMakerRole.*'),
          },
        ],
      });
    });
  });

  describe('Lambda Functions Configuration', () => {
    it('configures job initializer function with correct environment', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyWorkflow-JobInitializerFn`,
        Environment: {
          Variables: {
            SAGEMAKER_TRAINING_IMAGE: 'test-repo-uri',
            POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyWorkflow',
          },
        },
      });
    });

    it('configures job monitor function with correct environment', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyWorkflow-JobMonitorFn`,
        Environment: {
          Variables: {
            POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyWorkflow',
          },
        },
      });
    });

    it('configures job finalizer function with correct environment', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyWorkflow-JobFinalizerFn`,
        Environment: {
          Variables: {
            POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyWorkflow',
          },
        },
      });
    });

    it('configures job dispatcher function with correct environment and role', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyWorkflow-JobDispatcherFn`,
        MemorySize: 256,
        Environment: {
          Variables: {
            POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyWorkflow',
          },
        },
      });
    });
  });

  describe('IAM Permissions', () => {
    it('grants correct permissions to job initializer function', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'kinesisvideo:CreateStream',
              Effect: 'Allow',
            }),
          ]),
        },
      });

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sagemaker:CreateTrainingJob',
              Effect: 'Allow',
            }),
          ]),
        },
      });

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'iam:PassRole',
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    it('grants correct permissions to job monitor function', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['sagemaker:DescribeTrainingJob', 'sagemaker:StopTrainingJob'],
              Effect: 'Allow',
            }),
          ]),
        },
      });

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['kinesisvideo:GetDataEndpoint', 'kinesisvideo:GetHLSStreamingSessionURL'],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    it('grants correct permissions to job finalizer function', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'kinesisVideo:DeleteStream',
              Effect: 'Allow',
            }),
          ]),
        },
      });

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['sagemaker:DescribeTrainingJob', 'sagemaker:StopTrainingJob'],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    it('configures job dispatcher function role with correct policies', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Check for job dispatcher role with lambda service principal
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
            },
          ],
        },
      });

      // Check for separate policy resources that are attached to the job dispatcher role
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sagemaker:ListTrainingJobs',
              Effect: 'Allow',
              Resource: '*',
            }),
          ]),
        },
        Roles: [
          {
            Ref: Match.stringLikeRegexp('.*JobDispatcherFunctionRole.*'),
          },
        ],
      });

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'servicequotas:GetServiceQuota',
              Effect: 'Allow',
              Resource: '*',
            }),
          ]),
        },
        Roles: [
          {
            Ref: Match.stringLikeRegexp('.*JobDispatcherFunctionRole.*'),
          },
        ],
      });

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'states:StartExecution',
              Effect: 'Allow',
              Resource: Match.anyValue(),
            }),
          ]),
        },
        Roles: [
          {
            Ref: Match.stringLikeRegexp('.*JobDispatcherFunctionRole.*'),
          },
        ],
      });
    });
  });

  describe('Event Sources', () => {
    it('configures SQS event source for job dispatcher function', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
        BatchSize: 1,
        EventSourceArn: {
          'Fn::GetAtt': [Match.stringLikeRegexp('TestQueue.*'), 'Arn'],
        },
      });
    });
  });

  describe('Dev Mode Configuration', () => {
    it('attaches SSM policy to SageMaker role when DEPLOYMENT_MODE is dev', () => {
      const devApp = new App({
        context: {
          DEPLOYMENT_MODE: 'dev',
        },
      });
      const devStack = new Stack(devApp, 'DevTestStack');

      const devTable = new TableV2(devStack, 'TestTable', {
        partitionKey: { name: 'pk', type: AttributeType.STRING },
        sortKey: { name: 'sk', type: AttributeType.STRING },
      });
      const devBucket = new Bucket(devStack, 'TestBucket');
      const devQueue = new Queue(devStack, 'TestQueue');

      new Workflow(devStack, 'TestWorkflow', {
        dynamoDBTable: devTable,
        modelStorageBucket: devBucket,
        workflowJobQueue: devQueue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(devStack);

      expect(() => {
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Sid: 'AllowSSM',
                Action: [
                  'ssmmessages:CreateControlChannel',
                  'ssmmessages:CreateDataChannel',
                  'ssmmessages:OpenControlChannel',
                  'ssmmessages:OpenDataChannel',
                ],
                Effect: 'Allow',
                Resource: '*',
              }),
            ]),
          },
          Roles: [
            {
              Ref: Match.stringLikeRegexp('.*SageMakerRole.*'),
            },
          ],
        });
      }).not.toThrow();
    });

    it('does not attach SSM policy to SageMaker role when DEPLOYMENT_MODE is not dev', () => {
      const prodApp = new App({
        context: {
          DEPLOYMENT_MODE: 'prod',
        },
      });
      const prodStack = new Stack(prodApp, 'ProdTestStack');

      const prodTable = new TableV2(prodStack, 'TestTable', {
        partitionKey: { name: 'pk', type: AttributeType.STRING },
        sortKey: { name: 'sk', type: AttributeType.STRING },
      });
      const prodBucket = new Bucket(prodStack, 'TestBucket');
      const prodQueue = new Queue(prodStack, 'TestQueue');

      new Workflow(prodStack, 'TestWorkflow', {
        dynamoDBTable: prodTable,
        modelStorageBucket: prodBucket,
        workflowJobQueue: prodQueue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(prodStack);

      // Should NOT have the SshSsmAgent policy
      expect(() => {
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Sid: 'AllowSSM',
              }),
            ]),
          },
        });
      }).toThrow();
    });
  });

  describe('SageMaker Instance Type Configuration', () => {
    it('includes SAGEMAKER_INSTANCE_TYPE in job initializer environment when context is set', () => {
      const customApp = new App({
        context: {
          SAGEMAKER_INSTANCE_TYPE: 'ml.g4dn.2xlarge',
        },
      });
      const customStack = new Stack(customApp, 'CustomTestStack');

      const customTable = new TableV2(customStack, 'TestTable', {
        partitionKey: { name: 'pk', type: AttributeType.STRING },
        sortKey: { name: 'sk', type: AttributeType.STRING },
      });
      const customBucket = new Bucket(customStack, 'TestBucket');
      const customQueue = new Queue(customStack, 'TestQueue');

      new Workflow(customStack, 'TestWorkflow', {
        dynamoDBTable: customTable,
        modelStorageBucket: customBucket,
        workflowJobQueue: customQueue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(customStack);

      expect(() => {
        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyWorkflow-JobInitializerFn`,
          Environment: {
            Variables: Match.objectLike({
              SAGEMAKER_INSTANCE_TYPE: 'ml.g4dn.2xlarge',
            }),
          },
        });
      }).not.toThrow();
    });
  });

  describe('Resource Grants', () => {
    it('grants DynamoDB permissions to all Lambda functions', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Should have multiple policies granting DynamoDB access
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['dynamodb:BatchGetItem', 'dynamodb:GetRecords', 'dynamodb:GetShardIterator']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    it('grants S3 permissions to SageMaker role and Lambda functions', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Should have multiple policies granting S3 access
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['s3:GetObject*', 's3:GetBucket*', 's3:List*']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    it('grants SQS permissions to job dispatcher function', () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['sqs:ReceiveMessage', 'sqs:DeleteMessage']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });
});
