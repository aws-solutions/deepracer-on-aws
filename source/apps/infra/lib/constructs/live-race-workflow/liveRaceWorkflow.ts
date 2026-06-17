// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { TrainingJobStatus } from '@aws-sdk/client-sagemaker';
import { Duration } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction as LambdaTarget } from 'aws-cdk-lib/aws-events-targets';
import { EventSourceMapping, FilterCriteria, FilterRule, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import {
  Chain,
  Choice,
  Condition,
  DefinitionBody,
  Fail,
  JsonPath,
  LogLevel,
  Pass,
  Result,
  StateMachine,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

import { KmsHelper } from '../common/kmsHelper.js';
import { DefaultLogRemovalPolicy, DefaultLogRetentionDays, LogGroupCategory } from '../common/logGroupsHelper.js';
import { NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

export interface LiveRaceWorkflowProps {
  dynamoDBTable: TableV2;
  modelStorageBucket: Bucket;
  simAppRepositoryUri: string;
  namespace: string;
  /** Existing JobInitializer/Monitor/Finalizer from Workflow construct */
  jobInitializerFunction: NodeLambdaFunction;
  jobMonitorFunction: NodeLambdaFunction;
  jobFinalizerFunction: NodeLambdaFunction;
}

/**
 * Live Race Step Functions workflow.
 *
 * Evaluates queued models sequentially: GetNextPending → SetInProgress →
 * JobInitializer → JobMonitor → JobFinalizer → SetCompleted → CheckAutolaunch.
 * Loops until queue is empty, autolaunch is disabled, or safety counter (60) is hit.
 * Reuses shared JobInitializer/Monitor/Finalizer from the community racing Workflow construct.
 *
 * Supporting infrastructure:
 * - StreamHandler: DynamoDB stream trigger, auto-starts SF on queue changes
 * - SafetyNet: EventBridge rule, restarts SF after failure if PENDING items remain
 * - DLQ: Captures failed stream events for investigation
 */
const MAX_MODELS_PER_EXECUTION = 60;

export class LiveRaceWorkflow extends Construct {
  public readonly stateMachine: StateMachine;
  public readonly workflowErrorsAlarm: Alarm;
  public readonly streamDlqAlarm: Alarm;

  constructor(scope: Construct, id: string, props: LiveRaceWorkflowProps) {
    super(scope, id);

    const { dynamoDBTable, namespace, jobInitializerFunction, jobMonitorFunction, jobFinalizerFunction } = props;

    // --- Live race orchestration Lambdas ---

    const getNextPendingFn = new NodeLambdaFunction(this, 'GetNextPendingFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/getNextPending.ts'),
      functionName: 'DeepRacerIndyLiveRace-GetNextPendingFn',
      logGroupCategory: LogGroupCategory.LIVE_RACING,
      namespace,
    });
    dynamoDBTable.grantReadData(getNextPendingFn);

    const checkAutolaunchFn = new NodeLambdaFunction(this, 'CheckAutolaunchFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/checkAutolaunch.ts'),
      functionName: 'DeepRacerIndyLiveRace-CheckAutolaunchFn',
      logGroupCategory: LogGroupCategory.LIVE_RACING,
      namespace,
    });
    dynamoDBTable.grantReadData(checkAutolaunchFn);

    const updateQueueStatusFn = new NodeLambdaFunction(this, 'UpdateQueueStatusFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/updateQueueStatus.ts'),
      functionName: 'DeepRacerIndyLiveRace-UpdateQueueStatusFn',
      logGroupCategory: LogGroupCategory.LIVE_RACING,
      namespace,
    });
    dynamoDBTable.grantReadWriteData(updateQueueStatusFn);

    const clearExecutionLockFn = new NodeLambdaFunction(this, 'ClearExecutionLockFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/clearExecutionLock.ts'),
      functionName: 'DeepRacerIndyLiveRace-ClearExecutionLockFn',
      logGroupCategory: LogGroupCategory.LIVE_RACING,
      namespace,
    });
    dynamoDBTable.grantReadWriteData(clearExecutionLockFn);

    // --- Step Function definition ---

    const failState = new Fail(this, 'LiveRace Failed');

    const clearLockInvocation = new LambdaInvoke(this, 'ClearExecutionLock', {
      lambdaFunction: clearExecutionLockFn,
      outputPath: '$.Payload',
    });

    const clearLockThenFail = new LambdaInvoke(this, 'ClearLockOnError', {
      lambdaFunction: clearExecutionLockFn,
      outputPath: '$.Payload',
    }).next(failState);

    const getNextPendingInvocation = new LambdaInvoke(this, 'GetNextPending', {
      lambdaFunction: getNextPendingFn,
      outputPath: '$.Payload',
    }).addCatch(clearLockThenFail, { resultPath: '$.errorDetails' });

    // Payload merges the full SF state (via '$') with static status fields.
    // Lambda receives: { context: LiveRaceContext, status: string, expectedStatus: string }
    const updateStatusToInProgress = new LambdaInvoke(this, 'SetInProgress', {
      lambdaFunction: updateQueueStatusFn,
      payload: {
        type: 1, // OBJECT
        value: {
          'context.$': '$',
          status: 'IN_PROGRESS',
          expectedStatus: 'PENDING',
        },
      },
      outputPath: '$.Payload',
    });

    const updateStatusToCompleted = new LambdaInvoke(this, 'SetCompleted', {
      lambdaFunction: updateQueueStatusFn,
      payload: {
        type: 1,
        value: {
          'context.$': '$',
          status: 'COMPLETED',
          expectedStatus: 'IN_PROGRESS',
        },
      },
      outputPath: '$.Payload',
    });

    const updateStatusToFailed = new LambdaInvoke(this, 'SetFailed', {
      lambdaFunction: updateQueueStatusFn,
      payload: {
        type: 1,
        value: {
          'context.$': '$',
          status: 'FAILED',
          expectedStatus: 'IN_PROGRESS',
        },
      },
      outputPath: '$.Payload',
    });

    const jobFinalizerInvocation = new LambdaInvoke(this, 'LiveRace JobFinalizer', {
      lambdaFunction: jobFinalizerFunction,
      outputPath: '$.Payload',
    }).addCatch(updateStatusToFailed, { resultPath: '$.errorDetails' });

    const jobInitInvocation = new LambdaInvoke(this, 'LiveRace JobInitializer', {
      lambdaFunction: jobInitializerFunction,
      outputPath: '$.Payload',
    }).addCatch(jobFinalizerInvocation, { resultPath: '$.errorDetails' });

    const jobMonitorInvocation = new LambdaInvoke(this, 'LiveRace JobMonitor', {
      lambdaFunction: jobMonitorFunction,
      outputPath: '$.Payload',
    }).addCatch(jobFinalizerInvocation, { resultPath: '$.errorDetails' });

    const checkAutolaunchInvocation = new LambdaInvoke(this, 'CheckAutolaunch', {
      lambdaFunction: checkAutolaunchFn,
      outputPath: '$.Payload',
    }).addCatch(clearLockThenFail, { resultPath: '$.errorDetails' });

    const incrementCounter = new Pass(this, 'IncrementCounter', {
      parameters: {
        'leaderboardId.$': '$.leaderboardId',
        modelsProcessed: JsonPath.mathAdd(JsonPath.numberAt('$.modelsProcessed'), 1),
        'currentSubmissionId.$': '$.currentSubmissionId',
        'profileId.$': '$.profileId',
        'queueEmpty.$': '$.queueEmpty',
        'continueLoop.$': '$.continueLoop',
      },
    });

    // Handle ConditionalCheckFailedException in UpdateStatus — skip item, continue
    updateStatusToInProgress.addCatch(checkAutolaunchInvocation, {
      errors: ['States.TaskFailed'],
      resultPath: '$.errorDetails',
    });

    updateStatusToCompleted.addCatch(checkAutolaunchInvocation, {
      errors: ['States.TaskFailed'],
      resultPath: '$.errorDetails',
    });

    // After FAILED status update, continue to CheckAutolaunch
    updateStatusToFailed.next(checkAutolaunchInvocation);

    // After COMPLETED status update, continue to CheckAutolaunch
    updateStatusToCompleted.next(checkAutolaunchInvocation);

    // CheckAutolaunch → autolaunch decision
    checkAutolaunchInvocation.next(
      new Choice(this, 'Continue loop?')
        .when(Condition.booleanEquals('$.continueLoop', false), clearLockInvocation)
        .otherwise(incrementCounter),
    );

    // Counter check → loop or exit
    incrementCounter.next(
      new Choice(this, 'Counter limit reached?')
        .when(Condition.numberGreaterThan('$.modelsProcessed', MAX_MODELS_PER_EXECUTION), clearLockInvocation)
        .otherwise(getNextPendingInvocation),
    );

    // Job monitor polling loop
    const waitForJob = new Wait(this, 'Wait for evaluation', {
      time: WaitTime.duration(Duration.seconds(30)),
    });

    jobMonitorInvocation.next(
      new Choice(this, 'Evaluation done?')
        .when(
          Condition.or(
            Condition.stringEquals('$.trainingJob.status', TrainingJobStatus.IN_PROGRESS),
            Condition.stringEquals('$.trainingJob.status', TrainingJobStatus.STOPPING),
          ),
          waitForJob.next(jobMonitorInvocation),
        )
        .otherwise(
          jobFinalizerInvocation.next(
            new Choice(this, 'Job failed?')
              .when(Condition.stringEquals('$.jobStatus', 'FAILED'), updateStatusToFailed)
              .otherwise(updateStatusToCompleted),
          ),
        ),
    );

    // Safety counter — prevents runaway execution and keeps under SF's 25,000 history event limit.
    // SafetyNet restarts a fresh execution if PENDING items remain.
    const initCounter = new Pass(this, 'InitializeCounter', {
      resultPath: '$.modelsProcessed',
      result: Result.fromNumber(0),
    });

    // Main chain: Init → GetNextPending → queue empty check → evaluation
    const definition = Chain.start(initCounter)
      .next(getNextPendingInvocation)
      .next(
        new Choice(this, 'Queue empty?')
          .when(Condition.booleanEquals('$.queueEmpty', true), clearLockInvocation)
          .otherwise(updateStatusToInProgress.next(jobInitInvocation).next(jobMonitorInvocation)),
      );

    const encryptionKey = KmsHelper.get(this, namespace);
    this.stateMachine = new StateMachine(this, 'LiveRaceStateMachine', {
      definitionBody: DefinitionBody.fromChainable(definition),
      stateMachineName: `${namespace}-LiveRaceWorkflow`,
      logs: {
        destination: new LogGroup(this, 'LiveRaceExecutionLogs', {
          logGroupName: `/aws/vendedlogs/states/${namespace}-LiveRaceWorkflow`,
          removalPolicy: DefaultLogRemovalPolicy,
          retention: DefaultLogRetentionDays,
          encryptionKey,
        }),
        includeExecutionData: true,
        level: LogLevel.ALL,
      },
      tracingEnabled: true,
    });

    encryptionKey.grantEncryptDecrypt(this.stateMachine);

    // --- StreamHandler ---

    // Dead letter queue for stream records that fail all retries
    const streamDlq = new Queue(this, 'StreamHandlerDLQ', {
      queueName: `${namespace}-LiveRaceStreamDLQ`,
      enforceSSL: true,
      encryption: QueueEncryption.KMS_MANAGED,
    });

    const streamHandlerFn = new NodeLambdaFunction(this, 'StreamHandlerFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/streamHandler.ts'),
      functionName: 'DeepRacerIndyLiveRace-StreamHandlerFn',
      logGroupCategory: LogGroupCategory.LIVE_RACING,
      namespace,
      environment: {
        LIVE_RACE_STATE_MACHINE_ARN: this.stateMachine.stateMachineArn,
      },
    });

    dynamoDBTable.grantReadWriteData(streamHandlerFn);
    this.stateMachine.grantStartExecution(streamHandlerFn);

    dynamoDBTable.grantStreamRead(streamHandlerFn);

    new EventSourceMapping(this, 'StreamEventSource', {
      target: streamHandlerFn,
      eventSourceArn: dynamoDBTable.tableStreamArn,
      startingPosition: StartingPosition.LATEST,
      maxBatchingWindow: Duration.seconds(1), // Batch concurrent submissions into one invocation
      retryAttempts: 3, // Bounded retries before sending to DLQ
      bisectBatchOnError: true, // Isolate bad records on failure
      maxRecordAge: Duration.minutes(5), // Stale records are no-ops — SafetyNet handles recovery
      onFailure: new SqsDlq(streamDlq),
      filters: [
        FilterCriteria.filter({
          eventName: FilterRule.or('INSERT', 'MODIFY'),
          dynamodb: {
            Keys: {
              pk: { S: [{ suffix: '#livequeueitem' }] },
            },
          },
        }),
      ],
    });

    // --- SafetyNet ---

    const safetyNetFn = new NodeLambdaFunction(this, 'SafetyNetFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/workflow/handlers/safetyNet.ts'),
      functionName: 'DeepRacerIndyLiveRace-SafetyNetFn',
      logGroupCategory: LogGroupCategory.LIVE_RACING,
      namespace,
    });

    dynamoDBTable.grantReadWriteData(safetyNetFn);

    new Rule(this, 'SFTerminalStateRule', {
      eventPattern: {
        source: ['aws.states'],
        detailType: ['Step Functions Execution Status Change'],
        detail: {
          stateMachineArn: [this.stateMachine.stateMachineArn],
          status: ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED_OUT'],
        },
      },
      targets: [new LambdaTarget(safetyNetFn)],
    });

    // --- Alarms ---

    this.workflowErrorsAlarm = new Alarm(this, 'LiveRaceWorkflowErrorsAlarm', {
      metric: this.stateMachine.metricFailed({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'LiveRaceWorkflow Step Function execution failure',
    });

    this.streamDlqAlarm = new Alarm(this, 'StreamDLQAlarm', {
      metric: streamDlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'LiveRace stream DLQ has unprocessed records — PENDING items may be orphaned',
    });
  }
}
