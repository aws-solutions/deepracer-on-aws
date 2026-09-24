// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Alarm, AlarmRule, ComparisonOperator, CompositeAlarm, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import { OperationsOwnedBy } from '#constants/operationOwnership.js';
import { CompositeAlarmWrapper } from '#constructs/common/compositeAlarmWrapper.js';
import { createEpicFunctions, EpicFunctionProps, lambdaEntryPath } from '#constructs/common/epicConstructHelpers.js';
import { DefaultLogRemovalPolicy } from '#constructs/common/logGroupsHelper.js';
import { NodeLambdaFunction } from '#constructs/common/nodeLambdaFunction.js';
import { grantAppConfigAccess } from '#constructs/common/permissionsHelper.js';
import { GlobalSettings } from '#constructs/storage/appConfig.js';

/** Operations this construct owns, derived from OPERATION_OWNER. */
type EventManagementOperation = OperationsOwnedBy<'eventManagement'>;

/**
 * Lambda entry point paths relative to libs/lambda/src.
 *
 * Typed against `Record<EventManagementOperation, string>` rather than a partial:
 * if an operation is assigned to `'eventManagement'` in OPERATION_OWNER without a
 * handler being added here, that is a compile error rather than a runtime 500.
 */
const PREFIX = 'api/handlers/';
const ENTRY_POINTS = {
  CreateRun: 'createRun',
  GetRun: 'getRun',
  ListRuns: 'listRuns',
  TransitionRunStatus: 'transitionRunStatus',
  CreateLap: 'createLap',
  UpdateLap: 'updateLap',
  SetLapValidity: 'setLapValidity',
  GetEventStatistics: 'getEventStatistics',
  CreateEvent: 'createEvent',
  GetEvent: 'getEvent',
  ListEvents: 'listEvents',
  EditEvent: 'editEvent',
  DeleteEvent: 'deleteEvent',
  TransitionEventStatus: 'transitionEventStatus',
  AddTrackToEvent: 'addTrackToEvent',
  RemoveTrackFromEvent: 'removeTrackFromEvent',
  ListEventTracks: 'listEventTracks',
  GetCombinedLeaderboard: 'getCombinedLeaderboard',
} as const satisfies Record<EventManagementOperation, string>;

export const formatEntryPoints = (
  entryPointsDictionary: Record<EventManagementOperation, string>,
  prefix: string,
): Record<EventManagementOperation, string> => {
  const entryPoints = { ...entryPointsDictionary };
  let key: EventManagementOperation;
  for (key in entryPoints) {
    entryPoints[key] = `${prefix}${entryPoints[key]}`;
  }
  return entryPoints;
};

export interface EventManagementProps {
  readonly namespace: string;
  readonly dynamoDBTable: TableV2;
  readonly userPool: IUserPool;
  readonly globalSettings: GlobalSettings;
  readonly encryptionKey: IKey;
}

/**
 * CDK construct for Epic 3 Event Management Lambda functions.
 *
 * Owns: the event operation handlers, their IAM execution roles, log groups,
 * DynamoDB permissions, and error alarms.
 *
 * Does NOT own: DynamoDB table, Cognito user pool, AppConfig, API Gateway, or the
 * `Lambda::Permission` resources for API Gateway invoke — those belong to whichever
 * stack owns the RestApi.
 */
export class EventManagement extends Construct {
  /** Smithy operation name → Lambda function ARN. Surfaced by the parent stack. */
  public readonly handlerArns: Readonly<Record<EventManagementOperation, string>>;

  /** AddTrackToEvent's function, surfaced so the root stack can grant it S3 write access for the public leaderboard placeholder — see addTrackToEvent.ts. */
  public readonly addTrackToEventFunction: NodeLambdaFunction;

  /** Queue receiving asynchronous event cascade-delete requests. */
  public readonly eventDeleteQueue: Queue;

  /** DLQ for event cascade-delete requests requiring manual re-drive. */
  public readonly eventDeleteDlq: Queue;

  /** Single composite alarm covering error rates across all API and worker handlers. */
  public readonly alarms: readonly (Alarm | CompositeAlarm)[];

  /** Shared API log group, for LogInsights wiring by root. */
  public readonly logGroups: readonly LogGroup[];

  constructor(scope: Construct, id: string, props: EventManagementProps) {
    super(scope, id);

    const { namespace, dynamoDBTable, userPool, globalSettings, encryptionKey } = props;

    this.eventDeleteDlq = new Queue(this, 'EventDeleteDLQ', {
      queueName: `${namespace}-EventDeleteDLQ`,
      encryption: QueueEncryption.KMS_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      retentionPeriod: Duration.days(14),
      visibilityTimeout: Duration.minutes(16),
    });

    this.eventDeleteQueue = new Queue(this, 'EventDeleteQueue', {
      queueName: `${namespace}-EventDeleteQueue`,
      encryption: QueueEncryption.KMS_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      retentionPeriod: Duration.days(14),
      visibilityTimeout: Duration.minutes(16),
      deadLetterQueue: {
        queue: this.eventDeleteDlq,
        maxReceiveCount: 3,
      },
    });

    const epicProps: EpicFunctionProps = {
      namespace,
      stackKey: 'eventManagement',
      dynamoDBTable,
      userPool,
      encryptionKey,
      // Use 90-day retention instead of the global 10-year default.
      logRetention: RetentionDays.THREE_MONTHS,
      extraEnv: {
        AWS_APPCONFIG_APPLICATION_ID: globalSettings.app.attrApplicationId,
        AWS_APPCONFIG_ENVIRONMENT_ID: globalSettings.environment.attrEnvironmentId,
        AWS_APPCONFIG_CONFIGURATION_PROFILE_ID: globalSettings.configurationProfile.attrConfigurationProfileId,
        AWS_APPCONFIG_DEPLOYMENT_STRATEGY: globalSettings.deploymentStrategy.attrId,
      },
    };

    // createEpicFunctions wires DynamoDB and Cognito profile/group lookup on every function.
    // Epic-specific extras are added below.
    const { functions, logGroup } = createEpicFunctions(
      this,
      __dirname,
      formatEntryPoints(ENTRY_POINTS, PREFIX),
      epicProps,
    );

    functions.DeleteEvent.addEnvironment('EVENT_DELETE_QUEUE_URL', this.eventDeleteQueue.queueUrl);
    this.eventDeleteQueue.grantSendMessages(functions.DeleteEvent);

    const eventDeleteWorkerLogGroup = new LogGroup(this, 'EventDeleteWorkerLogGroup', {
      retention: RetentionDays.TEN_YEARS,
      removalPolicy: DefaultLogRemovalPolicy,
      encryptionKey,
    });
    const eventDeleteWorker = new NodeLambdaFunction(this, 'EventDeleteWorkerFunction', {
      entry: lambdaEntryPath(__dirname, 'event-management/handlers/eventDeleteWorker'),
      functionName: 'DeepRacerEventManagement-DeleteWorkerFn',
      logGroup: eventDeleteWorkerLogGroup,
      namespace,
      timeout: Duration.minutes(15),
      memorySize: 1024,
      reservedConcurrentExecutions: 2,
      environment: {
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyEventManagement',
      },
    });

    dynamoDBTable.grantReadWriteData(eventDeleteWorker);
    this.eventDeleteQueue.grantConsumeMessages(eventDeleteWorker);
    eventDeleteWorker.addEventSource(new SqsEventSource(this.eventDeleteQueue, { batchSize: 1 }));

    // AppConfig read access — only the handlers that read global settings
    grantAppConfigAccess(this, functions.CreateEvent, globalSettings);
    grantAppConfigAccess(this, functions.EditEvent, globalSettings);

    this.logGroups = [logGroup, eventDeleteWorkerLogGroup];

    this.handlerArns = Object.fromEntries(
      Object.entries(functions).map(([operation, fn]) => [operation, fn.functionArn]),
    ) as Record<EventManagementOperation, string>;

    this.addTrackToEventFunction = functions.AddTrackToEvent;

    // ── Alarms ───────────────────────────────────────────────────────────────
    // One Errors alarm per function, rolled up into a single composite alarm so the
    // dashboard gets one entry per epic rather than one per operation. Only the
    // composite is exposed; the children exist to give it something to OR over.
    const eventDeleteWorkerErrorsAlarm = new Alarm(this, 'EventDeleteWorkerErrorsAlarm', {
      metric: eventDeleteWorker.metricErrors({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Event deletion worker reported an error',
    });

    const eventDeleteDlqAlarm = new Alarm(this, 'EventDeleteDLQAlarm', {
      metric: this.eventDeleteDlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Event deletion DLQ contains messages requiring investigation',
    });

    const errorAlarms = [
      ...Object.entries(functions).map(
        ([operation, fn]) =>
          new Alarm(this, `${operation}ErrorsAlarm`, {
            metric: fn.metricErrors({ period: Duration.minutes(5) }),
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmDescription: `Event Management ${operation} handler reported errors`,
          }),
      ),
      eventDeleteWorkerErrorsAlarm,
    ];

    this.alarms = [
      new CompositeAlarmWrapper(this, 'EventManagementLambdaErrorsAlarm', {
        prefix: namespace,
        alarmRule: AlarmRule.anyOf(...errorAlarms),
        alarmDescription: 'One or more Event Management Lambda handlers are reporting errors',
      }),
      eventDeleteDlqAlarm,
    ];
  }
}
