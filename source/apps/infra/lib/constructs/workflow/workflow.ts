// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { TrainingJobStatus } from '@aws-sdk/client-sagemaker';
import { Duration, Stack } from 'aws-cdk-lib';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import {
  Chain,
  Choice,
  Condition,
  DefinitionBody,
  Fail,
  LogLevel,
  StateMachine,
  Succeed,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

import { KmsHelper } from '../common/kmsHelper.js';
import { DefaultLogRemovalPolicy, DefaultLogRetentionDays, LogGroupCategory } from '../common/logGroupsHelper.js';
import { NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

export interface WorkflowProps {
  dynamoDBTable: TableV2;
  modelStorageBucket: Bucket;
  workflowJobQueue: Queue;
  simAppRepositoryUri: string;
  namespace: string;
}

export class Workflow extends Construct {
  constructor(scope: Construct, id: string, props: WorkflowProps) {
    super(scope, id);

    const { dynamoDBTable, modelStorageBucket, workflowJobQueue, simAppRepositoryUri, namespace } = props;
    const region = Stack.of(this).region;
    const account = Stack.of(this).account;

    const sageMakerRole = new Role(this, 'SageMakerRole', {
      assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
    });

    const sageMakerAccessPolicy = new Policy(this, 'SageMakerAccessPolicy', {
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ['sagemaker:*TrainingJob*'],
            resources: [`arn:aws:sagemaker:${region}:${account}:training-job/deepracerindy-*`],
          }),
          new PolicyStatement({
            actions: ['ecr:GetAuthorizationToken'],
            resources: ['*'],
          }),
          new PolicyStatement({
            actions: ['ecr:BatchCheckLayerAvailability', 'ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
            resources: [`arn:aws:ecr:${region}:${account}:repository/${namespace}-deepracer-on-aws-*`],
          }),
          new PolicyStatement({
            actions: ['kinesisvideo:DescribeStream', 'kinesisvideo:GetDataEndpoint', 'kinesisvideo:PutMedia'],
            resources: [`arn:aws:kinesisvideo:${region}:${account}:stream/deepracerindy-*`],
          }),
          new PolicyStatement({
            actions: ['cloudwatch:PutMetricData'],
            resources: ['*'],
          }),
          new PolicyStatement({
            actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:DescribeLogStreams', 'logs:PutLogEvents'],
            resources: [
              `arn:aws:logs:${region}:${account}:log-group:/aws/sagemaker/TrainingJobs`,
              `arn:aws:logs:${region}:${account}:log-group:/aws/sagemaker/TrainingJobs:log-stream:*`,
              `arn:aws:logs:${region}:${account}:log-group:/aws/deepracer/training/TrainingJobs`,
              `arn:aws:logs:${region}:${account}:log-group:/aws/deepracer/training/TrainingJobs:log-stream:*`,
              `arn:aws:logs:${region}:${account}:log-group:/aws/deepracer/training/SimulationJobs`,
              `arn:aws:logs:${region}:${account}:log-group:/aws/deepracer/training/SimulationJobs:log-stream:*`,
            ],
          }),
          new PolicyStatement({
            // must not have conditions or resource filters
            // will be necessary when SageMaker is setup inside a VPC
            actions: [
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
            resources: ['*'],
          }),
        ],
      }),
    });

    sageMakerRole.attachInlinePolicy(sageMakerAccessPolicy);

    modelStorageBucket.grantReadWrite(sageMakerRole);

    const jobInitializerFunction = new NodeLambdaFunction(this, 'JobInitializerFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/jobInitializer.ts'),
      functionName: 'DeepRacerIndyWorkflow-JobInitializerFn',
      logGroupCategory: LogGroupCategory.WORKFLOW,
      namespace,
      environment: {
        MODEL_DATA_BUCKET_NAME: modelStorageBucket.bucketName,
        SAGEMAKER_ROLE_ARN: sageMakerRole.roleArn,
        SAGEMAKER_TRAINING_IMAGE: simAppRepositoryUri,
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyWorkflow',
      },
    });

    dynamoDBTable.grantReadWriteData(jobInitializerFunction);
    modelStorageBucket.grantReadWrite(jobInitializerFunction);

    jobInitializerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['kinesisvideo:CreateStream'],
        resources: [`arn:aws:kinesisvideo:${region}:${account}:stream/deepracerindy-*`],
      }),
    );
    jobInitializerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['sagemaker:CreateTrainingJob'],
        resources: [`arn:aws:sagemaker:${region}:${account}:training-job/deepracerindy-*`],
      }),
    );
    jobInitializerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [sageMakerRole.roleArn],
      }),
    );

    const jobMonitorFunction = new NodeLambdaFunction(this, 'JobMonitorFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/jobMonitor.ts'),
      functionName: 'DeepRacerIndyWorkflow-JobMonitorFn',
      logGroupCategory: LogGroupCategory.WORKFLOW,
      namespace,
      environment: {
        MODEL_DATA_BUCKET_NAME: modelStorageBucket.bucketName,
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyWorkflow',
      },
    });

    dynamoDBTable.grantReadWriteData(jobMonitorFunction);
    modelStorageBucket.grantReadWrite(jobMonitorFunction);

    jobMonitorFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['sagemaker:DescribeTrainingJob', 'sagemaker:StopTrainingJob'],
        resources: [`arn:aws:sagemaker:${region}:${account}:training-job/deepracerindy-*`],
      }),
    );
    jobMonitorFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['kinesisvideo:GetDataEndpoint', 'kinesisvideo:GetHLSStreamingSessionURL'],
        resources: [`arn:aws:kinesisvideo:${region}:${account}:stream/deepracerindy-*`],
      }),
    );

    const jobFinalizerFunction = new NodeLambdaFunction(this, 'JobFinalizerFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/jobFinalizer.ts'),
      functionName: 'DeepRacerIndyWorkflow-JobFinalizerFn',
      logGroupCategory: LogGroupCategory.WORKFLOW,
      namespace,
      timeout: Duration.seconds(900),
      environment: {
        MODEL_DATA_BUCKET_NAME: modelStorageBucket.bucketName,
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyWorkflow',
      },
    });

    dynamoDBTable.grantReadWriteData(jobFinalizerFunction);
    modelStorageBucket.grantReadWrite(jobFinalizerFunction);

    jobFinalizerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['kinesisVideo:DeleteStream'],
        resources: [`arn:aws:kinesisvideo:${region}:${account}:stream/deepracerindy-*`],
      }),
    );
    jobFinalizerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['logs:DescribeLogGroups', 'logs:DescribeLogStreams', 'logs:GetLogEvents'],
        resources: [
          `arn:aws:logs:${region}:${account}:log-group:/aws/sagemaker/TrainingJobs`,
          `arn:aws:logs:${region}:${account}:log-group:/aws/sagemaker/TrainingJobs:log-stream:*`,
          `arn:aws:logs:${region}:${account}:log-group:/aws/deepracer/training/TrainingJobs`,
          `arn:aws:logs:${region}:${account}:log-group:/aws/deepracer/training/TrainingJobs:log-stream:*`,
          `arn:aws:logs:${region}:${account}:log-group:/aws/deepracer/training/SimulationJobs`,
          `arn:aws:logs:${region}:${account}:log-group:/aws/deepracer/training/SimulationJobs:log-stream:*`,
        ],
      }),
    );
    jobFinalizerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['sagemaker:DescribeTrainingJob', 'sagemaker:StopTrainingJob'],
        resources: [`arn:aws:sagemaker:${region}:${account}:training-job/deepracerindy-*`],
      }),
    );

    const successEndState = new Succeed(this, 'Job succeeded');
    const failureEndState = new Fail(this, 'Job failed');

    const jobFinalizerInvocation = new LambdaInvoke(this, 'Job Finalizer', {
      lambdaFunction: jobFinalizerFunction,
      outputPath: '$.Payload',
    }).addCatch(failureEndState);

    const jobInitializerInvocation = new LambdaInvoke(this, 'Job Initializer', {
      lambdaFunction: jobInitializerFunction,
      outputPath: '$.Payload',
    }).addCatch(jobFinalizerInvocation, { resultPath: '$.errorDetails' });

    const jobMonitorInvocation = new LambdaInvoke(this, 'Job Monitor', {
      lambdaFunction: jobMonitorFunction,
      outputPath: '$.Payload',
    }).addCatch(jobFinalizerInvocation, { resultPath: '$.errorDetails' });

    const encryptionKey = KmsHelper.get(this, namespace);
    const workflow = new StateMachine(this, 'StateMachine', {
      definitionBody: DefinitionBody.fromChainable(
        Chain.start(jobInitializerInvocation)
          .next(jobMonitorInvocation)
          .next(
            new Choice(this, 'Job running?')
              .when(
                Condition.or(
                  Condition.stringEquals('$.trainingJob.status', TrainingJobStatus.IN_PROGRESS),
                  Condition.stringEquals('$.trainingJob.status', TrainingJobStatus.STOPPING),
                ),
                new Wait(this, 'Wait while job runs', { time: WaitTime.duration(Duration.minutes(1)) }).next(
                  jobMonitorInvocation,
                ),
              )
              .otherwise(
                jobFinalizerInvocation.next(
                  new Choice(this, 'Workflow completed successfully?')
                    .when(Condition.isPresent('$.errorDetails'), failureEndState)
                    .otherwise(successEndState),
                ),
              ),
          ),
      ),
      stateMachineName: `${namespace}-DeepRacerIndyWorkflow`,
      logs: {
        destination: new LogGroup(this, 'ExecutionLogs', {
          logGroupName: `/aws/vendedlogs/states/${namespace}-DeepRacerIndyWorkflow`,
          removalPolicy: DefaultLogRemovalPolicy,
          retention: DefaultLogRetentionDays,
          encryptionKey,
        }),
        includeExecutionData: true,
        level: LogLevel.ALL,
      },
      tracingEnabled: true,
    });

    encryptionKey.grantEncryptDecrypt(workflow);

    // Create the job dispatcher role separately
    const jobDispatcherRole = new Role(this, 'JobDispatcherFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    // Create and attach policies to the job dispatcher role
    const jobDispatcherSageMakerPolicy = new Policy(this, 'JobDispatcherSageMakerPolicy', {
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ['sagemaker:ListTrainingJobs'],
            resources: ['*'],
          }),
        ],
      }),
    });

    const jobDispatcherServiceQuotasPolicy = new Policy(this, 'JobDispatcherServiceQuotasPolicy', {
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ['servicequotas:GetServiceQuota'],
            resources: ['*'],
          }),
        ],
      }),
    });

    const jobDispatcherStepFunctionPolicy = new Policy(this, 'JobDispatcherStepFunctionPolicy', {
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ['states:StartExecution'],
            resources: [workflow.stateMachineArn],
          }),
        ],
      }),
    });

    jobDispatcherRole.attachInlinePolicy(jobDispatcherSageMakerPolicy);
    jobDispatcherRole.attachInlinePolicy(jobDispatcherServiceQuotasPolicy);
    jobDispatcherRole.attachInlinePolicy(jobDispatcherStepFunctionPolicy);

    const jobDispatcherFunction = new NodeLambdaFunction(this, 'JobDispatcherFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/jobDispatcher.ts'),
      functionName: 'DeepRacerIndyWorkflow-JobDispatcherFn',
      logGroupCategory: LogGroupCategory.WORKFLOW,
      namespace,
      environment: {
        MODEL_DATA_BUCKET_NAME: modelStorageBucket.bucketName,
        WORKFLOW_STATE_MACHINE_ARN: workflow.stateMachineArn,
        WORKFLOW_JOB_QUEUE_URL: workflowJobQueue.queueUrl,
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyWorkflow',
      },
      memorySize: 256,
      role: jobDispatcherRole,
    });

    dynamoDBTable.grantReadWriteData(jobDispatcherFunction);
    workflowJobQueue.grantConsumeMessages(jobDispatcherFunction);
    workflowJobQueue.grantSendMessages(jobDispatcherFunction);

    jobDispatcherFunction.addEventSource(new SqsEventSource(workflowJobQueue, { batchSize: 1 }));
  }
}
