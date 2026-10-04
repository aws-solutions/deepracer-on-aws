// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { Aws, Duration } from 'aws-cdk-lib';
import {
  Alarm,
  AlarmRule,
  ComparisonOperator,
  CompositeAlarm,
  Metric,
  TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { CfnRule, Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction as LambdaFunctionTarget } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { OperationsOwnedBy } from '#constants/operationOwnership.js';
import { CompositeAlarmWrapper } from '#constructs/common/compositeAlarmWrapper.js';
import { createEpicFunctions, EpicFunctionProps } from '#constructs/common/epicConstructHelpers.js';
import { DefaultLogRemovalPolicy } from '#constructs/common/logGroupsHelper.js';
import { NodeLambdaFunction, functionNamePrefix } from '#constructs/common/nodeLambdaFunction.js';

import { DeviceManagementInfra } from './deviceManagementInfra.js';

/** Path to libs/lambda/src from this construct file. */
const LAMBDA_SRC = '../../../../../libs/lambda/src';

/** Operations this construct owns, derived from OPERATION_OWNER. */
type DeviceManagementOperation = OperationsOwnedBy<'deviceManagement'>;

/**
 * Lambda entry point paths relative to libs/lambda/src.
 *
 */
const ENTRY_POINTS = {
  ActivateDevice: 'api/handlers/activateDevice',
  ListDevices: 'api/handlers/listDevices',
  DeleteDevice: 'api/handlers/deleteDevice',
  UpdateDevice: 'api/handlers/updateDevice',
  BatchUpdateDevice: 'api/handlers/batchUpdateDevice',
  RestartDevice: 'api/handlers/restartDevice',
  StopDevice: 'api/handlers/stopDevice',
  ChangeDeviceColor: 'api/handlers/changeDeviceColor',
  ClearDeviceModels: 'api/handlers/clearDeviceModels',
  ListFleets: 'api/handlers/listFleets',
  CreateFleet: 'api/handlers/createFleet',
  UpdateFleet: 'api/handlers/updateFleet',
  DeleteFleet: 'api/handlers/deleteFleet',
  AssignEventFleets: 'api/handlers/assignEventFleets',
  ListEventDevices: 'api/handlers/listEventDevices',
} as const satisfies Record<DeviceManagementOperation, string>;

export interface DeviceManagementProps {
  readonly namespace: string;
  readonly dynamoDBTable: TableV2;
  readonly userPool: IUserPool;
  readonly encryptionKey: IKey;
}

/**
 * CDK construct for Device & Fleet Management Lambda functions.
 *
 */
export class DeviceManagement extends Construct {
  /** Smithy operation name → Lambda function ARN. Surfaced by the parent stack. */
  public readonly handlerArns: Readonly<Record<DeviceManagementOperation, string>>;
  /** Single composite alarm covering error rates across all handlers. */
  public readonly alarms: readonly (Alarm | CompositeAlarm)[];
  /** Per-function log groups, for LogInsights wiring by root. */
  public readonly logGroups: readonly LogGroup[];
  /** Pruning Lambda — invoked asynchronously by the BroadcastHandler on device# TTL-deletes. */
  public readonly devicePrunerFunction: NodeLambdaFunction;

  constructor(scope: Construct, id: string, props: DeviceManagementProps) {
    super(scope, id);

    const { namespace, dynamoDBTable, userPool, encryptionKey } = props;

    // Device-management IAM role scaffolds + disabled EventBridge rule
    // reserved for the Task 5 State Change Handler.
    const infra = new DeviceManagementInfra(this, 'Infra', { namespace });

    const epicProps: EpicFunctionProps = {
      namespace,
      stackKey: 'deviceManagement',
      dynamoDBTable,
      userPool,
      encryptionKey,
    };

    const { functions, logGroup } = createEpicFunctions(this, __dirname, ENTRY_POINTS, epicProps);

    // ── ActivateDevice: SSM hybrid activation wiring ─────────────────────────
    functions.ActivateDevice.addEnvironment('HYBRID_ACTIVATION_IAM_ROLE_NAME', infra.ssmHybridActivationRole.roleName);
    functions.ActivateDevice.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:CreateActivation', 'ssm:DeleteActivation', 'ssm:AddTagsToResource'],
        resources: ['*'],
      }),
    );
    infra.ssmHybridActivationRole.grantPassRole(functions.ActivateDevice.grantPrincipal);

    // ── Command handlers: tag-scoped ssm:SendCommand (Finding 6) ─────────────
    const runShellScriptDoc = `arn:${Aws.PARTITION}:ssm:${Aws.REGION}::document/AWS-RunShellScript`;
    const anyManagedInstance = `arn:${Aws.PARTITION}:ssm:${Aws.REGION}:${Aws.ACCOUNT_ID}:managed-instance/*`;
    const grantTagScopedSendCommand = (fn: NodeLambdaFunction) => {
      fn.addToRolePolicy(new PolicyStatement({ actions: ['ssm:SendCommand'], resources: [runShellScriptDoc] }));
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: ['ssm:SendCommand'],
          resources: [anyManagedInstance],
          conditions: { StringEquals: { 'ssm:resourceTag/deepracer:managed': 'true' } },
        }),
      );
    };
    grantTagScopedSendCommand(functions.RestartDevice);
    grantTagScopedSendCommand(functions.StopDevice);
    grantTagScopedSendCommand(functions.ChangeDeviceColor);

    grantTagScopedSendCommand(functions.ClearDeviceModels);
    functions.ClearDeviceModels.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetCommandInvocation'],
        resources: ['*'],
      }),
    );

    functions.DeleteDevice.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:DeregisterManagedInstance'],
        resources: [anyManagedInstance],
        conditions: { StringEquals: { 'ssm:resourceTag/deepracer:managed': 'true' } },
      }),
    );

    for (const fn of [functions.UpdateDevice, functions.BatchUpdateDevice]) {
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: ['ssm:AddTagsToResource', 'ssm:RemoveTagsFromResource'],
          resources: [anyManagedInstance],
          conditions: { StringEquals: { 'ssm:resourceTag/deepracer:managed': 'true' } },
        }),
      );
    }

    // ── Event-driven status Lambdas.
    const pollerLogGroup = new LogGroup(this, 'DeviceStatusPollerLogGroup', {
      retention: RetentionDays.TEN_YEARS,
      removalPolicy: DefaultLogRemovalPolicy,
      encryptionKey,
    });
    const statusPollerFn = new NodeLambdaFunction(this, 'DeviceStatusPollerFunction', {
      entry: path.join(__dirname, LAMBDA_SRC, 'device-management/deviceStatusPoller.ts'),
      functionName: `${functionNamePrefix}-DeviceStatusPollerFn`,
      logGroup: pollerLogGroup,
      namespace,
      timeout: Duration.minutes(5),
    });
    dynamoDBTable.grantReadWriteData(statusPollerFn);
    statusPollerFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:DescribeInstanceInformation', 'ssm:ListTagsForResource', 'ssm:ListInventoryEntries'],
        resources: ['*'],
      }),
    );

    const stateChangeLogGroup = new LogGroup(this, 'DeviceStateChangeLogGroup', {
      retention: RetentionDays.TEN_YEARS,
      removalPolicy: DefaultLogRemovalPolicy,
      encryptionKey,
    });
    const stateChangeFn = new NodeLambdaFunction(this, 'DeviceStateChangeFunction', {
      entry: path.join(__dirname, LAMBDA_SRC, 'device-management/deviceStateChangeHandler.ts'),
      functionName: `${functionNamePrefix}-DeviceStateChangeFn`,
      logGroup: stateChangeLogGroup,
      namespace,
      timeout: Duration.minutes(1),
    });
    dynamoDBTable.grantReadWriteData(stateChangeFn);
    stateChangeFn.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'ssm:DescribeInstanceInformation',
          'ssm:ListTagsForResource',
          'ssm:GetCommandInvocation',
          'ssm:ListInventoryEntries',
        ],
        resources: ['*'],
      }),
    );

    // ── Pruning Lambda.
    const prunerLogGroup = new LogGroup(this, 'DevicePrunerLogGroup', {
      retention: RetentionDays.TEN_YEARS,
      removalPolicy: DefaultLogRemovalPolicy,
      encryptionKey,
    });
    this.devicePrunerFunction = new NodeLambdaFunction(this, 'DevicePrunerFunction', {
      entry: path.join(__dirname, LAMBDA_SRC, 'device-management/devicePruner.ts'),
      functionName: `${functionNamePrefix}-DevicePrunerFn`,
      logGroup: prunerLogGroup,
      namespace,
      timeout: Duration.minutes(1),
    });
    this.devicePrunerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:DeregisterManagedInstance'],
        resources: [anyManagedInstance],
        conditions: { StringEquals: { 'ssm:resourceTag/deepracer:managed': 'true' } },
      }),
    );

    // Scheduled poll every 5 minutes.
    new Rule(this, 'DeviceStatusPollerSchedule', {
      ruleName: `${namespace}-DeviceManagement-DeviceStatusPollerSchedule`,
      schedule: Schedule.rate(Duration.minutes(5)),
      targets: [new LambdaFunctionTarget(statusPollerFn)],
    });

    infra.ssmDeviceStateChangeRule.addTarget(new LambdaFunctionTarget(stateChangeFn));
    (infra.ssmDeviceStateChangeRule.node.defaultChild as CfnRule).state = 'ENABLED';

    this.logGroups = [logGroup, pollerLogGroup, stateChangeLogGroup, prunerLogGroup];

    this.handlerArns = Object.fromEntries(
      Object.entries(functions).map(([operation, fn]) => [operation, fn.functionArn]),
    ) as Record<DeviceManagementOperation, string>;

    // ── Alarms ───────────────────────────────────────────────────────────────
    const errorAlarms = Object.entries(functions).map(
      ([operation, fn]) =>
        new Alarm(this, `${operation}ErrorsAlarm`, {
          metric: fn.metricErrors({ period: Duration.minutes(5) }),
          threshold: 1,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          treatMissingData: TreatMissingData.NOT_BREACHING,
          alarmDescription: `Device Management ${operation} handler reported errors`,
        }),
    );

    const eventDrivenErrorAlarms = [
      { alarmId: 'DeviceStatusPoller', fn: statusPollerFn },
      { alarmId: 'DeviceStateChange', fn: stateChangeFn },
    ].map(
      ({ alarmId, fn }) =>
        new Alarm(this, `${alarmId}ErrorsAlarm`, {
          metric: fn.metricErrors({ period: Duration.minutes(5) }),
          threshold: 1,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          treatMissingData: TreatMissingData.NOT_BREACHING,
          alarmDescription: `Device Management ${alarmId} Lambda reported errors`,
        }),
    );

    const lambdaErrorsAlarm = new CompositeAlarmWrapper(this, 'DeviceManagementLambdaErrorsAlarm', {
      prefix: namespace,
      alarmRule: AlarmRule.anyOf(...errorAlarms, ...eventDrivenErrorAlarms),
      alarmDescription: 'One or more Device Management Lambda handlers are reporting errors',
    });

    // ── Named business/latency alarms.
    const METRICS_NAMESPACE_API = 'DeepRacerIndyApi';
    const METRICS_SERVICE_DIMENSION = { service: 'DeepRacerIndy' };

    // EmergencyStopFailure — Stop Lambda errors > 0 in 5 min (Lambda Errors metric).
    const emergencyStopFailureAlarm = new Alarm(this, 'EmergencyStopFailureAlarm', {
      metric: functions.StopDevice.metricErrors({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Emergency Stop (StopDevice) Lambda reported errors',
    });

    // DevicePruningFailure — Pruning Lambda errors > 0 (Lambda Errors metric).
    const devicePruningFailureAlarm = new Alarm(this, 'DevicePruningFailureAlarm', {
      metric: this.devicePrunerFunction.metricErrors({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Device pruning Lambda reported errors',
    });

    // EmergencyStopDispatchLatency — Stop Lambda P99 dispatch (API receipt → SendCommand) > 1s.
    const emergencyStopDispatchLatencyAlarm = new Alarm(this, 'EmergencyStopDispatchLatencyAlarm', {
      metric: new Metric({
        namespace: METRICS_NAMESPACE_API,
        metricName: 'CommandDispatchLatency',
        dimensionsMap: { ...METRICS_SERVICE_DIMENSION, Operation: 'StopDevice' },
        statistic: 'p99',
        period: Duration.minutes(5),
      }),
      threshold: 1000,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Emergency Stop dispatch latency (API receipt → SendCommand) P99 exceeded 1s',
    });

    // ActivationFailureRate — activation failures > 3 in 15 min (custom metric from
    const activationFailureRateAlarm = new Alarm(this, 'ActivationFailureRateAlarm', {
      metric: new Metric({
        namespace: METRICS_NAMESPACE_API,
        metricName: 'ActivationFailure',
        dimensionsMap: { ...METRICS_SERVICE_DIMENSION, Operation: 'ActivateDevice' },
        statistic: 'Sum',
        period: Duration.minutes(15),
      }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Device activation failures exceeded 3 in 15 minutes',
    });

    // SSMCommandCompletionLatency — on-device command execution latency P99 > 10s (custom metric
    // from the State Change Handler, a directly-created Lambda → `DeepRacerIndy` namespace).
    const ssmCommandCompletionLatencyAlarm = new Alarm(this, 'SSMCommandCompletionLatencyAlarm', {
      metric: new Metric({
        namespace: 'DeepRacerIndy',
        metricName: 'SSMCommandCompletionLatency',
        dimensionsMap: METRICS_SERVICE_DIMENSION,
        statistic: 'p99',
        period: Duration.minutes(5),
      }),
      threshold: 10000,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'SSM command on-device completion latency P99 exceeded 10s',
    });

    // DeviceOfflineRate — > 90% of managed devices offline, sustained 15 min (custom metric from
    // the status poller). A conservative threshold: near-total offline indicates an SSM/
    // connectivity outage rather than normal between-event idle.
    const deviceOfflineRateAlarm = new Alarm(this, 'DeviceOfflineRateAlarm', {
      metric: new Metric({
        namespace: 'DeepRacerIndy',
        metricName: 'DeviceOfflineRate',
        dimensionsMap: METRICS_SERVICE_DIMENSION,
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 90,
      evaluationPeriods: 3,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Over 90% of managed devices reported offline for 15 minutes (likely SSM/connectivity outage)',
    });

    this.alarms = [
      lambdaErrorsAlarm,
      emergencyStopFailureAlarm,
      devicePruningFailureAlarm,
      emergencyStopDispatchLatencyAlarm,
      activationFailureRateAlarm,
      ssmCommandCompletionLatencyAlarm,
      deviceOfflineRateAlarm,
    ];
  }
}
