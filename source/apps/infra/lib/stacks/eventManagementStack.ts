// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Alarm, CompositeAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { ILogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { OperationsOwnedBy } from '#constants/operationOwnership.js';
import { NodeLambdaFunction } from '#constructs/common/nodeLambdaFunction.js';
import { EventManagement } from '#constructs/event-management/eventManagement.js';

import { EpicStack } from './epicStack.js';
import { PlatformProps } from './platformProps.js';

// ── Props ──────────────────────────────────────────────────────────────────────

/**
 * Exactly what this stack needs from the platform, and nothing else.
 *
 * Note the absence of anything API Gateway related. Epic stacks receive nothing
 * from the gateway: the stack that owns the RestApi also owns every
 * `Lambda::Permission` targeting it, which keeps the dependency graph acyclic.
 */
export type EventManagementStackProps = NestedStackProps &
  Pick<PlatformProps, 'namespace' | 'dynamoDBTable' | 'userPool' | 'globalSettings' | 'encryptionKey'>;

// ── Stack ──────────────────────────────────────────────────────────────────────

/**
 * EventManagementStack — Epic 3 nested stack, and the reference implementation of
 * the epic-stack framework.
 *
 * Owns all Lambda functions, IAM execution roles, log groups, permissions, and
 * alarms for the Event Management epic.
 *
 * Resources this stack does NOT own (consumed via props):
 * - DynamoDB table  → props.dynamoDBTable
 * - Cognito pool    → props.userPool
 * - AppConfig       → props.globalSettings
 * - API Gateway and the invoke permissions for these handlers → gateway-owning stack
 */
export class EventManagementStack extends NestedStack implements EpicStack<'eventManagement'> {
  public readonly handlerArns: Readonly<Record<OperationsOwnedBy<'eventManagement'>, string>>;
  public readonly alarms: readonly (Alarm | CompositeAlarm)[];
  public readonly logGroups: readonly ILogGroup[];
  /** See EventManagement.addTrackToEventFunction. */
  public readonly addTrackToEventFunction: NodeLambdaFunction;

  constructor(scope: Construct, id: string, props: EventManagementStackProps) {
    super(scope, id, props);

    const { namespace, dynamoDBTable, userPool, globalSettings, encryptionKey } = props;

    const eventManagement = new EventManagement(this, 'EventManagement', {
      namespace,
      dynamoDBTable,
      userPool,
      globalSettings,
      encryptionKey,
    });

    this.handlerArns = eventManagement.handlerArns;
    this.alarms = eventManagement.alarms;
    this.logGroups = eventManagement.logGroups;
    this.addTrackToEventFunction = eventManagement.addTrackToEventFunction;
  }
}
