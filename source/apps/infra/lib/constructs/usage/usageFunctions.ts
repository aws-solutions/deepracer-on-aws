// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { S3EventSourceV2 } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Bucket, EventType } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { addCfnGuardSuppressionForAutoCreatedLambdas } from '../common/cfnGuardHelper.js';
import { LogGroupCategory } from '../common/logGroupsHelper.js';
import { functionNamePrefix, NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

export interface UsageFunctionsProps {
  dynamoDBTable: TableV2;
  modelStorageBucket: Bucket;
  namespace: string;
}

export class UsageFunctions extends Construct {
  readonly updateStorageUsedByProfileFn: NodeLambdaFunction;

  constructor(scope: Construct, id: string, { dynamoDBTable, modelStorageBucket, namespace }: UsageFunctionsProps) {
    super(scope, id);

    // Create a function that updates the model storage usage for a given user profile, whenever a model
    // is added or removed from the model storage bucket
    this.updateStorageUsedByProfileFn = new NodeLambdaFunction(this, 'UpdateStorageUsedByProfileFn', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/usage/updateStorageUsedByProfile.ts'),
      functionName: `${functionNamePrefix}-UpdateStorageUsedByProfileFn`,
      logGroupCategory: LogGroupCategory.SYSTEM_EVENTS,
      namespace,
      environment: {
        MODEL_STORAGE_BUCKET_NAME: modelStorageBucket.bucketName,
      },
    });

    this.updateStorageUsedByProfileFn.addEventSource(
      new S3EventSourceV2(modelStorageBucket, {
        events: [EventType.OBJECT_CREATED, EventType.OBJECT_REMOVED],
      }),
    );

    modelStorageBucket.grantRead(this.updateStorageUsedByProfileFn);
    dynamoDBTable.grantWriteData(this.updateStorageUsedByProfileFn);

    addCfnGuardSuppressionForAutoCreatedLambdas(this, 'BucketNotificationsHandler');
  }
}
