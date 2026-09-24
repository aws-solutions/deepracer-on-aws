// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, Duration } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import {
  Chain,
  Choice,
  Condition,
  DefinitionBody,
  StateMachine,
  TaskInput,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

import { lambdaEntryPath } from '#constructs/common/epicConstructHelpers.js';
import { DefaultLogRemovalPolicy, DefaultLogRetentionDays } from '#constructs/common/logGroupsHelper.js';
import { NodeLambdaFunction } from '#constructs/common/nodeLambdaFunction.js';

const PUSH_POLL_INTERVAL_SECONDS = 3;

export interface PushWorkflowProps {
  readonly namespace: string;
  readonly dynamoDBTable: TableV2;
  readonly encryptionKey: IKey;
}

/**
 * Push-to-car Step Function workflow. Orchestrates deploying a model to a
 * physical DeepRacer car via SSM SendCommand/PollCommand with status tracking.
 */
export class PushWorkflow extends Construct {
  public readonly stateMachine: StateMachine;
  public readonly alarms: readonly Alarm[];
  public readonly logGroups: readonly LogGroup[];

  constructor(scope: Construct, id: string, props: PushWorkflowProps) {
    super(scope, id);

    const { namespace, dynamoDBTable, encryptionKey } = props;

    // ── Push SF Lambdas ────────────────────────────────────────────────────
    const pushWorkflowLogGroup = new LogGroup(this, 'PushWorkflowLogGroup', {
      retention: DefaultLogRetentionDays,
      removalPolicy: DefaultLogRemovalPolicy,
      encryptionKey,
    });

    const pushUpdateStatusFn = new NodeLambdaFunction(this, 'PushUpdateDeploymentStatusFunction', {
      entry: lambdaEntryPath(__dirname, 'workflow/handlers/pushUpdateDeploymentStatus'),
      functionName: 'DeepRacerIndy-PushUpdateStatusFn',
      logGroup: pushWorkflowLogGroup,
      namespace,
      environment: {
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyPushWorkflow',
      },
    });
    dynamoDBTable.grantReadWriteData(pushUpdateStatusFn);

    const pushSendCommandFn = new NodeLambdaFunction(this, 'PushSendCommandFunction', {
      entry: lambdaEntryPath(__dirname, 'workflow/handlers/pushSendCommand'),
      functionName: 'DeepRacerIndy-PushSendCommandFn',
      logGroup: pushWorkflowLogGroup,
      namespace,
      environment: {
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyPushWorkflow',
      },
    });
    dynamoDBTable.grantReadWriteData(pushSendCommandFn);
    // SendCommand authorizes against both the document and the target instance(s). The tag
    // condition applies only to the managed-instance resource (not the document), so they are
    // split into separate statements.
    const ssmRunShellScriptDoc = `arn:${Aws.PARTITION}:ssm:${Aws.REGION}::document/AWS-RunShellScript`;
    const ssmManagedInstance = `arn:${Aws.PARTITION}:ssm:${Aws.REGION}:${Aws.ACCOUNT_ID}:managed-instance/*`;
    const deepracerManagedTagCondition = {
      StringEquals: { 'ssm:resourceTag/deepracer:managed': 'true' },
    };
    pushSendCommandFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:SendCommand'],
        resources: [ssmRunShellScriptDoc],
      }),
    );
    pushSendCommandFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:SendCommand'],
        resources: [ssmManagedInstance],
        conditions: deepracerManagedTagCondition,
      }),
    );

    const pushPollCommandFn = new NodeLambdaFunction(this, 'PushPollCommandFunction', {
      entry: lambdaEntryPath(__dirname, 'workflow/handlers/pushPollCommand'),
      functionName: 'DeepRacerIndy-PushPollCommandFn',
      logGroup: pushWorkflowLogGroup,
      namespace,
      environment: {
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyPushWorkflow',
      },
    });
    dynamoDBTable.grantReadWriteData(pushPollCommandFn);
    pushPollCommandFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetCommandInvocation'],
        resources: ['*'], // GetCommandInvocation does not support resource-level scoping
      }),
    );

    // ── State Machine Definition ───────────────────────────────────────────
    const updateInProgress = new LambdaInvoke(this, 'UpdateInProgress', {
      lambdaFunction: pushUpdateStatusFn,
      payload: TaskInput.fromObject({
        'context.$': '$',
        status: 'IN_PROGRESS',
        expectedStatus: 'PENDING',
      }),
      outputPath: '$.Payload',
    });

    const sendCommand = new LambdaInvoke(this, 'SendCommand', {
      lambdaFunction: pushSendCommandFn,
      outputPath: '$.Payload',
    });

    const waitForCommand = new Wait(this, 'WaitForCommand', {
      time: WaitTime.duration(Duration.seconds(PUSH_POLL_INTERVAL_SECONDS)),
    });

    const pollCommand = new LambdaInvoke(this, 'PollCommand', {
      lambdaFunction: pushPollCommandFn,
      outputPath: '$.Payload',
    });

    // No addCatch on terminal states: ConditionalCheckFailedException here means
    // a concurrent write already reached a terminal state. DDB is consistent,
    // SM shows FAILED cosmetically, alarm fires. Adding catches risks loops.
    const setCompleted = new LambdaInvoke(this, 'SetCompleted', {
      lambdaFunction: pushUpdateStatusFn,
      payload: TaskInput.fromObject({
        'context.$': '$',
        status: 'COMPLETED',
        expectedStatus: 'IN_PROGRESS',
      }),
      outputPath: '$.Payload',
    });

    const setFailed = new LambdaInvoke(this, 'SetFailed', {
      lambdaFunction: pushUpdateStatusFn,
      payload: TaskInput.fromObject({
        'context.$': '$',
        status: 'FAILED',
        expectedStatus: 'IN_PROGRESS',
      }),
      outputPath: '$.Payload',
    });

    // Dedicated catch target for updateInProgress failure — record is still PENDING,
    // so expectedStatus must match PENDING (not IN_PROGRESS like setFailed uses).
    const setFailedFromPending = new LambdaInvoke(this, 'SetFailedFromPending', {
      lambdaFunction: pushUpdateStatusFn,
      payload: TaskInput.fromObject({
        'context.$': '$',
        status: 'FAILED',
        expectedStatus: 'PENDING',
      }),
      outputPath: '$.Payload',
    });

    const pollChoice = new Choice(this, 'PollChoice')
      .when(Condition.stringEquals('$.commandStatus', 'Success'), setCompleted)
      .when(
        Condition.or(
          Condition.stringEquals('$.commandStatus', 'Failed'),
          Condition.stringEquals('$.commandStatus', 'Cancelled'),
          Condition.stringEquals('$.commandStatus', 'TimedOut'),
        ),
        setFailed,
      )
      .when(Condition.numberGreaterThanEquals('$.pollCount', 100), setFailed)
      .otherwise(waitForCommand);

    // Catch Lambda errors — route to the correct reconciliation state based on
    // what status the record is in when the error occurs.
    updateInProgress.addCatch(setFailedFromPending, { errors: ['States.ALL'], resultPath: '$.error' });
    sendCommand.addRetry({ maxAttempts: 2, backoffRate: 2, interval: Duration.seconds(1) });
    sendCommand.addCatch(setFailed, { errors: ['States.ALL'], resultPath: '$.error' });
    pollCommand.addRetry({ maxAttempts: 2, backoffRate: 2, interval: Duration.seconds(1) });
    pollCommand.addCatch(setFailed, { errors: ['States.ALL'], resultPath: '$.error' });

    const pushDefinition = Chain.start(updateInProgress)
      .next(sendCommand)
      .next(waitForCommand)
      .next(pollCommand)
      .next(pollChoice);

    this.stateMachine = new StateMachine(this, 'PushStateMachine', {
      definitionBody: DefinitionBody.fromChainable(pushDefinition),
      stateMachineName: `${namespace}-DeepRacerIndyPushWorkflow`,
      timeout: Duration.minutes(10),
      tracingEnabled: true,
    });

    // ── Alarms ─────────────────────────────────────────────────────────────
    const pushSfFailedAlarm = new Alarm(this, 'PushSfFailedAlarm', {
      metric: this.stateMachine.metricFailed({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Push-to-car Step Function execution failed',
    });

    const pushSfTimedOutAlarm = new Alarm(this, 'PushSfTimedOutAlarm', {
      metric: this.stateMachine.metricTimedOut({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Push-to-car Step Function execution timed out',
    });

    this.alarms = [pushSfFailedAlarm, pushSfTimedOutAlarm];
    this.logGroups = [pushWorkflowLogGroup];
  }
}
