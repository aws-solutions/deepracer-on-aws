// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { IUserPool, UserPool } from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { IVpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import { OperationsOwnedBy } from '#constants/operationOwnership.js';
import { Api } from '#constructs/api/api.js';
import { GlobalSettings } from '#constructs/storage/appConfig.js';

import { EcrStack } from './ecrStack';

export interface ApiStackProps extends NestedStackProps {
  userPool: UserPool | IUserPool;
  dynamoDBTable: TableV2;
  modelStorageBucket: Bucket;
  uploadBucket: Bucket;
  virtualModelBucket: Bucket;
  deviceLogsBucket: Bucket;
  ecrStack: EcrStack;
  userExecutionVpc: IVpc;
  userExecutionSecurityGroup: SecurityGroup;
  globalSettings: GlobalSettings;
  namespace: string;
}

/**
 * Outputs from ApiStack consumed by other stacks.
 *
 * All fields are plain strings (ARNs, URLs) — not CDK construct references. String
 * props do not create implicit CDK cross-stack dependency edges; construct references
 * do.
 *
 * Note what is absent: nothing API Gateway related. The REST API lives in
 * `GatewayStack`, and no stack other than root needs anything from it.
 */
export interface CoreApiOutputs {
  /** FIFO queue URL for dispatching training/evaluation jobs */
  readonly workflowJobQueueUrl: string;
  /** FIFO queue ARN — used to grant SendMessage on a Lambda in another stack */
  readonly workflowJobQueueArn: string;
}

/**
 * ApiStack — the core (non-epic) API Lambda functions and their supporting resources.
 *
 * Despite the name, this stack no longer contains the API Gateway; that moved to
 * `GatewayStack` so the API definition (the largest and fastest-growing resource in
 * the template) stops competing with Lambda functions for the 1 MB template limit.
 *
 * The construct id `'ApiStack'` is retained deliberately even though the class is
 * about core handlers: changing the id would change the nested stack's logical ID and
 * replace every resource inside it.
 */
export class ApiStack extends NestedStack {
  public readonly workflowJobQueue: Queue;
  public readonly apiConstruct: Api;

  /** Plain-string outputs for other stacks. */
  public readonly coreApiOutputs: CoreApiOutputs;

  /**
   * Smithy operation → Lambda ARN for every core-owned operation.
   * Root passes this to `GatewayStack` alongside each epic stack's map.
   */
  public readonly handlerArns: Readonly<Record<OperationsOwnedBy<'core'>, string>>;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      userPool,
      dynamoDBTable,
      modelStorageBucket,
      uploadBucket,
      virtualModelBucket,
      deviceLogsBucket,
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
      deviceLogsBucket,
      ecrStack,
      userExecutionVpc,
      userExecutionSecurityGroup,
      globalSettings,
      namespace,
    });

    this.workflowJobQueue = apiConstruct.workflowJobQueue;
    this.apiConstruct = apiConstruct;
    this.handlerArns = apiConstruct.handlerArns;

    this.coreApiOutputs = {
      workflowJobQueueUrl: apiConstruct.workflowJobQueue.queueUrl,
      workflowJobQueueArn: apiConstruct.workflowJobQueue.queueArn,
    };
  }
}
