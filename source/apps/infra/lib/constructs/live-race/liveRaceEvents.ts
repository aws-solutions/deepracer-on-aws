// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { CfnOutput, CustomResource, Duration, Stack } from 'aws-cdk-lib';
import { Alarm, CfnAlarm, ComparisonOperator, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnPolicy } from 'aws-cdk-lib/aws-iot';
import { EventSourceMapping, FilterCriteria, FilterRule, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId, Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

import { iotTopicPrefix } from '../../constants/iotTopics.js';
import { addCfnGuardSuppressionForAutoCreatedLambdas } from '../common/cfnGuardHelper.js';
import { LogGroupCategory } from '../common/logGroupsHelper.js';
import { NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

export interface LiveRaceEventsProps {
  namespace: string;
  dynamoDBTable: TableV2;
  /** Function name of the AttachPolicy Lambda, used to create an error alarm. */
  attachPolicyFunctionName: string;
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

  constructor(scope: Construct, id: string, props: LiveRaceEventsProps) {
    super(scope, id);

    const { namespace, dynamoDBTable, attachPolicyFunctionName } = props;
    const { region, account, partition } = Stack.of(this);

    // --- IoT Core ---
    const policyName = `${namespace}-SpectatorIoTPolicy`;
    const topicPrefix = iotTopicPrefix(namespace);
    this.spectatorPolicyName = policyName;

    const cfnPolicy = new CfnPolicy(this, 'SpectatorIoTPolicy', {
      policyName,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'iot:Connect',
            Resource: `arn:${partition}:iot:${region}:${account}:client/*`,
          },
          {
            Effect: 'Allow',
            Action: 'iot:Subscribe',
            Resource: `arn:${partition}:iot:${region}:${account}:topicfilter/${topicPrefix}/*`,
          },
          {
            Effect: 'Allow',
            Action: 'iot:Receive',
            Resource: `arn:${partition}:iot:${region}:${account}:topic/${topicPrefix}/*`,
          },
          {
            Effect: 'Deny',
            Action: 'iot:Publish',
            Resource: `arn:${partition}:iot:${region}:${account}:topic/${topicPrefix}/*`,
          },
        ],
      },
    });
    this.spectatorPolicyArn = cfnPolicy.attrArn;
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
        actions: ['iot:ListTargetsForPolicy'],
        resources: [this.spectatorPolicyArn],
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
        resources: [this.spectatorPolicyArn],
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
      },
    });

    this.liveBroadcastHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Publish'],
        resources: [`arn:${partition}:iot:${region}:${account}:topic/${topicPrefix}/*`],
      }),
    );

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
      threshold: 1000,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 3,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Alert when IoT Core publish P99 latency exceeds 1000ms',
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
      threshold: 10,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 3,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Alert when AttachPolicy Lambda errors exceed 10 per minute',
    });

    dynamoDBTable.grantReadData(this.liveBroadcastHandler);
    dynamoDBTable.grantStreamRead(this.liveBroadcastHandler);

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
      ],
    });
  }
}
