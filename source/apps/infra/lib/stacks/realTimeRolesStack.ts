// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Alarm, CompositeAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { ILogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { OperationsOwnedBy } from '#constants/operationOwnership.js';
import { RealTimeRoles } from '#constructs/real-time-roles/realTimeRoles.js';

import { EpicStack } from './epicStack.js';
import { PlatformProps } from './platformProps.js';

// ── Props ──────────────────────────────────────────────────────────────────────

/**
 * Exactly what this stack needs from the platform, and nothing else.
 *
 * Note the absence of anything API Gateway related. Epic stacks receive nothing
 * from the gateway: the stack that owns the RestApi also owns every
 * `Lambda::Permission` targeting it, which is what keeps the dependency graph
 * acyclic.
 */
export type RealTimeRolesStackProps = NestedStackProps &
  Pick<PlatformProps, 'namespace' | 'dynamoDBTable' | 'userPool' | 'encryptionKey'>;

// ── Stack ──────────────────────────────────────────────────────────────────────

/**
 * RealTimeRolesStack — nested stack for race management API handlers.
 *
 * Owns all Lambda functions, IAM execution roles, log groups, permissions, and
 * alarms for the Real-Time Roles epic (race management API handlers).
 *
 * Resources this stack does NOT own (consumed via props):
 * - DynamoDB table  → props.dynamoDBTable
 * - Cognito pool    → props.userPool
 * - API Gateway and the invoke permissions for these handlers → gateway-owning stack
 */
export class RealTimeRolesStack extends NestedStack implements EpicStack<'realTimeRoles'> {
  public readonly handlerArns: Readonly<Record<OperationsOwnedBy<'realTimeRoles'>, string>>;
  public readonly alarms: readonly (Alarm | CompositeAlarm)[];
  public readonly logGroups: readonly ILogGroup[];

  constructor(scope: Construct, id: string, props: RealTimeRolesStackProps) {
    super(scope, id, props);

    const { namespace, dynamoDBTable, userPool, encryptionKey } = props;

    const realTimeRoles = new RealTimeRoles(this, 'RealTimeRoles', {
      namespace,
      dynamoDBTable,
      userPool,
      encryptionKey,
    });

    this.handlerArns = realTimeRoles.handlerArns;
    this.alarms = realTimeRoles.alarms;
    this.logGroups = realTimeRoles.logGroups;
  }
}
