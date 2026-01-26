// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { beforeAll, describe, expect, it } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { EcrStack } from '../../../stacks/ecrStack.js';
import { Api } from '../../api/api.js';
import { ImageRepositoryMapping } from '../../ecr-image-downloader/index.js';
import { GlobalSettings } from '../../storage/appConfig.js';

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

describe('Import Workflow', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App({
      context: {
        REWARD_VALIDATION_REPO_NAME: 'deepracer-on-aws-reward-function-validation',
        MODEL_VALIDATION_REPO_NAME: 'deepracer-on-aws-model-validation',
      },
    });
    const stack = new Stack(app, 'TestStack');

    const userPool = new UserPool(stack, 'TestUserPool');
    expect(stack).toBeDefined();
    const table = new TableV2(stack, 'TestTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
    });
    const bucket = new Bucket(stack, 'TestBucket', { removalPolicy: RemovalPolicy.DESTROY });
    const vpc = new Vpc(stack, 'TestVpc');
    const securityGroup = new SecurityGroup(stack, 'TestSecurityGroup', { vpc });
    const globalSettings = new GlobalSettings(stack, 'TestGlobalSettings', {
      namespace: TEST_NAMESPACE,
    });

    // Create mock EcrStack
    const mockEcrStack = new MockEcrStack(stack, 'MockEcrStack') as unknown as EcrStack;

    new Api(stack, 'TestApi', {
      userPool,
      dynamoDBTable: table,
      modelStorageBucket: bucket,
      uploadBucket: bucket,
      virtualModelBucket: bucket,
      ecrStack: mockEcrStack,
      userExecutionVpc: vpc,
      userExecutionSecurityGroup: securityGroup,
      globalSettings,
      namespace: TEST_NAMESPACE,
    });

    template = Template.fromStack(stack);
  });

  it('creates import workflow Lambda functions', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerImportWorkflow-ImportDispatcherFn`,
      }),
    ).not.toThrow();

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerImportWorkflow-ImportModelAssetsFn`,
      }),
    ).not.toThrow();

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerImportWorkflow-DlqProcessorFn`,
      }),
    ).not.toThrow();

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerImportWorkflow-ValidationCompletionFn`,
      }),
    ).not.toThrow();
  });

  it('creates validation Lambda functions', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndy-RewardFunctionValidationFn`,
      }),
    ).not.toThrow();

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerImportWorkflow-ValidationFn`,
      }),
    ).not.toThrow();
  });

  it('creates SQS and DLQ queues with correct configuration', () => {
    expect(() =>
      template.hasResourceProperties('AWS::SQS::Queue', {
        MessageRetentionPeriod: Duration.hours(1).toSeconds(),
        KmsMasterKeyId: 'alias/aws/sqs',
        VisibilityTimeout: Duration.minutes(6).toSeconds(),
      }),
    ).not.toThrow();

    expect(() =>
      template.hasResourceProperties('AWS::SQS::Queue', {
        MessageRetentionPeriod: Duration.days(1).toSeconds(),
        KmsMasterKeyId: 'alias/aws/sqs',
        VisibilityTimeout: Duration.minutes(6).toSeconds(),
      }),
    ).not.toThrow();
  });

  it('creates DLQ alarm', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'ApproximateNumberOfMessagesVisible',
        Namespace: 'AWS/SQS',
        Threshold: 5,
        EvaluationPeriods: 1,
        TreatMissingData: 'notBreaching',
      }),
    ).not.toThrow();
  });

  it('configures ImportModel Lambda environment variables', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndyApi-ImportModelFunction`,
        Environment: {
          Variables: Match.objectLike({
            IMPORT_MODEL_JOB_QUEUE_URL: Match.anyValue(),
          }),
        },
      }),
    ).not.toThrow();
  });
});
