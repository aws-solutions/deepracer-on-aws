// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { TrainingJobStatus } from '@aws-sdk/client-sagemaker';
import { Duration, Stack } from 'aws-cdk-lib';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import {
  ArnPrincipal,
  ManagedPolicy,
  Policy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
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

import { isDevMode } from '#constructs/common/deploymentModeHelper.js';

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
  public readonly jobInitializerFunction: NodeLambdaFunction;
  public readonly jobMonitorFunction: NodeLambdaFunction;
  public readonly jobFinalizerFunction: NodeLambdaFunction;

  constructor(scope: Construct, id: string, props: WorkflowProps) {
    super(scope, id);

    const { dynamoDBTable, modelStorageBucket, workflowJobQueue, simAppRepositoryUri, namespace } = props;
    const region = Stack.of(this).region;
    const account = Stack.of(this).account;

    const sageMakerRole = new Role(this, 'SageMakerRole', {
      assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
    });

    // ABAC session-tag chaining: SageMaker chains the profile-id tag onto this role's session,
    // scoping S3 access to the caller's profile prefix.
    // Note: no tag-key restriction here. SageMaker passes its own internal tags alongside the
    // chained profile-id tag; a ForAllValues:StringEquals condition rejects them.
    sageMakerRole.assumeRolePolicy?.addStatements(
      new PolicyStatement({
        actions: ['sts:TagSession'],
        principals: [new ServicePrincipal('sagemaker.amazonaws.com')],
      }),
    );

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

    if (isDevMode(scope)) {
      sageMakerRole.attachInlinePolicy(
        new Policy(this, 'SshSsmAgent', {
          document: new PolicyDocument({
            statements: [
              new PolicyStatement({
                sid: 'AllowSSM',
                actions: [
                  'ssmmessages:CreateControlChannel',
                  'ssmmessages:CreateDataChannel',
                  'ssmmessages:OpenControlChannel',
                  'ssmmessages:OpenDataChannel',
                ],
                resources: ['*'],
              }),
            ],
          }),
        }),
      );
    }

    // ABAC-scoped S3 access: the execution role can only access the profile prefix that matches
    // the session tag stamped by the job-creation role (see ABAC session-tag chaining above).
    // All model data lives under {profileId}/models/ (S3PathHelper.ts:17), and cloning reads
    // from the same profileId (SageMakerHelper.ts:204), so per-profile scoping is correct.
    sageMakerRole.addToPolicy(
      new PolicyStatement({
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:DeleteObject',
          's3:AbortMultipartUpload',
          's3:ListMultipartUploadParts',
        ],
        resources: [`${modelStorageBucket.bucketArn}/\${aws:PrincipalTag/profile-id}/*`],
      }),
    );
    sageMakerRole.addToPolicy(
      new PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [modelStorageBucket.bucketArn],
        conditions: {
          StringLike: {
            // eslint-disable-next-line no-template-curly-in-string -- IAM policy variable, not JS template
            's3:prefix': ['${aws:PrincipalTag/profile-id}/*'],
          },
        },
      }),
    );

    const jobInitializerFunction = new NodeLambdaFunction(this, 'JobInitializerFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/jobInitializer.ts'),
      functionName: 'DeepRacerIndyWorkflow-JobInitializerFn',
      logGroupCategory: LogGroupCategory.TRAINING,
      namespace,
      environment: {
        MODEL_DATA_BUCKET_NAME: modelStorageBucket.bucketName,
        SAGEMAKER_ROLE_ARN: sageMakerRole.roleArn,
        SAGEMAKER_TRAINING_IMAGE: simAppRepositoryUri,
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyWorkflow',
        SAGEMAKER_INSTANCE_TYPE: scope.node.tryGetContext('SAGEMAKER_INSTANCE_TYPE') ?? '',
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
    // CreateTrainingJob and iam:PassRole are NOT granted to the jobInitializer's own role.
    // Training job creation is only permitted through the ABAC job-creation role (below), which
    // requires a profile-id session tag — making untagged job creation an IAM impossibility.
    //
    // The capacity recheck performed immediately before CreateTrainingJob reads both training quotas
    // and sums instance usage across every active training job in the account.
    //
    // ListTrainingJobs defines no IAM resource type, so it can only be granted on '*'.
    jobInitializerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['sagemaker:ListTrainingJobs'],
        resources: ['*'],
      }),
    );
    // DescribeTrainingJob is scoped to training jobs in this account and Region, but deliberately NOT
    // to the deepracerindy- prefix: the account-wide "instances across all training jobs" quota
    // (L-00C91CB5) counts jobs this solution did not create, so instance-unit accounting has to read
    // them too. Narrowing this to deepracerindy-* would make foreign describes fail, silently
    // under-report usage, and let the check report capacity that the account does not have.
    jobInitializerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['sagemaker:DescribeTrainingJob'],
        resources: [`arn:aws:sagemaker:${region}:${account}:training-job/*`],
      }),
    );
    jobInitializerFunction.addToRolePolicy(
      new PolicyStatement({
        // Granted on '*' deliberately. The Service Authorization Reference does define a `quota`
        // resource type (arn:aws:servicequotas:<region>:<account>:<serviceCode>/<quotaCode>) and a
        // `servicequotas:service` condition key for GetServiceQuota, so scoping looks possible on
        // paper — but it is unverified against a live account, and getting it wrong fails silently:
        // the capacity check catches AccessDenied, returns UNKNOWN, and every model would sit in
        // WAITING_FOR_CAPACITY forever. Validate with the IAM policy simulator or a test-account
        // deploy before narrowing this.
        actions: ['servicequotas:GetServiceQuota'],
        resources: ['*'],
      }),
    );

    // ── Job-creation role for ABAC session-tag chaining ──────────────────────────
    // Job-creation role for ABAC. The jobInitializer assumes this with a profile-id session tag;
    // SageMaker chains the tag to the execution role, scoping S3 to that profile's prefix.
    // Grants: CreateTrainingJob + PassRole only. Tag is immutable within the session.
    // Defined after jobInitializerFunction to reference its execution role as trust principal.
    const jobInitializerRoleArn = jobInitializerFunction.role?.roleArn;
    if (!jobInitializerRoleArn) {
      throw new Error('JobInitializerFunction must have an execution role');
    }
    const jobCreationRole = new Role(this, 'SageMakerJobCreationRole', {
      assumedBy: new ArnPrincipal(jobInitializerRoleArn).withConditions({
        StringLike: { 'aws:RequestTag/profile-id': '?*' },
        'ForAllValues:StringEquals': { 'aws:TagKeys': ['profile-id'] },
      }),
    });
    // Allow the jobInitializer's execution role to tag the session when assuming this role.
    // Tag-presence conditions ensure an untagged assume yields nothing usable.
    jobCreationRole.assumeRolePolicy?.addStatements(
      new PolicyStatement({
        actions: ['sts:TagSession'],
        principals: [new ArnPrincipal(jobInitializerRoleArn)],
        conditions: {
          StringLike: { 'aws:RequestTag/profile-id': '?*' },
          'ForAllValues:StringEquals': { 'aws:TagKeys': ['profile-id'] },
        },
      }),
    );
    jobCreationRole.addToPolicy(
      new PolicyStatement({
        actions: ['sagemaker:CreateTrainingJob'],
        resources: [`arn:aws:sagemaker:${region}:${account}:training-job/deepracerindy-*`],
      }),
    );
    jobCreationRole.addToPolicy(
      new PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [sageMakerRole.roleArn],
        conditions: {
          StringEquals: {
            'iam:PassedToService': 'sagemaker.amazonaws.com',
          },
        },
      }),
    );
    // Wire the role ARN and grant the Lambda permission to assume it with tags.
    jobInitializerFunction.addEnvironment('SAGEMAKER_JOB_CREATION_ROLE_ARN', jobCreationRole.roleArn);
    jobInitializerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['sts:AssumeRole', 'sts:TagSession'],
        resources: [jobCreationRole.roleArn],
      }),
    );

    const jobMonitorFunction = new NodeLambdaFunction(this, 'JobMonitorFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/jobMonitor.ts'),
      functionName: 'DeepRacerIndyWorkflow-JobMonitorFn',
      logGroupCategory: LogGroupCategory.TRAINING,
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
      logGroupCategory: LogGroupCategory.TRAINING,
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

    this.jobInitializerFunction = jobInitializerFunction;
    this.jobMonitorFunction = jobMonitorFunction;
    this.jobFinalizerFunction = jobFinalizerFunction;
    const successEndState = new Succeed(this, 'Job succeeded');
    const capacityWaitingEndState = new Succeed(this, 'Job waiting for capacity');
    const failureEndState = new Fail(this, 'Job failed');

    const jobFinalizerInvocation = new LambdaInvoke(this, 'Job Finalizer', {
      lambdaFunction: jobFinalizerFunction,
      outputPath: '$.Payload',
    }).addCatch(failureEndState);

    // Cleanup for a job that never reached SageMaker because a training quota had no room. The
    // finalizer deletes the Kinesis stream, skips every SageMaker call, and preserves the
    // WAITING_FOR_CAPACITY status, so this path must end successfully rather than in the failure
    // branch that would mark the model ERROR.
    const capacityCleanupInvocation = new LambdaInvoke(this, 'Capacity cleanup', {
      lambdaFunction: jobFinalizerFunction,
      outputPath: '$.Payload',
    })
      .addCatch(capacityWaitingEndState)
      .next(capacityWaitingEndState);

    const jobInitializerInvocation = new LambdaInvoke(this, 'Job Initializer', {
      lambdaFunction: jobInitializerFunction,
      outputPath: '$.Payload',
    }).addCatch(jobFinalizerInvocation, { resultPath: '$.errorDetails' });

    const jobMonitorInvocation = new LambdaInvoke(this, 'Job Monitor', {
      lambdaFunction: jobMonitorFunction,
      outputPath: '$.Payload',
    }).addCatch(jobFinalizerInvocation, { resultPath: '$.errorDetails' });

    const jobFinalizedChoice = new Choice(this, 'Workflow completed successfully?')
      .when(Condition.isPresent('$.errorDetails'), failureEndState)
      .otherwise(successEndState);

    // `$.trainingJob` is absent whenever initialization stopped before CreateTrainingJob — capacity
    // waiting, a deleted clone source, an S3/Kinesis failure. Reading `$.trainingJob.status` without
    // an isPresent guard raises States.Runtime instead of following a controlled path.
    const jobRunningChoice = new Choice(this, 'Job running?')
      .when(
        Condition.and(
          Condition.isPresent('$.trainingJob.status'),
          Condition.or(
            Condition.stringEquals('$.trainingJob.status', TrainingJobStatus.IN_PROGRESS),
            Condition.stringEquals('$.trainingJob.status', TrainingJobStatus.STOPPING),
          ),
        ),
        new Wait(this, 'Wait while job runs', { time: WaitTime.duration(Duration.minutes(1)) }).next(
          jobMonitorInvocation,
        ),
      )
      .otherwise(jobFinalizerInvocation.next(jobFinalizedChoice));

    const initializationOutcomeChoice = new Choice(this, 'Initialization outcome?')
      .when(
        // `$.capacityWaiting` is only present when the initializer stopped for lack of capacity.
        // A Choice that reads an absent path raises States.Runtime, so presence is checked first.
        Condition.and(Condition.isPresent('$.capacityWaiting'), Condition.booleanEquals('$.capacityWaiting', true)),
        capacityCleanupInvocation,
      )
      .when(Condition.isPresent('$.errorDetails'), jobFinalizerInvocation)
      .otherwise(jobMonitorInvocation.next(jobRunningChoice));

    const encryptionKey = KmsHelper.get(this, namespace);
    const workflow = new StateMachine(this, 'StateMachine', {
      definitionBody: DefinitionBody.fromChainable(
        Chain.start(jobInitializerInvocation).next(initializationOutcomeChoice),
      ),
      stateMachineName: `${namespace}-DeepRacerIndyWorkflow`,
      logs: {
        destination: new LogGroup(this, 'ExecutionLogs', {
          logGroupName: `/aws/vendedlogs/states/${Stack.of(this).stackName}-DeepRacerIndyWorkflow`,
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

    // Create and attach policies to the job dispatcher role.
    // The dispatcher no longer checks SageMaker quotas — CreateModel/RetryTraining gate admission
    // before a message is queued, and JobInitializer rechecks before CreateTrainingJob — so it needs
    // only StartExecution here.
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

    jobDispatcherRole.attachInlinePolicy(jobDispatcherStepFunctionPolicy);

    const jobDispatcherFunction = new NodeLambdaFunction(this, 'JobDispatcherFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/jobDispatcher.ts'),
      functionName: 'DeepRacerIndyWorkflow-JobDispatcherFn',
      logGroupCategory: LogGroupCategory.TRAINING,
      namespace,
      environment: {
        MODEL_DATA_BUCKET_NAME: modelStorageBucket.bucketName,
        WORKFLOW_STATE_MACHINE_ARN: workflow.stateMachineArn,
        WORKFLOW_JOB_QUEUE_URL: workflowJobQueue.queueUrl,
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyWorkflow',
      },
      memorySize: 256,
      // Adaptive SageMaker retries make a dispatch slower than the 30s default; a timeout
      // would redeliver the message and double-dispatch the training job.
      timeout: Duration.minutes(2),
      role: jobDispatcherRole,
    });

    dynamoDBTable.grantReadWriteData(jobDispatcherFunction);
    workflowJobQueue.grantConsumeMessages(jobDispatcherFunction);
    workflowJobQueue.grantSendMessages(jobDispatcherFunction);

    jobDispatcherFunction.addEventSource(new SqsEventSource(workflowJobQueue, { batchSize: 1 }));
  }
}
