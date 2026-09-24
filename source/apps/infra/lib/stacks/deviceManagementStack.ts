// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Alarm, CompositeAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { ILogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { OperationsOwnedBy } from '#constants/operationOwnership.js';
import { DeviceManagement } from '#constructs/device-management/deviceManagement.js';

import { EpicStack } from './epicStack.js';
import { PlatformProps } from './platformProps.js';

// ── Props ──────────────────────────────────────────────────────────────────────

/**
 * Exactly what this stack needs from the platform, and nothing else.
 *
 */
export type DeviceManagementStackProps = NestedStackProps &
  Pick<PlatformProps, 'namespace' | 'dynamoDBTable' | 'userPool' | 'encryptionKey'>;

// ── Stack ──────────────────────────────────────────────────────────────────────

/**
 * DeviceManagementStack — (Device & Fleet Management) nested stack.
 *
 */
export class DeviceManagementStack extends NestedStack implements EpicStack<'deviceManagement'> {
  public readonly handlerArns: Readonly<Record<OperationsOwnedBy<'deviceManagement'>, string>>;
  public readonly alarms: readonly (Alarm | CompositeAlarm)[];
  public readonly logGroups: readonly ILogGroup[];
  /** Pruning Lambda, fanned out to by the BroadcastHandler on device# TTL. */
  public readonly devicePrunerFunction: IFunction;

  constructor(scope: Construct, id: string, props: DeviceManagementStackProps) {
    super(scope, id, props);

    const { namespace, dynamoDBTable, userPool, encryptionKey } = props;

    const deviceManagement = new DeviceManagement(this, 'DeviceManagement', {
      namespace,
      dynamoDBTable,
      userPool,
      encryptionKey,
    });

    this.handlerArns = deviceManagement.handlerArns;
    this.alarms = deviceManagement.alarms;
    this.logGroups = deviceManagement.logGroups;
    this.devicePrunerFunction = deviceManagement.devicePrunerFunction;
  }
}
