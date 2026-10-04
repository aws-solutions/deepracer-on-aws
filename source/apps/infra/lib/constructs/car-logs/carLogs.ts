// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, Duration } from 'aws-cdk-lib';
import { Alarm, AlarmRule, ComparisonOperator, CompositeAlarm, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { IRepository } from 'aws-cdk-lib/aws-ecr';
import { EventField, Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import {
  Chain,
  Choice,
  Condition,
  DefinitionBody,
  Fail,
  JsonPath,
  Pass,
  StateMachine,
  Succeed,
  TaskInput,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { BatchSubmitJob, LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

import { OperationsOwnedBy } from '#constants/operationOwnership.js';
import { CompositeAlarmWrapper } from '#constructs/common/compositeAlarmWrapper.js';
import { createEpicFunctions, EpicFunctionProps, lambdaEntryPath } from '#constructs/common/epicConstructHelpers.js';
import { DefaultLogRemovalPolicy, DefaultLogRetentionDays } from '#constructs/common/logGroupsHelper.js';
import { NodeLambdaFunction, functionNamePrefix } from '#constructs/common/nodeLambdaFunction.js';

import { CarLogsBatch } from './carLogsBatch.js';

type CarLogOperation = OperationsOwnedBy<'carLogs'>;

/** Lambda entry point paths relative to libs/lambda/src. */
const ENTRY_POINTS = {
  StartCarLogFetch: 'api/handlers/startCarLogFetch',
  ListCarLogFetches: 'api/handlers/listCarLogFetches',
  GetCarLogFetch: 'api/handlers/getCarLogFetch',
  ListCarLogAssets: 'api/handlers/listCarLogAssets',
  GetCarLogAssetUrls: 'api/handlers/getCarLogAssetUrls',
  DeleteCarLogAsset: 'api/handlers/deleteCarLogAsset',
  CreateCarLogUpload: 'api/handlers/createCarLogUpload',
} as const satisfies Record<CarLogOperation, string>;

const POLL_INTERVAL = Duration.seconds(15);
// The car's upload command times out after 30 minutes
const MAX_POLLS = 150;
const WORKFLOW_TIMEOUT = Duration.hours(3);
const UPLOAD_TIMEOUT_CAUSE = JSON.stringify({ errorMessage: 'The car did not finish uploading its logs in time.' });

export interface CarLogsProps {
  readonly namespace: string;
  readonly dynamoDBTable: TableV2;
  readonly userPool: IUserPool;
  readonly encryptionKey: IKey;
  readonly deviceLogsBucket: IBucket;
  readonly modelStorageBucket: IBucket;
  readonly videoProcessorRepository: IRepository;
  readonly videoProcessorImageTag: string;
}

/**
 * Car log collection: API handlers, the Step Functions workflow that fetches the logs from a car
 * (or takes a manual upload), the AWS Batch job that turns the rosbags into videos, and the
 * EventBridge rule that starts the workflow for manual uploads.
 */
export class CarLogs extends Construct {
  public readonly handlerArns: Readonly<Record<CarLogOperation, string>>;
  public readonly alarms: readonly (Alarm | CompositeAlarm)[];
  public readonly logGroups: readonly LogGroup[];
  public readonly stateMachine: StateMachine;

  constructor(scope: Construct, id: string, props: CarLogsProps) {
    super(scope, id);

    const {
      namespace,
      dynamoDBTable,
      userPool,
      encryptionKey,
      deviceLogsBucket,
      modelStorageBucket,
      videoProcessorRepository,
      videoProcessorImageTag,
    } = props;
    const logsBucketArn = deviceLogsBucket.bucketArn;

    const batch = new CarLogsBatch(this, 'Batch', {
      encryptionKey,
      deviceLogsBucket,
      modelStorageBucket,
      videoProcessorRepository,
      videoProcessorImageTag,
    });

    // ── Workflow Lambdas ─────────────────────────────────────────────────────
    const workflowLogGroup = new LogGroup(this, 'WorkflowLogGroup', {
      retention: DefaultLogRetentionDays,
      removalPolicy: DefaultLogRemovalPolicy,
      encryptionKey,
    });
    const workflowFunction = (
      fnId: string,
      entry: string,
      options: { timeout?: Duration; memorySize?: number } = {},
    ): NodeLambdaFunction => {
      const fn = new NodeLambdaFunction(this, `${fnId}Function`, {
        entry: lambdaEntryPath(__dirname, `car-logs/handlers/${entry}`),
        functionName: `${functionNamePrefix}-CarLog${fnId}Fn`,
        logGroup: workflowLogGroup,
        namespace,
        environment: {
          POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyCarLogs',
          DEVICE_LOGS_BUCKET_NAME: deviceLogsBucket.bucketName,
          MODEL_DATA_BUCKET_NAME: modelStorageBucket.bucketName,
        },
        ...options,
      });
      dynamoDBTable.grantReadWriteData(fn);
      return fn;
    };

    const initFn = workflowFunction('JobInit', 'jobInit');
    const sendCommandFn = workflowFunction('JobSendCommand', 'jobSendCommand');
    const pollCommandFn = workflowFunction('JobPollCommand', 'jobPollCommand');
    const processUploadFn = workflowFunction('JobProcessUpload', 'jobProcessUpload', {
      timeout: Duration.minutes(15),
      memorySize: 3008,
    });
    const updateStatusFn = workflowFunction('JobUpdateStatus', 'jobUpdateStatus');
    const registerResultsFn = workflowFunction('JobRegisterResults', 'jobRegisterResults', {
      timeout: Duration.minutes(2),
    });
    const failFn = workflowFunction('JobFail', 'jobFail');
    const workflowFunctions = [
      initFn,
      sendCommandFn,
      pollCommandFn,
      processUploadFn,
      updateStatusFn,
      registerResultsFn,
      failFn,
    ];

    sendCommandFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:SendCommand'],
        resources: [`arn:${Aws.PARTITION}:ssm:${Aws.REGION}::document/AWS-RunShellScript`],
      }),
    );
    sendCommandFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:SendCommand'],
        resources: [`arn:${Aws.PARTITION}:ssm:${Aws.REGION}:${Aws.ACCOUNT_ID}:managed-instance/*`],
        conditions: { StringEquals: { 'ssm:resourceTag/deepracer:managed': 'true' } },
      }),
    );
    // Only used to sign the URL the car uploads its archive to
    sendCommandFn.addToRolePolicy(
      new PolicyStatement({ actions: ['s3:PutObject'], resources: [`${logsBucketArn}/staging/car/*`] }),
    );
    pollCommandFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetCommandInvocation'],
        resources: ['*'], // GetCommandInvocation does not support resource-level scoping
      }),
    );
    processUploadFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:AbortMultipartUpload', 's3:DeleteObject'],
        resources: [`${logsBucketArn}/*`],
      }),
    );
    processUploadFn.addToRolePolicy(new PolicyStatement({ actions: ['s3:ListBucket'], resources: [logsBucketArn] }));
    modelStorageBucket.grantRead(processUploadFn);
    registerResultsFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${logsBucketArn}/job-configs/*`, `${logsBucketArn}/results/*`],
      }),
    );

    // ── State machine ────────────────────────────────────────────────────────
    const invoke = (stateId: string, lambdaFunction: NodeLambdaFunction) =>
      new LambdaInvoke(this, stateId, { lambdaFunction, outputPath: '$.Payload' });

    const init = invoke('Init', initFn);
    const sendCommand = invoke('SendCommand', sendCommandFn);
    const waitForUpload = new Wait(this, 'WaitForUpload', { time: WaitTime.duration(POLL_INTERVAL) });
    const pollCommand = invoke('PollCommand', pollCommandFn);
    const processUpload = invoke('ProcessUpload', processUploadFn);
    const queueForProcessing = new LambdaInvoke(this, 'QueueForProcessing', {
      lambdaFunction: updateStatusFn,
      payload: TaskInput.fromObject({ 'jobId.$': '$.jobId', status: 'QUEUED_FOR_PROCESSING' }),
      resultPath: JsonPath.DISCARD,
    });
    const createVideos = new BatchSubmitJob(this, 'CreateVideos', {
      jobName: JsonPath.format('car-log-{}', JsonPath.stringAt('$.jobId')),
      jobQueueArn: batch.jobQueue.jobQueueArn,
      jobDefinitionArn: batch.jobDefinition.jobDefinitionArn,
      containerOverrides: {
        environment: {
          JOB_ID: JsonPath.stringAt('$.jobId'),
          BUCKET: deviceLogsBucket.bucketName,
        },
      },
      resultPath: JsonPath.DISCARD,
    });
    const registerResults = new LambdaInvoke(this, 'RegisterResults', {
      lambdaFunction: registerResultsFn,
      payload: TaskInput.fromObject({ 'jobId.$': '$.jobId' }),
      outputPath: '$.Payload',
    });

    // The job is already marked as failed in the table for these end states
    const notStarted = new Succeed(this, 'NotStarted', {
      comment: 'The event does not belong to a job that can be started',
    });
    const uploadFailed = new Succeed(this, 'UploadFailed', { comment: 'The car could not upload its logs' });
    const jobFailed = new Succeed(this, 'JobFailed', { comment: 'The job failed with a message for the user' });
    const unexpectedFailure = new Fail(this, 'UnexpectedFailure', { error: 'CarLogWorkflowFailed' });
    const done = new Succeed(this, 'Done');

    const markFailed = new LambdaInvoke(this, 'MarkFailed', {
      lambdaFunction: failFn,
      payload: TaskInput.fromObject({ 'jobId.$': '$.jobId', 'error.$': '$.error' }),
      resultPath: JsonPath.DISCARD,
    }).next(
      new Choice(this, 'FailureKind')
        .when(Condition.stringEquals('$.error.Error', 'CarLogJobError'), jobFailed)
        .otherwise(unexpectedFailure),
    );
    const uploadTimedOut = new Pass(this, 'UploadTimedOut', {
      parameters: {
        'jobId.$': '$.jobId',
        error: { Error: 'CarLogJobError', Cause: UPLOAD_TIMEOUT_CAUSE },
      },
    }).next(markFailed);

    const catchAll = { errors: ['States.ALL'], resultPath: '$.error' };
    // Rejected events (an unexpected upload, a fetch that was already started) are not failures
    init.addCatch(notStarted, { errors: ['CarLogJobError'], resultPath: JsonPath.DISCARD });
    for (const task of [sendCommand, pollCommand, processUpload, queueForProcessing, createVideos, registerResults]) {
      task.addCatch(markFailed, catchAll);
    }

    const pollChoice = new Choice(this, 'UploadFinished')
      .when(Condition.stringEquals('$.outcome', 'SUCCESS'), processUpload)
      .when(Condition.stringEquals('$.outcome', 'FAILED'), uploadFailed)
      .when(Condition.numberGreaterThanEquals('$.pollCount', MAX_POLLS), uploadTimedOut)
      .otherwise(waitForUpload);

    const sourceChoice = new Choice(this, 'Source')
      .when(Condition.stringEquals('$.source', 'CAR'), Chain.start(sendCommand).next(waitForUpload))
      .otherwise(processUpload);
    waitForUpload.next(pollCommand).next(pollChoice);
    processUpload.next(queueForProcessing).next(createVideos).next(registerResults).next(done);

    this.stateMachine = new StateMachine(this, 'StateMachine', {
      definitionBody: DefinitionBody.fromChainable(Chain.start(init).next(sourceChoice)),
      stateMachineName: `${namespace}-DeepRacerCarLogWorkflow`,
      timeout: WORKFLOW_TIMEOUT,
      tracingEnabled: true,
    });

    // Manual uploads start the workflow as soon as the archive lands in S3
    new Rule(this, 'ManualUploadRule', {
      ruleName: `${namespace}-CarLogs-ManualUpload`,
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: { name: [deviceLogsBucket.bucketName] },
          object: { key: [{ prefix: 'staging/manual/' }] },
        },
      },
      targets: [
        new SfnStateMachine(this.stateMachine, {
          input: RuleTargetInput.fromObject({ uploadKey: EventField.fromPath('$.detail.object.key') }),
        }),
      ],
    });

    // ── API handlers ─────────────────────────────────────────────────────────
    const epicProps: EpicFunctionProps = {
      namespace,
      stackKey: 'carLogs',
      dynamoDBTable,
      userPool,
      encryptionKey,
      extraEnv: {
        DEVICE_LOGS_BUCKET_NAME: deviceLogsBucket.bucketName,
        CAR_LOG_STATE_MACHINE_ARN: this.stateMachine.stateMachineArn,
      },
    };
    const { functions, logGroup } = createEpicFunctions(this, __dirname, ENTRY_POINTS, epicProps);

    this.stateMachine.grantStartExecution(functions.StartCarLogFetch);
    functions.CreateCarLogUpload.addToRolePolicy(
      new PolicyStatement({ actions: ['s3:PutObject'], resources: [`${logsBucketArn}/staging/manual/*`] }),
    );
    functions.GetCarLogAssetUrls.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${logsBucketArn}/carlogs/*`, `${logsBucketArn}/downloads/*`],
      }),
    );
    functions.GetCarLogAssetUrls.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:PutObject', 's3:AbortMultipartUpload'],
        resources: [`${logsBucketArn}/downloads/*`],
      }),
    );
    functions.DeleteCarLogAsset.addToRolePolicy(
      new PolicyStatement({ actions: ['s3:DeleteObject'], resources: [`${logsBucketArn}/carlogs/*`] }),
    );
    for (const fn of [functions.GetCarLogAssetUrls, functions.DeleteCarLogAsset]) {
      fn.addToRolePolicy(new PolicyStatement({ actions: ['s3:ListBucket'], resources: [logsBucketArn] }));
    }

    this.handlerArns = Object.fromEntries(
      Object.entries(functions).map(([operation, fn]) => [operation, (fn as NodeLambdaFunction).functionArn]),
    ) as Record<CarLogOperation, string>;
    this.logGroups = [logGroup, workflowLogGroup, batch.logGroup];

    // ── Alarms ───────────────────────────────────────────────────────────────
    const errorAlarm = (alarmId: string, fn: NodeLambdaFunction, description: string) =>
      new Alarm(this, `${alarmId}ErrorsAlarm`, {
        metric: fn.metricErrors({ period: Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
        alarmDescription: description,
      });
    const lambdaAlarms = [
      ...Object.entries(functions).map(([operation, fn]) =>
        errorAlarm(operation, fn as NodeLambdaFunction, `Car Logs ${operation} handler reported errors`),
      ),
      ...workflowFunctions.map((fn, index) =>
        errorAlarm(`Workflow${index}`, fn, 'A Car Logs workflow Lambda reported errors'),
      ),
    ];
    const lambdaErrorsAlarm = new CompositeAlarmWrapper(this, 'CarLogsLambdaErrorsAlarm', {
      prefix: namespace,
      alarmRule: AlarmRule.anyOf(...lambdaAlarms),
      alarmDescription: 'One or more Car Logs Lambda functions are reporting errors',
    });

    const workflowFailedAlarm = new Alarm(this, 'WorkflowFailedAlarm', {
      metric: this.stateMachine.metricFailed({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Car Logs workflow execution failed',
    });
    const workflowTimedOutAlarm = new Alarm(this, 'WorkflowTimedOutAlarm', {
      metric: this.stateMachine.metricTimedOut({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Car Logs workflow execution timed out',
    });

    this.alarms = [lambdaErrorsAlarm, workflowFailedAlarm, workflowTimedOutAlarm];
  }
}
