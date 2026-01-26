// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { SpecRestApi } from 'aws-cdk-lib/aws-apigateway';
import { IUserPool, UserPool } from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { IVpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import { Api } from '#constructs/api/api.js';
import { GlobalSettings } from '#constructs/storage/appConfig.js';

import { EcrStack } from './ecrStack';

export interface ApiStackProps extends NestedStackProps {
  userPool: UserPool | IUserPool;
  dynamoDBTable: TableV2;
  modelStorageBucket: Bucket;
  uploadBucket: Bucket;
  virtualModelBucket: Bucket;
  ecrStack: EcrStack;
  userExecutionVpc: IVpc;
  userExecutionSecurityGroup: SecurityGroup;
  globalSettings: GlobalSettings;
  namespace: string;
}

export class ApiStack extends NestedStack {
  public readonly api: SpecRestApi;
  public readonly workflowJobQueue: Queue;
  public readonly apiConstruct: Api;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      userPool,
      dynamoDBTable,
      modelStorageBucket,
      uploadBucket,
      virtualModelBucket,
      ecrStack,
      userExecutionVpc,
      userExecutionSecurityGroup,
      globalSettings,
      namespace,
    } = props;

    const apiConstruct = new Api(this, 'Api', {
      userPool,
      dynamoDBTable,
      modelStorageBucket,
      uploadBucket,
      virtualModelBucket,
      ecrStack,
      userExecutionVpc,
      userExecutionSecurityGroup,
      globalSettings,
      namespace,
    });

    this.api = apiConstruct.api;
    this.workflowJobQueue = apiConstruct.workflowJobQueue;
    this.apiConstruct = apiConstruct;
  }
}
