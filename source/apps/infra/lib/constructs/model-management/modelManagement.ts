// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration, RemovalPolicy, Size, Stack } from 'aws-cdk-lib';
import { Alarm, AlarmRule, ComparisonOperator, CompositeAlarm, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { CfnMalwareProtectionPlan } from 'aws-cdk-lib/aws-guardduty';
import { PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import {
  ApplicationLogLevel,
  Architecture,
  DockerImageCode,
  DockerImageFunction,
  LoggingFormat,
  Tracing,
} from 'aws-cdk-lib/aws-lambda';
import { SqsDestination } from 'aws-cdk-lib/aws-lambda-destinations';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import { getModelOptimizerFunctionName } from '#constants/lambdaNames.js';
import { OperationsOwnedBy } from '#constants/operationOwnership.js';
import { addCfnGuardSuppression } from '#constructs/common/cfnGuardHelper.js';
import { CompositeAlarmWrapper } from '#constructs/common/compositeAlarmWrapper.js';
import { isDevMode } from '#constructs/common/deploymentModeHelper.js';
import { createEpicFunctions, EpicFunctionProps, lambdaEntryPath } from '#constructs/common/epicConstructHelpers.js';
import { DefaultLogRemovalPolicy, DefaultLogRetentionDays } from '#constructs/common/logGroupsHelper.js';
import { NodeLambdaFunction } from '#constructs/common/nodeLambdaFunction.js';

import { PushWorkflow } from './pushWorkflow.js';

type ModelManagementOperation = OperationsOwnedBy<'modelManagement'>;

const ENTRY_POINTS = {
  PackageModel: 'api/handlers/packageModel',
  ImportPhysicalModel: 'api/handlers/importPhysicalModel',
  DeployModel: 'api/handlers/deployModel',
  GetDeployment: 'api/handlers/getDeployment',
  ListAdminModels: 'api/handlers/listAdminModels',
  ListDeployments: 'api/handlers/listDeployments',
  ListDeploymentsByBatch: 'api/handlers/listDeploymentsByBatch',
  ListDeploymentsByEvent: 'api/handlers/listDeploymentsByEvent',
} as const satisfies Record<ModelManagementOperation, string>;

export interface ModelManagementProps {
  readonly namespace: string;
  readonly dynamoDBTable: TableV2;
  readonly userPool: IUserPool;
  readonly modelStorageBucket: Bucket;
  readonly uploadBucket: Bucket;
  readonly encryptionKey: IKey;
  readonly modelOptimizerRepositoryArn: string;
  readonly modelOptimizerRepositoryName: string;
  readonly modelOptimizerImageTag: string;
  readonly importModelJobQueueUrl: string;
  readonly importModelJobQueueArn: string;
}

export class ModelManagement extends Construct {
  public readonly handlerArns: Readonly<Record<ModelManagementOperation, string>>;
  public readonly alarms: readonly (Alarm | CompositeAlarm)[];
  public readonly logGroups: readonly LogGroup[];

  constructor(scope: Construct, id: string, props: ModelManagementProps) {
    super(scope, id);

    const {
      namespace,
      dynamoDBTable,
      userPool,
      modelStorageBucket,
      uploadBucket,
      encryptionKey,
      modelOptimizerRepositoryArn,
      modelOptimizerRepositoryName,
      modelOptimizerImageTag,
      importModelJobQueueUrl,
      importModelJobQueueArn,
    } = props;

    const enableGuardDuty = this.node.tryGetContext('ENABLE_GUARDDUTY_MALWARE_SCAN') !== 'false';

    // ── Async Optimizer DLQ ──────────────────────────────────────────────────
    const asyncOptimizerDlq = new Queue(this, 'AsyncOptimizerDlq', {
      encryption: QueueEncryption.KMS_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      retentionPeriod: Duration.days(1),
      visibilityTimeout: Duration.minutes(6),
    });

    // ── Model Optimizer Lambda (Docker) ──────────────────────────────────────
    const optimizerFunctionName = getModelOptimizerFunctionName(namespace);

    const modelOptimizerRepository = Repository.fromRepositoryAttributes(this, 'OptimizerRepo', {
      repositoryArn: modelOptimizerRepositoryArn,
      repositoryName: modelOptimizerRepositoryName,
    });

    const optimizerLogGroup = new LogGroup(this, 'ModelOptimizerLogGroup', {
      retention: DefaultLogRetentionDays,
      removalPolicy: DefaultLogRemovalPolicy,
      encryptionKey,
    });

    const modelOptimizerFunction = new DockerImageFunction(this, 'ModelOptimizerLambda', {
      functionName: optimizerFunctionName,
      code: DockerImageCode.fromEcr(modelOptimizerRepository, {
        tagOrDigest: modelOptimizerImageTag,
      }),
      architecture: Architecture.X86_64,
      memorySize: 10240,
      ephemeralStorageSize: Size.mebibytes(4096),
      timeout: Duration.minutes(5),
      tracing: Tracing.ACTIVE,
      retryAttempts: 2,
      onFailure: new SqsDestination(asyncOptimizerDlq),
      loggingFormat: LoggingFormat.JSON,
      applicationLogLevelV2: isDevMode(this) ? ApplicationLogLevel.DEBUG : ApplicationLogLevel.INFO,
      logGroup: optimizerLogGroup,
      environment: {
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyModelOptimizer',
        DATABASE_NAME: dynamoDBTable.tableName,
        MODEL_DATA_BUCKET_NAME: modelStorageBucket.bucketName,
        UPLOAD_BUCKET_NAME: uploadBucket.bucketName,
        ENABLE_GUARDDUTY_MALWARE_SCAN: enableGuardDuty ? 'true' : 'false',
      },
    });

    modelOptimizerRepository.grantPull(modelOptimizerFunction);

    // IAM grants for the optimizer
    dynamoDBTable.grantReadWriteData(modelOptimizerFunction);
    modelStorageBucket.grantRead(modelOptimizerFunction);
    modelOptimizerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [modelStorageBucket.arnForObjects('*/models/*/optimized/*')],
      }),
    );
    modelOptimizerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject', 's3:GetObjectTagging'],
        resources: [uploadBucket.arnForObjects('uploads/physical-models/*')],
      }),
    );

    addCfnGuardSuppression(modelOptimizerFunction, ['LAMBDA_INSIDE_VPC', 'LAMBDA_CONCURRENCY_CHECK']);

    // ── Async Optimizer DLQ Processor ────────────────────────────────────────
    const asyncOptimizerDlqProcessor = new NodeLambdaFunction(this, 'AsyncOptimizerDlqProcessorFunction', {
      entry: lambdaEntryPath(__dirname, 'workflow/handlers/asyncOptimizerDlqProcessor'),
      functionName: 'DeepRacerIndy-AsyncOptimizerDlqFn',
      logGroup: optimizerLogGroup,
      namespace,
      timeout: Duration.minutes(1),
      environment: {
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyModelOptimizer',
      },
    });

    dynamoDBTable.grantReadWriteData(asyncOptimizerDlqProcessor);
    asyncOptimizerDlq.grantConsumeMessages(asyncOptimizerDlqProcessor);

    asyncOptimizerDlqProcessor.addEventSource(
      new SqsEventSource(asyncOptimizerDlq, {
        batchSize: 10,
        reportBatchItemFailures: true,
      }),
    );

    // ── GuardDuty Malware Protection ────────────────────────────────────────
    if (enableGuardDuty) {
      const guardDutyRole = new Role(this, 'GuardDutyMalwareScanRole', {
        assumedBy: new ServicePrincipal('malware-protection-plan.guardduty.amazonaws.com'),
        inlinePolicies: {
          GuardDutyMalwareProtection: new PolicyDocument({
            statements: [
              new PolicyStatement({
                actions: ['events:PutRule', 'events:DeleteRule', 'events:PutTargets', 'events:RemoveTargets'],
                resources: [
                  `arn:aws:events:${Stack.of(this).region}:${Stack.of(this).account}:rule/DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*`,
                ],
                conditions: {
                  StringLike: { 'events:ManagedBy': 'malware-protection-plan.guardduty.amazonaws.com' },
                },
              }),
              new PolicyStatement({
                actions: ['events:DescribeRule', 'events:ListTargetsByRule'],
                resources: [
                  `arn:aws:events:${Stack.of(this).region}:${Stack.of(this).account}:rule/DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*`,
                ],
              }),
              new PolicyStatement({
                actions: [
                  's3:PutObjectTagging',
                  's3:GetObjectTagging',
                  's3:PutObjectVersionTagging',
                  's3:GetObjectVersionTagging',
                ],
                resources: [uploadBucket.arnForObjects('uploads/physical-models/*')],
              }),
              new PolicyStatement({
                actions: ['s3:PutBucketNotification', 's3:GetBucketNotification'],
                resources: [uploadBucket.bucketArn],
              }),
              new PolicyStatement({
                actions: ['s3:PutObject'],
                resources: [uploadBucket.arnForObjects('malware-protection-resource-validation-object')],
              }),
              new PolicyStatement({
                actions: ['s3:ListBucket'],
                resources: [uploadBucket.bucketArn],
              }),
              new PolicyStatement({
                actions: ['s3:GetObject', 's3:GetObjectVersion'],
                resources: [uploadBucket.arnForObjects('uploads/physical-models/*')],
              }),
            ],
          }),
        },
      });

      new CfnMalwareProtectionPlan(this, 'PhysicalModelMalwareScan', {
        protectedResource: {
          s3Bucket: {
            bucketName: uploadBucket.bucketName,
            objectPrefixes: ['uploads/physical-models/'],
          },
        },
        role: guardDutyRole.roleArn,
        actions: {
          tagging: { status: 'ENABLED' },
        },
      });
    }

    // ── Push-to-Car Workflow ────────────────────────────────────────────────
    const pushWorkflow = new PushWorkflow(this, 'PushWorkflow', { namespace, dynamoDBTable, encryptionKey });

    // ── API Handler Lambdas ──────────────────────────────────────────────────
    const epicProps: EpicFunctionProps = {
      namespace,
      stackKey: 'modelManagement',
      dynamoDBTable,
      userPool,
      encryptionKey,
      extraEnv: {
        MODEL_DATA_BUCKET_NAME: modelStorageBucket.bucketName,
        UPLOAD_BUCKET_NAME: uploadBucket.bucketName,
        MODEL_OPTIMIZER_FUNCTION_NAME: modelOptimizerFunction.functionName,
      },
    };

    // createEpicFunctions wires DynamoDB and Cognito ListUsers on every function.
    const { functions, logGroup } = createEpicFunctions(this, __dirname, ENTRY_POINTS, epicProps);

    // Grant model storage bucket read to PackageModel (reads model metadata for validation)
    modelStorageBucket.grantRead(functions.PackageModel);

    // PackageModel needs to invoke the Model Optimizer
    modelOptimizerFunction.grantInvoke(functions.PackageModel);

    // DeployModel needs SSM DescribeInstanceInformation, S3 read, and SF StartExecution
    modelStorageBucket.grantRead(functions.DeployModel);
    functions.DeployModel.addEnvironment('PUSH_STATE_MACHINE_ARN', pushWorkflow.stateMachine.stateMachineArn);
    functions.DeployModel.addToRolePolicy(
      new PolicyStatement({
        actions: ['states:StartExecution'],
        resources: [pushWorkflow.stateMachine.stateMachineArn],
      }),
    );
    functions.DeployModel.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:DescribeInstanceInformation'],
        resources: ['*'],
      }),
    );

    // Upload bucket read for ImportPhysicalModel (HeadObject validation)
    uploadBucket.grantRead(functions.ImportPhysicalModel);

    // Admin-gated handlers need AdminListGroupsForUser (isUserAdminOrFacilitator check)
    const adminGatedFunctions = [
      functions.PackageModel,
      functions.DeployModel,
      functions.GetDeployment,
      functions.ListAdminModels,
      functions.ListDeployments,
      functions.ListDeploymentsByBatch,
      functions.ListDeploymentsByEvent,
    ];
    const adminCognitoPolicy = new PolicyStatement({
      actions: ['cognito-idp:AdminListGroupsForUser'],
      resources: [userPool.userPoolArn],
    });
    for (const fn of adminGatedFunctions) {
      fn.addToRolePolicy(adminCognitoPolicy);
    }

    // ImportPhysicalModel sends messages to the import job queue (cross-stack from ApiStack)
    functions.ImportPhysicalModel.addEnvironment('IMPORT_MODEL_JOB_QUEUE_URL', importModelJobQueueUrl);
    functions.ImportPhysicalModel.addToRolePolicy(
      new PolicyStatement({
        actions: ['sqs:SendMessage'],
        resources: [importModelJobQueueArn],
      }),
    );

    this.logGroups = [logGroup, optimizerLogGroup, ...pushWorkflow.logGroups];

    this.handlerArns = Object.fromEntries(
      Object.entries(functions).map(([operation, fn]) => [operation, fn.functionArn]),
    ) as Record<ModelManagementOperation, string>;

    // ── Alarms ───────────────────────────────────────────────────────────────
    const errorAlarms = Object.entries(functions).map(
      ([operation, fn]) =>
        new Alarm(this, `${operation}ErrorsAlarm`, {
          metric: fn.metricErrors({ period: Duration.minutes(5) }),
          threshold: 1,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          treatMissingData: TreatMissingData.NOT_BREACHING,
          alarmDescription: `Model Management ${operation} handler reported errors`,
        }),
    );

    const dlqDepthAlarm = new Alarm(this, 'OptimizerDlqDepthAlarm', {
      metric: asyncOptimizerDlq.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Model Optimizer DLQ has 5+ unprocessed messages (optimization failures accumulating)',
    });

    const dlqProcessorErrorsAlarm = new Alarm(this, 'OptimizerDlqProcessorErrorsAlarm', {
      metric: asyncOptimizerDlqProcessor.metricErrors({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Async optimizer DLQ processor Lambda reported errors',
    });

    this.alarms = [
      new CompositeAlarmWrapper(this, 'ModelManagementLambdaErrorsAlarm', {
        prefix: namespace,
        alarmRule: AlarmRule.anyOf(...errorAlarms, dlqDepthAlarm, dlqProcessorErrorsAlarm, ...pushWorkflow.alarms),
        alarmDescription: 'Model Management: handler errors, DLQ depth elevated, or push-to-car SF failure',
      }),
    ];
  }
}
