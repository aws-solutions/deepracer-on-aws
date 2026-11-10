// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { describe, expect, it } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import {
  createNodeLambdaFunctionMock,
  createLogGroupsHelperMock,
  createKmsHelperMock,
} from '../../../constants/testMocks.js';
import { Workflow } from '../workflow.js';

// Mock the KmsHelper to avoid having the single key shared between stacks
vi.mock('#constructs/common/kmsHelper.js', () => createKmsHelperMock());

// Mock the LogGroupsHelper to avoid having the static log groups shared between stacks
vi.mock('#constructs/common/logGroupsHelper.js', () => createLogGroupsHelperMock());

// Mock NodeLambdaFunction to use inline code instead of esbuild bundling.
vi.mock('../../common/nodeLambdaFunction.js', () => createNodeLambdaFunctionMock());

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

      // Verify SageMaker role (AssumeRole + TagSession for ABAC)
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: { Service: 'sagemaker.amazonaws.com' },
            }),
          ]),
        }),
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
        LogGroupName: {
          'Fn::Join': ['', ['/aws/vendedlogs/states/', { Ref: 'AWS::StackName' }, '-DeepRacerIndyWorkflow']],
        },
      });
    });
  });

  describe('State Machine Definition', () => {
    /** The definition is a Fn::Join of literal fragments and resource references. */
    const getDefinition = () => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      const [stateMachine] = Object.values(template.findResources('AWS::StepFunctions::StateMachine'));
      const joined = stateMachine.Properties.DefinitionString['Fn::Join'][1] as unknown[];

      return joined.filter((part): part is string => typeof part === 'string').join('');
    };

    it('routes a capacity-waiting initialization to cleanup and a successful end state', () => {
      const definition = getDefinition();

      expect(definition).toContain('Initialization outcome?');
      expect(definition).toContain('Capacity cleanup');
      expect(definition).toContain('Job waiting for capacity');
      // A capacity wait must not reach the Fail state, which would mark the model ERROR.
      expect(definition).toContain('capacityWaiting');
    });

    it('guards every Choice against an absent path', () => {
      const definition = getDefinition();
      const parsed = JSON.parse(definition);

      // Without these guards, a context missing trainingJob or capacityWaiting raises
      // States.Runtime instead of following a controlled path.
      const [jobRunningRule] = parsed.States['Job running?'].Choices;
      expect(jobRunningRule.And[0]).toEqual({ Variable: '$.trainingJob.status', IsPresent: true });

      const [capacityRule] = parsed.States['Initialization outcome?'].Choices;
      expect(capacityRule.And[0]).toEqual({ Variable: '$.capacityWaiting', IsPresent: true });
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

      // Check for SageMaker role with correct assume role policy (AssumeRole + TagSession)
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: { Service: 'sagemaker.amazonaws.com' },
            }),
            Match.objectLike({
              Action: 'sts:TagSession',
              Effect: 'Allow',
              Principal: { Service: 'sagemaker.amazonaws.com' },
            }),
          ]),
        }),
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
        // Shared by the training and evaluation execution roles.
        Roles: [
          { Ref: Match.stringLikeRegexp('.*WorkflowSageMakerRole.*') },
          { Ref: Match.stringLikeRegexp('.*WorkflowSageMakerEvaluationRole.*') },
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

      // The dispatcher no longer performs a capacity check, so its role holds only StartExecution.
      // CreateModel/RetryTraining gate admission before enqueueing, and JobInitializer rechecks.
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

    it('grants the job initializer the permissions its capacity recheck needs', () => {
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
            // ListTrainingJobs defines no IAM resource type, so '*' is the only option.
            Match.objectLike({
              Action: 'sagemaker:ListTrainingJobs',
              Effect: 'Allow',
              Resource: '*',
            }),
            // Scoped to this account and Region. Not narrowed to deepracerindy-*: the account-wide
            // instance quota counts training jobs this solution did not create.
            Match.objectLike({
              Action: 'sagemaker:DescribeTrainingJob',
              Effect: 'Allow',
              Resource: {
                'Fn::Join': Match.arrayWith([Match.arrayWith([Match.stringLikeRegexp('.*:training-job/\\*')])]),
              },
            }),
            Match.objectLike({
              Action: 'servicequotas:GetServiceQuota',
              Effect: 'Allow',
              Resource: '*',
            }),
          ]),
        },
        Roles: [
          {
            Ref: Match.stringLikeRegexp('.*JobInitializerFunctionServiceRole.*'),
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
            { Ref: Match.stringLikeRegexp('.*SageMakerRole.*') },
            { Ref: Match.stringLikeRegexp('.*SageMakerEvaluationRole.*') },
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
              Action: Match.arrayWith(['dynamodb:BatchGetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem']),
              Effect: 'Allow',
            }),
            Match.objectLike({
              Action: Match.arrayWith(['dynamodb:GetRecords', 'dynamodb:GetShardIterator']),
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

  describe('ABAC Session-Tag Chaining', () => {
    let template: Template;

    beforeEach(() => {
      new Workflow(stack, 'TestWorkflow', {
        dynamoDBTable: table,
        modelStorageBucket: bucket,
        workflowJobQueue: queue,
        simAppRepositoryUri: 'test-repo-uri',
        namespace: TEST_NAMESPACE,
      });
      template = Template.fromStack(stack);
    });

    it('creates a job-creation role with tag-gated trust policy', () => {
      expect(template).toBeDefined();
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Condition: {
                StringLike: { 'aws:RequestTag/profile-id': '?*' },
                'ForAllValues:StringEquals': { 'aws:TagKeys': ['profile-id'] },
              },
            }),
            Match.objectLike({
              Action: 'sts:TagSession',
              Effect: 'Allow',
              Condition: {
                StringLike: { 'aws:RequestTag/profile-id': '?*' },
                'ForAllValues:StringEquals': { 'aws:TagKeys': ['profile-id'] },
              },
            }),
          ]),
        }),
      });
    });

    it('grants CreateTrainingJob and PassRole of the ABAC execution role to the job-creation role', () => {
      expect(template).toBeDefined();
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sagemaker:CreateTrainingJob',
              Effect: 'Allow',
            }),
            Match.objectLike({
              Action: 'iam:PassRole',
              Effect: 'Allow',
              Condition: { StringEquals: { 'iam:PassedToService': 'sagemaker.amazonaws.com' } },
            }),
          ]),
        },
        Roles: [{ Ref: Match.stringLikeRegexp('.*SageMakerJobCreationRole.*') }],
      });
    });

    it('scopes the execution role S3 policy to the ABAC profile-id tag', () => {
      expect(template).toBeDefined();
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['s3:GetObject', 's3:PutObject', 's3:DeleteObject']),
              Effect: 'Allow',
            }),
          ]),
        },
        Roles: [{ Ref: Match.stringLikeRegexp('.*SageMakerRole.*') }],
      });
    });

    it('grants jobInitializer sts:AssumeRole and sts:TagSession on the job-creation role', () => {
      expect(template).toBeDefined();
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['sts:AssumeRole', 'sts:TagSession'],
              Effect: 'Allow',
            }),
          ]),
        },
        Roles: [{ Ref: Match.stringLikeRegexp('.*JobInitializerFunction.*') }],
      });
    });

    it('sets SAGEMAKER_JOB_CREATION_ROLE_ARN on the jobInitializer environment', () => {
      expect(template).toBeDefined();
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyWorkflow-JobInitializerFn`,
        Environment: {
          Variables: Match.objectLike({
            SAGEMAKER_JOB_CREATION_ROLE_ARN: Match.anyValue(),
          }),
        },
      });
    });

    it('lets the jobInitializer create only evaluation and submission jobs, passing only the evaluation role', () => {
      expect(template).toBeDefined();
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sagemaker:CreateTrainingJob',
              Effect: 'Allow',
              Resource: [
                Match.objectLike({
                  'Fn::Join': ['', Match.arrayWith([':training-job/deepracerindy-evaluation-*'])],
                }),
                Match.objectLike({
                  'Fn::Join': ['', Match.arrayWith([':training-job/deepracerindy-submission-*'])],
                }),
              ],
            }),
            Match.objectLike({
              Action: 'iam:PassRole',
              Effect: 'Allow',
              Resource: { 'Fn::GetAtt': [Match.stringLikeRegexp('.*SageMakerEvaluationRole.*'), 'Arn'] },
              Condition: { StringEquals: { 'iam:PassedToService': 'sagemaker.amazonaws.com' } },
            }),
          ]),
        },
        Roles: [{ Ref: Match.stringLikeRegexp('.*JobInitializerFunction.*') }],
      });
    });

    describe('evaluation role S3 access', () => {
      type Statement = { Action: string | string[]; Resource: unknown; Condition?: unknown };

      /** Renders a resource as a string, with the bucket ARN token shown as `{bucket}`. */
      const renderResource = (resource: unknown): string => {
        const join = (resource as { 'Fn::Join'?: [string, unknown[]] })['Fn::Join'];
        if (!join) return String(resource);
        return join[1].map((part) => (typeof part === 'string' ? part : '{bucket}')).join('');
      };

      const evaluationRoleStatements = (): Statement[] => {
        const policies = template.findResources('AWS::IAM::Policy', {
          Properties: { Roles: [{ Ref: Match.stringLikeRegexp('.*SageMakerEvaluationRole.*') }] },
        });
        return Object.values(policies).flatMap(
          (policy) =>
            (policy as { Properties: { PolicyDocument: { Statement: Statement[] } } }).Properties.PolicyDocument
              .Statement,
        );
      };

      const actionsOf = (statement: Statement) =>
        Array.isArray(statement.Action) ? statement.Action : [statement.Action];
      const resourcesOf = (statement: Statement) =>
        (Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource]).map(renderResource);

      it('reads and lists only the model folder and the job YAML', () => {
        const statements = evaluationRoleStatements();

        const readResources = statements.filter((s) => actionsOf(s).includes('s3:GetObject')).flatMap(resourcesOf);
        expect(readResources).toEqual([
          '{bucket}/*/models/*/sagemaker-artifacts/model/*',
          '{bucket}/*/models/*/sagemaker-artifacts/training_params.yaml',
        ]);

        const list = statements.find((s) => actionsOf(s).includes('s3:ListBucket'));
        expect(list?.Condition).toEqual({
          StringLike: { 's3:prefix': ['*/models/*/sagemaker-artifacts/model*'] },
        });
      });

      it('writes only job outputs and the checkpoint pointer', () => {
        const write = evaluationRoleStatements().find((s) => actionsOf(s).includes('s3:PutObject'));

        expect(write && actionsOf(write)).toEqual(['s3:PutObject', 's3:AbortMultipartUpload']);
        expect(write && resourcesOf(write)).toEqual([
          '{bucket}/*/models/*/sagemaker-artifacts/model/.coach_checkpoint',
          '{bucket}/*/models/*/sagemaker-artifacts/model/.ready',
          '{bucket}/*/models/*/sagemaker-artifacts/evaluation_job_status.json',
          '{bucket}/*/models/*/sagemaker-artifacts/deepracerindy-evaluation-*',
          '{bucket}/*/models/*/metrics/evaluation/*',
          '{bucket}/*/models/*/sim-trace/evaluation/*',
          '{bucket}/*/models/*/videos/evaluation/*',
          '{bucket}/*/models/*/sagemaker-artifacts/submission_job_status.json',
          '{bucket}/*/models/*/sagemaker-artifacts/deepracerindy-submission-*',
          '{bucket}/*/models/*/metrics/submission/*',
          '{bucket}/*/models/*/sim-trace/submission/*',
          '{bucket}/*/models/*/videos/submission/*',
        ]);
      });

      it('cannot delete objects or write model files', () => {
        const statements = evaluationRoleStatements();

        expect(statements.flatMap(actionsOf)).not.toContain('s3:DeleteObject');
        const writtenResources = statements.filter((s) => actionsOf(s).includes('s3:PutObject')).flatMap(resourcesOf);
        expect(writtenResources).not.toContain('{bucket}/*/models/*');
        expect(
          writtenResources.some((r) => /model_metadata\.json|reward_function\.py|\.ckpt|training_params/.test(r)),
        ).toBe(false);
      });
    });

    it('sets SAGEMAKER_EVALUATION_ROLE_ARN on the jobInitializer environment', () => {
      expect(template).toBeDefined();
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyWorkflow-JobInitializerFn`,
        Environment: {
          Variables: Match.objectLike({
            SAGEMAKER_EVALUATION_ROLE_ARN: {
              'Fn::GetAtt': [Match.stringLikeRegexp('.*SageMakerEvaluationRole.*'), 'Arn'],
            },
          }),
        },
      });
    });

    it('restricts sageMakerRole sts:TagSession to sagemaker.amazonaws.com', () => {
      expect(template).toBeDefined();
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:TagSession',
              Effect: 'Allow',
              Principal: { Service: 'sagemaker.amazonaws.com' },
            }),
          ]),
        }),
      });
    });
  });
});
