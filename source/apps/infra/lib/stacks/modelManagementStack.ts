// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Alarm, CompositeAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { ILogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { OperationsOwnedBy } from '#constants/operationOwnership.js';
import { ModelManagement } from '#constructs/model-management/modelManagement.js';

import { EpicStack } from './epicStack.js';
import { PlatformProps } from './platformProps.js';

// ── Props ──────────────────────────────────────────────────────────────────────

export type ModelManagementStackProps = NestedStackProps &
  Pick<
    PlatformProps,
    'namespace' | 'dynamoDBTable' | 'modelStorageBucket' | 'uploadBucket' | 'userPool' | 'encryptionKey'
  > & {
    readonly modelOptimizerRepositoryArn: string;
    readonly modelOptimizerRepositoryName: string;
    readonly modelOptimizerImageTag: string;
    readonly importModelJobQueueUrl: string;
    readonly importModelJobQueueArn: string;
  };

// ── Stack ──────────────────────────────────────────────────────────────────────

export class ModelManagementStack extends NestedStack implements EpicStack<'modelManagement'> {
  public readonly handlerArns: Readonly<Record<OperationsOwnedBy<'modelManagement'>, string>>;
  public readonly alarms: readonly (Alarm | CompositeAlarm)[];
  public readonly logGroups: readonly ILogGroup[];

  constructor(scope: Construct, id: string, props: ModelManagementStackProps) {
    super(scope, id, props);

    const {
      namespace,
      dynamoDBTable,
      modelStorageBucket,
      uploadBucket,
      userPool,
      encryptionKey,
      modelOptimizerRepositoryArn,
      modelOptimizerRepositoryName,
      modelOptimizerImageTag,
      importModelJobQueueUrl,
      importModelJobQueueArn,
    } = props;

    const modelManagement = new ModelManagement(this, 'ModelManagement', {
      namespace,
      dynamoDBTable,
      modelStorageBucket,
      uploadBucket,
      userPool,
      encryptionKey,
      modelOptimizerRepositoryArn,
      modelOptimizerRepositoryName,
      modelOptimizerImageTag,
      importModelJobQueueUrl,
      importModelJobQueueArn,
    });

    this.handlerArns = modelManagement.handlerArns;
    this.alarms = modelManagement.alarms;
    this.logGroups = modelManagement.logGroups;
  }
}
