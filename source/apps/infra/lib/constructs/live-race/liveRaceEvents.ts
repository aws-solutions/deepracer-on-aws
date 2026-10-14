// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { CfnOutput, CustomResource, Duration, Stack } from 'aws-cdk-lib';
import { Alarm, CfnAlarm, ComparisonOperator, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnPolicy } from 'aws-cdk-lib/aws-iot';
import { EventSourceMapping, FilterCriteria, FilterRule, IFunction, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId, Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

import {
  iotCarLogTopicPrefix,
  iotCountdownTopicFilter,
  iotDeviceTopicPrefix,
  iotRaceTopicPrefix,
  iotTopicPrefix,
  iotTopicRoot,
} from '../../constants/iotTopics.js';
import { addCfnGuardSuppressionForAutoCreatedLambdas } from '../common/cfnGuardHelper.js';
import { LogGroupCategory } from '../common/logGroupsHelper.js';
import { NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

export interface LiveRaceEventsProps {
  namespace: string;
  dynamoDBTable: TableV2;
  /** Function name of the AttachPolicy Lambda, used to create an error alarm. */
  attachPolicyFunctionName: string;
  /** Device Pruning Lambda (Epic 2) fanned out to on device# TTL-delete stream events (Task 11). */
  devicePrunerFunction: IFunction;
  /** EventBridge bus name for emitting race-submitted events (D5). Optional — stats rebuild is skipped if absent. */
  raceEventBusName?: string;
}

/**
 * Real-time live race event infrastructure.
 * Publishes DDB stream events via IoT Core (MQTT over WSS).
 */
export class LiveRaceEvents extends Construct {
  readonly liveBroadcastHandler: NodeLambdaFunction;
  readonly broadcastDlqAlarm: Alarm;
  readonly iotEndpoint: string;
  readonly spectatorPolicyName: string;
  readonly spectatorPolicyArn: string;
  /** Publish-capable IoT policy attached to admins / race facilitators. */
  readonly facilitatorPolicyName: string;
  readonly facilitatorPolicyArn: string;

  constructor(scope: Construct, id: string, props: LiveRaceEventsProps) {
    super(scope, id);

    const { namespace, dynamoDBTable, attachPolicyFunctionName } = props;
    const { region, account, partition } = Stack.of(this);

    // --- IoT Core ---
    // The race tree is a sibling of the leaderboard tree under a shared root:
    // deepracer/{ns}/leaderboard/* (virtual) and deepracer/{ns}/race/* (physical).
    const policyName = `${namespace}-SpectatorIoTPolicy`;
    const facilitatorPolicyName = `${namespace}-FacilitatorIoTPolicy`;
    const topicRoot = iotTopicRoot(namespace);
    const topicPrefix = iotTopicPrefix(namespace);
    const raceTopicPrefix = iotRaceTopicPrefix(namespace);
    const deviceTopicPrefix = iotDeviceTopicPrefix(namespace);
    const carLogTopicPrefix = iotCarLogTopicPrefix(namespace);
    this.spectatorPolicyName = policyName;
    this.facilitatorPolicyName = facilitatorPolicyName;

    // Connect + subscribe/receive across both topic trees (root scope), shared by both policies.
    const connectStatement = {
      Effect: 'Allow',
      Action: 'iot:Connect',
      Resource: `arn:${partition}:iot:${region}:${account}:client/*`,
    };
    const subscribeStatement = {
      Effect: 'Allow',
      Action: 'iot:Subscribe',
      Resource: `arn:${partition}:iot:${region}:${account}:topicfilter/${topicRoot}/*`,
    };
    const receiveStatement = {
      Effect: 'Allow',
      Action: 'iot:Receive',
      Resource: `arn:${partition}:iot:${region}:${account}:topic/${topicRoot}/*`,
    };

    // Base policy (spectator/commentator/racer): subscribe-only. No explicit Deny on publish —
    // AttachPolicy is additive, so a Deny here could override the facilitator policy's publish Allow.
    const cfnPolicy = new CfnPolicy(this, 'SpectatorIoTPolicy', {
      policyName,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [connectStatement, subscribeStatement, receiveStatement],
      },
    });
    this.spectatorPolicyArn = cfnPolicy.attrArn;

    // Facilitator policy (admin / race facilitator): base access plus publish on the race
    // topic tree for facilitator-driven overlay / lap events (client-side Path B). Publish scope
    // is namespace-wide on the race tree — IoT policy variables cannot scope to event/track.
    const cfnFacilitatorPolicy = new CfnPolicy(this, 'FacilitatorIoTPolicy', {
      policyName: facilitatorPolicyName,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          connectStatement,
          subscribeStatement,
          receiveStatement,
          {
            Effect: 'Allow',
            Action: 'iot:Publish',
            Resource: `arn:${partition}:iot:${region}:${account}:topic/${raceTopicPrefix}/*`,
          },
          // Countdown/pause/resume topic: the browser publishes directly here (bypassing
          // Lambda) during Timekeeping, so the named IoT policy needs its own Publish grant —
          // the IAM role's iotCountdownPublishPolicy alone isn't sufficient (AWS IoT requires both).
          {
            Effect: 'Allow',
            Action: 'iot:Publish',
            Resource: `arn:${partition}:iot:${region}:${account}:topic/${iotCountdownTopicFilter(namespace)}`,
          },
        ],
      },
    });
    this.facilitatorPolicyArn = cfnFacilitatorPolicy.attrArn;
    // Custom resource that detaches all principals and deletes the IoT policy on stack teardown.
    // iot:DeletePolicy fails with DeleteConflictException if principals are still attached,
    // so we paginate ListTargetsForPolicy → DetachPolicy before deleting.
    const deletePolicyEventHandlerFn = new NodeLambdaFunction(this, 'DeleteIoTPolicyFn', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/live-race/deleteIotPolicy.ts'),
      functionName: `${namespace}-LiveRace-DeleteIoTPolicy`,
      handler: 'onEventHandler',
      logGroupCategory: LogGroupCategory.SYSTEM_EVENTS,
      namespace,
    });
    deletePolicyEventHandlerFn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:ListTargetsForPolicy', 'iot:ListPolicyVersions', 'iot:DeletePolicyVersion'],
        resources: [this.spectatorPolicyArn, this.facilitatorPolicyArn],
      }),
    );
    // iot:DetachPolicy evaluates against the target (a Cognito Identity ID, not ARN-able),
    // so it must be scoped to '*'. Blast radius is bounded by the preceding ListTargetsForPolicy.
    deletePolicyEventHandlerFn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:DetachPolicy'],
        resources: ['*'],
      }),
    );
    const deletePolicyIsCompleteFn = new NodeLambdaFunction(this, 'DeleteIoTPolicyIsCompleteFn', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/live-race/deleteIotPolicy.ts'),
      functionName: `${namespace}-LiveRace-DeleteIoTPolicy-IsComplete`,
      handler: 'isCompleteHandler',
      logGroupCategory: LogGroupCategory.SYSTEM_EVENTS,
      namespace,
    });
    deletePolicyIsCompleteFn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:DeletePolicy'],
        resources: [this.spectatorPolicyArn, this.facilitatorPolicyArn],
      }),
    );
    const deleteIoTPolicyProviderName = 'DeleteIoTPolicyProvider';
    const deletePolicyProvider = new Provider(this, deleteIoTPolicyProviderName, {
      onEventHandler: deletePolicyEventHandlerFn,
      isCompleteHandler: deletePolicyIsCompleteFn,
      queryInterval: Duration.seconds(15),
      totalTimeout: Duration.minutes(10),
    });
    new CustomResource(this, 'DeleteIoTPolicyResource', {
      serviceToken: deletePolicyProvider.serviceToken,
      properties: { policyName },
    });
    // Same detach-then-delete teardown for the facilitator policy (reuses the provider).
    new CustomResource(this, 'DeleteFacilitatorIoTPolicyResource', {
      serviceToken: deletePolicyProvider.serviceToken,
      properties: { policyName: facilitatorPolicyName },
    });
    addCfnGuardSuppressionForAutoCreatedLambdas(this, deleteIoTPolicyProviderName);

    // AwsCustomResource to retrieve the IoT ATS endpoint at deploy time.
    // IoT ATS endpoints are account-scoped and never change, so no onUpdate needed.
    const iotEndpointResource = new AwsCustomResource(this, 'IoTEndpoint', {
      onCreate: {
        service: 'IoT',
        action: 'describeEndpoint',
        parameters: { endpointType: 'iot:Data-ATS' },
        physicalResourceId: PhysicalResourceId.fromResponse('endpointAddress'),
      },
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['iot:DescribeEndpoint'],
          resources: ['*'],
        }),
      ]),
    });

    this.iotEndpoint = iotEndpointResource.getResponseField('endpointAddress');
    // The AwsCustomResource singleton provider Lambda is registered on the stack under the ID
    // "AWS" + PROVIDER_FUNCTION_UUID (hyphens removed). PROVIDER_FUNCTION_UUID is a public
    // static constant on AwsCustomResource, so this derivation is stable across CDK versions.
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.custom_resources.AwsCustomResource.html
    addCfnGuardSuppressionForAutoCreatedLambdas(
      this,
      `AWS${AwsCustomResource.PROVIDER_FUNCTION_UUID.replace(/-/g, '')}`,
    );

    new CfnOutput(this, 'IoTEndpointOutput', {
      value: this.iotEndpoint,
      description: 'IoT Core ATS endpoint for MQTT over WSS',
    });

    const broadcastDlq = new Queue(this, 'BroadcastDLQ', {
      queueName: `${namespace}-LiveRaceBroadcastDLQ`,
      encryption: QueueEncryption.KMS_MANAGED,
      enforceSSL: true,
    });

    this.broadcastDlqAlarm = new Alarm(this, 'BroadcastDLQAlarm', {
      metric: broadcastDlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 0,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    this.liveBroadcastHandler = new NodeLambdaFunction(this, 'LiveBroadcastHandler', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/live-race/liveBroadcastHandler.ts'),
      functionName: `${namespace}-LiveRace-BroadcastHandler`,
      logGroupCategory: LogGroupCategory.LIVE_RACING,
      namespace,
      environment: {
        IOT_ENDPOINT: this.iotEndpoint,
        TOPIC_PREFIX: topicPrefix,
        RACE_TOPIC_PREFIX: iotRaceTopicPrefix(namespace),
        DEVICE_TOPIC_PREFIX: deviceTopicPrefix,
        CAR_LOG_TOPIC_PREFIX: carLogTopicPrefix,
        PRUNER_FUNCTION_NAME: props.devicePrunerFunction.functionName,
        ...(props.raceEventBusName ? { RACE_EVENT_BUS_NAME: props.raceEventBusName } : {}),
      },
    });

    this.liveBroadcastHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Publish'],
        resources: [`arn:${partition}:iot:${region}:${account}:topic/${topicPrefix}/*`],
      }),
    );

    // Device status/command routing (Task 11): publish to the device topic tree and fan out
    // device# TTL-deletes to the Pruning Lambda (async invoke — the handler is not a stream
    // consumer for pruning).
    this.liveBroadcastHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Publish'],
        resources: [`arn:${partition}:iot:${region}:${account}:topic/${deviceTopicPrefix}/*`],
      }),
    );

    // Car-log job and asset changes are pushed to the car-log topic tree.
    this.liveBroadcastHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Publish'],
        resources: [`arn:${partition}:iot:${region}:${account}:topic/${carLogTopicPrefix}/*`],
      }),
    );

    // Physical race topic tree (Task 16.5): the handler publishes run/lap broadcast events on
    // the race tree for physical events, alongside the virtual-leaderboard tree above.
    this.liveBroadcastHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Publish'],
        resources: [`arn:${partition}:iot:${region}:${account}:topic/${raceTopicPrefix}/*`],
      }),
    );
    props.devicePrunerFunction.grantInvoke(this.liveBroadcastHandler);

    const publishFailureMetric = new Metric({
      namespace: 'DeepRacerIndy',
      metricName: 'IoTPublishFailure',
      dimensionsMap: { service: 'LiveBroadcastHandler' },
      period: Duration.minutes(1),
      statistic: 'Sum',
    });

    new Alarm(this, 'IoTPublishFailureAlarm', {
      metric: publishFailureMetric,
      threshold: 0,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 3,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Alert when LiveBroadcastHandler fails to publish to IoT Core',
    });

    const publishLatencyMetric = new Metric({
      namespace: 'DeepRacerIndy',
      metricName: 'IoTPublishLatency',
      dimensionsMap: { service: 'LiveBroadcastHandler' },
      period: Duration.minutes(1),
    });

    const publishLatencyAlarm = new Alarm(this, 'IoTPublishLatencyAlarm', {
      metric: publishLatencyMetric,
      threshold: 2000,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 3,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Alert when IoT Core publish P99 latency exceeds 2000ms',
    });
    // CDK's L2 Alarm/Metric API accepts `statistic` (simple stats like Sum/Average) but does not
    // expose `extendedStatistic` (percentile stats like p99) — the field is silently dropped when
    // CDK synthesises the CfnAlarm. We use the L1 escape hatch to set it directly.
    // Upstream issue: https://github.com/aws/aws-cdk/issues/3845
    const cfnLatencyAlarm = publishLatencyAlarm.node.defaultChild as CfnAlarm;
    cfnLatencyAlarm.addPropertyOverride('ExtendedStatistic', 'p99');
    cfnLatencyAlarm.addPropertyDeletionOverride('Statistic');

    new Alarm(this, 'AttachPolicyLambdaErrorsAlarm', {
      metric: new Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: { FunctionName: attachPolicyFunctionName },
        period: Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 50,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Alert when AttachPolicy Lambda errors exceed 50 per minute',
    });

    // grantReadWriteData (not grantReadData): the combined-leaderboard recompute path
    // (Task 4.3, physical events) performs Ranking create/update/delete calls from within this
    // handler — see recomputeCombinedLeaderboard in combinedLeaderboard.ts (Task 16.5).
    dynamoDBTable.grantReadWriteData(this.liveBroadcastHandler);
    dynamoDBTable.grantStreamRead(this.liveBroadcastHandler);

    // Grant PutEvents to the race event bus so the broadcast handler can emit race-submitted (D5).
    if (props.raceEventBusName) {
      this.liveBroadcastHandler.addToRolePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['events:PutEvents'],
          resources: [`arn:${partition}:events:${region}:${account}:event-bus/${props.raceEventBusName}`],
        }),
      );
    }

    new EventSourceMapping(this, 'BroadcastStreamEventSource', {
      target: this.liveBroadcastHandler,
      eventSourceArn: dynamoDBTable.tableStreamArn,
      startingPosition: StartingPosition.LATEST,
      maxBatchingWindow: Duration.seconds(1),
      retryAttempts: 3,
      bisectBatchOnError: true,
      reportBatchItemFailures: true,
      maxRecordAge: Duration.minutes(5),
      onFailure: new SqsDlq(broadcastDlq),
      filters: [
        FilterCriteria.filter({
          eventName: FilterRule.or('INSERT', 'MODIFY'),
        }),
        // Device TTL-deletes: REMOVE on a device# row. Delivered so the handler can fan the
        // expired instance out to the Pruning Lambda. Other REMOVE events are
        // not delivered, keeping the handler's invocation volume unchanged for non-device rows.
        FilterCriteria.filter({
          eventName: FilterRule.isEqual('REMOVE'),
          dynamodb: { OldImage: { pk: { S: FilterRule.beginsWith('device#') } } },
        }),
        // Car-log assets that were deleted: REMOVE on a carlogasset_ row, so the UI list can drop it.
        FilterCriteria.filter({
          eventName: FilterRule.isEqual('REMOVE'),
          dynamodb: { OldImage: { sk: { S: FilterRule.beginsWith('carlogasset_') } } },
        }),
      ],
    });
  }
}
