// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Alarm, CompositeAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { IRepository } from 'aws-cdk-lib/aws-ecr';
import { ILogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { OperationsOwnedBy } from '#constants/operationOwnership.js';
import { CarLogs } from '#constructs/car-logs/carLogs.js';

import { EpicStack } from './epicStack.js';
import { PlatformProps } from './platformProps.js';

export type CarLogsStackProps = NestedStackProps &
  Pick<
    PlatformProps,
    'namespace' | 'dynamoDBTable' | 'userPool' | 'encryptionKey' | 'deviceLogsBucket' | 'modelStorageBucket'
  > & {
    readonly videoProcessorRepository: IRepository;
    readonly videoProcessorImageTag: string;
  };

/**
 * CarLogsStack — collection of car logs and creation of videos from them, as a nested stack.
 */
export class CarLogsStack extends NestedStack implements EpicStack<'carLogs'> {
  public readonly handlerArns: Readonly<Record<OperationsOwnedBy<'carLogs'>, string>>;
  public readonly alarms: readonly (Alarm | CompositeAlarm)[];
  public readonly logGroups: readonly ILogGroup[];

  constructor(scope: Construct, id: string, props: CarLogsStackProps) {
    super(scope, id, props);

    const carLogs = new CarLogs(this, 'CarLogs', {
      namespace: props.namespace,
      dynamoDBTable: props.dynamoDBTable,
      userPool: props.userPool,
      encryptionKey: props.encryptionKey,
      deviceLogsBucket: props.deviceLogsBucket,
      modelStorageBucket: props.modelStorageBucket,
      videoProcessorRepository: props.videoProcessorRepository,
      videoProcessorImageTag: props.videoProcessorImageTag,
    });

    this.handlerArns = carLogs.handlerArns;
    this.alarms = carLogs.alarms;
    this.logGroups = carLogs.logGroups;
  }
}
