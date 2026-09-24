// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, MathExpression, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import {
  Chain,
  DefinitionBody,
  JsonPath,
  Map as MapState,
  StateMachine,
  StateMachineType,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

import { lambdaEntryPath } from '#constructs/common/epicConstructHelpers.js';
import { KmsHelper } from '#constructs/common/kmsHelper.js';
import { DefaultLogRemovalPolicy, DefaultLogRetentionDays } from '#constructs/common/logGroupsHelper.js';
import { NodeLambdaFunction } from '#constructs/common/nodeLambdaFunction.js';

/** EMF namespace for the metrics the iteration Lambda emits (BulkInviteUsersCreated, etc.). */
export const BULK_INVITE_METRICS_NAMESPACE = 'DeepRacerIndyBulkInvite';

export interface BulkInviteWorkflowProps {
  readonly namespace: string;
  readonly dynamoDBTable: TableV2;
  readonly userPool: IUserPool;
}

/**
 * Step Functions workflow for bulk racer onboarding.
 */
export class BulkInviteWorkflow extends Construct {
  public readonly stateMachine: StateMachine;
  public readonly alarms: readonly Alarm[];

  constructor(scope: Construct, id: string, props: BulkInviteWorkflowProps) {
    super(scope, id);

    const { namespace, dynamoDBTable, userPool } = props;

    const logGroup = new LogGroup(this, 'BulkInviteWorkflowLogGroup', {
      retention: DefaultLogRetentionDays,
      removalPolicy: DefaultLogRemovalPolicy,
      encryptionKey: KmsHelper.get(this, namespace),
    });

    const iterationFn = new NodeLambdaFunction(this, 'BulkInviteIterationFunction', {
      entry: lambdaEntryPath(__dirname, 'bulk-invite/bulkInviteIteration'),
      functionName: 'DeepRacerIndy-BulkInviteIterationFn',
      logGroup,
      namespace,
      timeout: Duration.minutes(15),
      environment: {
        POWERTOOLS_METRICS_NAMESPACE: BULK_INVITE_METRICS_NAMESPACE,
        USER_POOL_ID: userPool.userPoolId,
      },
    });
    dynamoDBTable.grantReadWriteData(iterationFn);
    iterationFn.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'cognito-idp:ListUsers',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminDeleteUser',
        ],
        resources: [userPool.userPoolArn],
      }),
    );

    // ── Terminal-marking (finalize) Lambda ─────────────────────────────────
    const finalizeFn = new NodeLambdaFunction(this, 'BulkInviteFinalizeFunction', {
      entry: lambdaEntryPath(__dirname, 'bulk-invite/bulkInviteFinalize'),
      functionName: 'DeepRacerIndy-BulkInviteFinalizeFn',
      logGroup,
      namespace,
      environment: {
        POWERTOOLS_METRICS_NAMESPACE: BULK_INVITE_METRICS_NAMESPACE,
      },
    });
    dynamoDBTable.grantReadWriteData(finalizeFn);

    // ── State machine definition ───────────────────────────────────────────
    const processEntry = new LambdaInvoke(this, 'ProcessEntry', {
      lambdaFunction: iterationFn,
      outputPath: '$.Payload',
    });
    processEntry.addRetry({ maxAttempts: 3, backoffRate: 2, interval: Duration.seconds(1) });

    const processEntries = new MapState(this, 'ProcessEntries', {
      maxConcurrency: 1,
      itemsPath: '$.entries',
      itemSelector: {
        jobId: JsonPath.stringAt('$.jobId'),
        adminProfileId: JsonPath.stringAt('$.adminProfileId'),
        entry: JsonPath.objectAt('$$.Map.Item.Value'),
      },
      resultPath: '$.results',
    });
    processEntries.itemProcessor(processEntry);

    const finalizeCompleted = new LambdaInvoke(this, 'FinalizeCompleted', {
      lambdaFunction: finalizeFn,
      payload: TaskInput.fromObject({
        jobId: JsonPath.stringAt('$.jobId'),
        adminProfileId: JsonPath.stringAt('$.adminProfileId'),
        outcome: 'COMPLETED',
      }),
    });

    const finalizeFailed = new LambdaInvoke(this, 'FinalizeFailed', {
      lambdaFunction: finalizeFn,
      payload: TaskInput.fromObject({
        jobId: JsonPath.stringAt('$.jobId'),
        adminProfileId: JsonPath.stringAt('$.adminProfileId'),
        outcome: 'FAILED',
        errorMessage: JsonPath.stringAt('$.error.Cause'),
      }),
    });

    finalizeCompleted.addRetry({ maxAttempts: 3, backoffRate: 2, interval: Duration.seconds(1) });
    finalizeFailed.addRetry({ maxAttempts: 3, backoffRate: 2, interval: Duration.seconds(1) });

    processEntries.addCatch(finalizeFailed, { errors: ['States.ALL'], resultPath: '$.error' });

    const definition = Chain.start(processEntries).next(finalizeCompleted);

    this.stateMachine = new StateMachine(this, 'BulkInviteStateMachine', {
      definitionBody: DefinitionBody.fromChainable(definition),
      stateMachineName: `${namespace}-DeepRacerIndyBulkInviteWorkflow`,
      stateMachineType: StateMachineType.STANDARD,
      timeout: Duration.minutes(20),
      tracingEnabled: true,
    });

    const executionFailedAlarm = new Alarm(this, 'BulkInviteExecutionFailedAlarm', {
      metric: this.stateMachine.metricFailed({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription:
        'Bulk invite Step Function execution failed (uncaught state-machine error; secondary to BulkInviteJobFailedAlarm)',
    });

    const executionTimedOutAlarm = new Alarm(this, 'BulkInviteExecutionTimedOutAlarm', {
      metric: this.stateMachine.metricTimedOut({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription:
        'Bulk invite Step Function execution timed out (hit the 20-minute execution timeout); the job reaches a terminal state via the 30-minute staleness backstop (§5.5.1)',
    });

    const jobFailedAlarm = new Alarm(this, 'BulkInviteJobFailedAlarm', {
      metric: new Metric({
        namespace: BULK_INVITE_METRICS_NAMESPACE,
        metricName: 'BulkInviteJobFailed',
        statistic: 'Sum',
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'A bulk invite job was marked FAILED (state-machine-level error)',
    });

    const orphanedUserAlarm = new Alarm(this, 'BulkInviteOrphanedUserAlarm', {
      metric: new Metric({
        namespace: BULK_INVITE_METRICS_NAMESPACE,
        metricName: 'BulkInviteOrphanedUser',
        statistic: 'Sum',
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Bulk invite left an orphaned Cognito user (rollback delete failed) — manual cleanup required',
    });

    const failedEntries = new Metric({
      namespace: BULK_INVITE_METRICS_NAMESPACE,
      metricName: 'BulkInviteFailedEntries',
      statistic: 'Sum',
      period: Duration.minutes(15),
    });
    const totalEntries = new Metric({
      namespace: BULK_INVITE_METRICS_NAMESPACE,
      metricName: 'BulkInviteSize',
      statistic: 'Sum',
      period: Duration.minutes(15),
    });
    const highFailureRateAlarm = new Alarm(this, 'BulkInviteHighFailureRateAlarm', {
      metric: new MathExpression({
        expression: '100 * (FILL(failed, 0) / FILL(total, 1))',
        usingMetrics: { failed: failedEntries, total: totalEntries },
        period: Duration.minutes(15),
        label: 'BulkInviteFailureRatePercent',
      }),
      threshold: 50,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'More than 50% of submitted bulk invite entries failed over the last 15 minutes',
    });

    this.alarms = [
      executionFailedAlarm,
      executionTimedOutAlarm,
      jobFailedAlarm,
      orphanedUserAlarm,
      highFailureRateAlarm,
    ];
  }
}
