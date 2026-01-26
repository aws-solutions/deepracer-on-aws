// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Alarm, AlarmRule, CompositeAlarm, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { IVpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { ManagedPolicy, Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import {
  ApplicationLogLevel,
  Architecture,
  DockerImageCode,
  DockerImageFunction,
  LoggingFormat,
} from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import {
  Chain,
  Choice,
  Condition,
  DefinitionBody,
  Fail,
  LogLevel,
  Pass,
  StateMachine,
  Succeed,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

import { EcrStack } from '../../stacks/ecrStack.js';
import { addCfnGuardSuppression } from '../common/cfnGuardHelper.js';
import { KmsHelper } from '../common/kmsHelper.js';
import { DefaultLogRemovalPolicy, LogGroupCategory, LogGroupsHelper } from '../common/logGroupsHelper.js';
import { NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

export interface importWorkflowProps {
  dynamoDBTable: TableV2;
  modelStorageBucket: Bucket;
  uploadBucket: Bucket;
  userExecutionVpc: IVpc;
  userExecutionSecurityGroup: SecurityGroup;
  rewardFunctionValidationLambda: DockerImageFunction;
  ecrStack: EcrStack;
  namespace: string;
}

export class ImportWorkflow extends Construct {
  public readonly stateMachine: StateMachine;
  public readonly importModelAssetsFunction: NodeLambdaFunction;
  public readonly modelValidationCompletionFunction: NodeLambdaFunction;
  public readonly importModelDispatcherFunction: NodeLambdaFunction;
  public readonly importModelDlqProcessorFunction: NodeLambdaFunction;
  public readonly importModelJobQueue: Queue;
  public readonly importModelJobDlq: Queue;
  public readonly modelValidationLambda: DockerImageFunction;
  public readonly lambdaErrorsAlarm: CompositeAlarm;

  constructor(scope: Construct, id: string, props: importWorkflowProps) {
    super(scope, id);

    const { dynamoDBTable, modelStorageBucket, uploadBucket, rewardFunctionValidationLambda, ecrStack, namespace } =
      props;

    // Create Import Model Queues
    this.importModelJobDlq = new Queue(this, 'ImportModelDLQ', {
      encryption: QueueEncryption.KMS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      retentionPeriod: Duration.days(1),
      visibilityTimeout: Duration.minutes(6),
    });

    this.importModelJobQueue = new Queue(this, 'ImportModelJobQueue', {
      encryption: QueueEncryption.KMS_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      retentionPeriod: Duration.hours(1),
      visibilityTimeout: Duration.minutes(6),
      deadLetterQueue: {
        queue: this.importModelJobDlq,
        maxReceiveCount: 2,
      },
    });

    // Find the model validation ECR repository mapping from EcrStack
    const modelValidationMapping = ecrStack.imageRepositoryMappings.find(
      (mapping) => mapping.repositoryId === this.node.getContext('MODEL_VALIDATION_REPO_NAME'),
    );

    if (!modelValidationMapping) {
      throw new Error('Model validation ECR repository mapping not found in EcrStack');
    }

    const functionName = `${namespace}-DeepRacerImportWorkflow-ValidationFn`;
    this.modelValidationLambda = new DockerImageFunction(this, 'ModelValidationLambda', {
      functionName,
      code: DockerImageCode.fromEcr(modelValidationMapping.repository, {
        tagOrDigest: modelValidationMapping.imageTag,
      }),
      architecture: Architecture.X86_64,
      timeout: Duration.minutes(15),
      memorySize: 2048,
      loggingFormat: LoggingFormat.JSON,
      applicationLogLevelV2: ApplicationLogLevel.DEBUG,
      logGroup: LogGroupsHelper.getOrCreateLogGroup(scope, id, {
        functionName,
        logGroupCategory: LogGroupCategory.WORKFLOW,
        namespace,
      }),
      environment: {
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyModelValidation',
        DATABASE_NAME: dynamoDBTable.tableName,
        namespace,
      },
    });

    // Add ECR dependency only to this specific lambda function
    this.modelValidationLambda.node.addDependency(ecrStack);

    // Grant the model validation Lambda access to the ECR repository
    modelValidationMapping.repository.grantPull(this.modelValidationLambda);

    // Grant the model validation Lambda access to the upload bucket
    uploadBucket.grantRead(this.modelValidationLambda);
    uploadBucket.grantPut(this.modelValidationLambda);

    addCfnGuardSuppression(this.modelValidationLambda, ['LAMBDA_INSIDE_VPC', 'LAMBDA_CONCURRENCY_CHECK']);

    // Import Model DLQ Processor Lambda Function
    this.importModelDlqProcessorFunction = new NodeLambdaFunction(this, 'ImportModelDlqProcessorFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/import-workflow/handlers/importModelDlqProcessor.ts'),
      functionName: 'DeepRacerImportWorkflow-DlqProcessorFn',
      logGroupCategory: LogGroupCategory.WORKFLOW,
      namespace,
      timeout: Duration.minutes(1),
      environment: {
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyImportWorkflow',
      },
    });

    dynamoDBTable.grantReadWriteData(this.importModelDlqProcessorFunction);
    this.importModelJobDlq.grantConsumeMessages(this.importModelDlqProcessorFunction);

    this.importModelDlqProcessorFunction.addEventSource(new SqsEventSource(this.importModelJobDlq, { batchSize: 10 }));

    // Import Model Assets Lambda Function
    this.importModelAssetsFunction = new NodeLambdaFunction(this, 'ImportModelAssetsFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/import-workflow/handlers/importModelAssets.ts'),
      functionName: 'DeepRacerImportWorkflow-ImportModelAssetsFn',
      logGroupCategory: LogGroupCategory.WORKFLOW,
      namespace,
      timeout: Duration.minutes(5),
      environment: {
        MODEL_DATA_BUCKET_NAME: modelStorageBucket.bucketName,
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyImportWorkflow',
      },
    });

    dynamoDBTable.grantReadWriteData(this.importModelAssetsFunction);
    modelStorageBucket.grantReadWrite(this.importModelAssetsFunction);
    uploadBucket.grantRead(this.importModelAssetsFunction);

    this.importModelAssetsFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject', 's3:ListBucket'],
        resources: [uploadBucket.bucketArn, `${uploadBucket.bucketArn}/*`],
      }),
    );

    // Model Validation Completion Lambda Function
    this.modelValidationCompletionFunction = new NodeLambdaFunction(this, 'ModelValidationCompletionFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/import-workflow/handlers/importModelCompletion.ts'),
      functionName: 'DeepRacerImportWorkflow-ValidationCompletionFn',
      logGroupCategory: LogGroupCategory.WORKFLOW,
      namespace,
      timeout: Duration.minutes(2),
      environment: {
        MODEL_DATA_BUCKET_NAME: modelStorageBucket.bucketName,
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyImportWorkflow',
      },
    });

    dynamoDBTable.grantReadWriteData(this.modelValidationCompletionFunction);

    // Define Step Function states
    const successEndState = new Succeed(this, 'Import succeeded');
    const failureEndState = new Fail(this, 'Import failed');

    // Single completion lambda that handles all cases
    const completionLambda = new LambdaInvoke(this, 'Complete Import', {
      lambdaFunction: this.modelValidationCompletionFunction,
      payload: TaskInput.fromObject({
        'modelId.$': '$.modelId',
        'profileId.$': '$.profileId',
        'allValidationData.$': '$',
      }),
    })
      .addCatch(failureEndState)
      .next(successEndState);

    const importModelAssetsInvocation = new LambdaInvoke(this, 'Import Model Assets', {
      lambdaFunction: this.importModelAssetsFunction,
      resultPath: '$.importAssetsResult',
    }).addCatch(completionLambda);

    const rewardFunctionValidationInvocation = new LambdaInvoke(this, 'Validate Reward Function', {
      lambdaFunction: rewardFunctionValidationLambda,
      payload: TaskInput.fromObject({
        'reward_function.$': '$.rewardFunction',
        'track_name.$': '$.trackName',
      }),
      resultPath: '$.rewardValidationResult',
    });

    const modelValidationInvocation = new LambdaInvoke(this, 'Validate Model', {
      lambdaFunction: this.modelValidationLambda,
      payload: TaskInput.fromObject({
        's3_bucket.$': '$.s3Bucket',
        's3_prefix.$': '$.s3Prefix',
        'aws_region.$': '$.awsRegion',
      }),
      resultPath: '$.validationResult',
    });

    const checkModelValidation = new Pass(this, 'Check Model Validation', {
      parameters: {
        'validationBody.$': 'States.StringToJson($.validationResult.Payload.body)',
      },
      resultPath: '$.parsedModelValidation',
    });

    const modelValidationChoice = new Choice(this, 'Model Validation Choice')
      .when(
        Condition.stringEquals('$.parsedModelValidation.validationBody', 'valid'),
        importModelAssetsInvocation.next(completionLambda),
      )
      .otherwise(completionLambda);

    const checkRewardValidation = new Pass(this, 'Check Reward Validation', {
      parameters: {
        'validationErrors.$': 'States.StringToJson($.rewardValidationResult.Payload.body)',
      },
      resultPath: '$.parsedRewardValidation',
    });

    const rewardValidationChoice = new Choice(this, 'Reward Validation Choice')
      .when(Condition.isPresent('$.parsedRewardValidation.validationErrors[0]'), completionLambda)
      .otherwise(modelValidationInvocation.next(checkModelValidation).next(modelValidationChoice));

    const encryptionKey = KmsHelper.get(this, namespace);
    this.stateMachine = new StateMachine(this, 'ImportModelStateMachine', {
      definitionBody: DefinitionBody.fromChainable(
        Chain.start(rewardFunctionValidationInvocation).next(checkRewardValidation).next(rewardValidationChoice),
      ),
      stateMachineName: `${namespace}-DeepRacerImportModelWorkflow`,
      logs: {
        destination: new LogGroup(this, 'ImportExecutionLogs', {
          logGroupName: `/aws/vendedlogs/states/${namespace}-DeepRacerIndyImportModelWorkflow`,
          removalPolicy: DefaultLogRemovalPolicy,
          encryptionKey,
        }),
        includeExecutionData: true,
        level: LogLevel.ALL,
      },
      tracingEnabled: true,
    });

    encryptionKey.grantEncryptDecrypt(this.stateMachine);

    // Composite alarm for Lambda function errors
    const importAssetsErrorAlarm = new Alarm(this, 'ImportAssetsErrorAlarm', {
      metric: this.importModelAssetsFunction.metricErrors(),
      threshold: 10,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    const completionErrorAlarm = new Alarm(this, 'CompletionErrorAlarm', {
      metric: this.modelValidationCompletionFunction.metricErrors(),
      threshold: 10,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    const dlqProcessorErrorAlarm = new Alarm(this, 'DlqProcessorErrorAlarm', {
      metric: this.importModelDlqProcessorFunction.metricErrors(),
      threshold: 10,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    const rewardValidationErrorAlarm = new Alarm(this, 'RewardValidationErrorAlarm', {
      metric: new Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: {
          FunctionName: rewardFunctionValidationLambda.functionName,
        },
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    const modelValidationErrorAlarm = new Alarm(this, 'ModelValidationErrorAlarm', {
      metric: new Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: {
          FunctionName: this.modelValidationLambda.functionName,
        },
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    this.lambdaErrorsAlarm = new CompositeAlarm(this, 'ImportModelLambdaErrorsAlarm', {
      alarmDescription: 'Composite alarm for import model workflow Lambda errors',
      alarmRule: AlarmRule.anyOf(
        importAssetsErrorAlarm,
        completionErrorAlarm,
        dlqProcessorErrorAlarm,
        rewardValidationErrorAlarm,
        modelValidationErrorAlarm,
      ),
    });

    const importModelDispatcherRole = new Role(this, 'ImportModelDispatcherFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    const stepFunctionPolicy = new Policy(this, 'ImportModelDispatcherStepFunctionPolicy', {
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ['states:StartExecution'],
            resources: [this.stateMachine.stateMachineArn],
          }),
        ],
      }),
    });

    importModelDispatcherRole.attachInlinePolicy(stepFunctionPolicy);

    this.importModelDispatcherFunction = new NodeLambdaFunction(this, 'ImportModelDispatcherFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/import-workflow/handlers/importModelDispatcher.ts'),
      functionName: 'DeepRacerImportWorkflow-ImportDispatcherFn',
      logGroupCategory: LogGroupCategory.WORKFLOW,
      namespace,
      timeout: Duration.minutes(1),
      environment: {
        MODEL_DATA_BUCKET_NAME: modelStorageBucket.bucketName,
        IMPORT_MODEL_WORKFLOW_STATE_MACHINE_ARN: this.stateMachine.stateMachineArn,
        IMPORT_MODEL_JOB_QUEUE_URL: this.importModelJobQueue.queueUrl,
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyImportWorkflow',
      },
      memorySize: 256,
      role: importModelDispatcherRole,
    });

    dynamoDBTable.grantReadWriteData(this.importModelDispatcherFunction);
    this.importModelJobQueue.grantConsumeMessages(this.importModelDispatcherFunction);
    this.importModelJobQueue.grantSendMessages(this.importModelDispatcherFunction);

    this.importModelDispatcherFunction.addEventSource(new SqsEventSource(this.importModelJobQueue, { batchSize: 1 }));
  }
}
