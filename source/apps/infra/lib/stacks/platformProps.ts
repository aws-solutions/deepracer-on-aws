// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { IVpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { Bucket } from 'aws-cdk-lib/aws-s3';

import { GlobalSettings } from '#constructs/storage/appConfig.js';

/**
 * Full set of platform-level resources available to all epic nested stacks.
 * Each stack picks only the fields it needs via Pick<PlatformProps, ...>.
 *
 * This interface is the single source of truth for what "the platform" provides.
 * Add fields here when root creates new shared resources. Never add epic-specific
 * resources here.
 */
export interface PlatformProps {
  /** Deployment namespace (e.g. "deepracer1"). Universal — every stack gets this. */
  readonly namespace: string;
  /** Shared single-table DynamoDB instance. Universal — every stack gets this. */
  readonly dynamoDBTable: TableV2;
  /**
   * Solution-wide customer-managed KMS key. Universal — every stack gets this.
   *
   * Passed explicitly rather than fetched from `KmsHelper.get()` so that epic stacks
   * have no hidden dependency on a static singleton whose behaviour depends on
   * construct creation order. Physically owned by `EcrStack` and not relocatable.
   */
  readonly encryptionKey: IKey;
  /** Primary model storage bucket. */
  readonly modelStorageBucket: Bucket;
  /** Pre-import upload staging bucket. */
  readonly uploadBucket: Bucket;
  /** Exported virtual model download bucket. */
  readonly virtualModelBucket: Bucket;
  /** Device log storage bucket. */
  readonly deviceLogsBucket: Bucket;
  /** Cognito user pool for JWT validation and user group lookups. */
  readonly userPool: IUserPool;
  /** VPC for SageMaker-adjacent Lambda functions (reward validation, model validation). */
  readonly userExecutionVpc: IVpc;
  /** Security group for VPC-attached Lambda functions. */
  readonly userExecutionSecurityGroup: SecurityGroup;
  /** AppConfig application/environment for global settings reads. */
  readonly globalSettings: GlobalSettings;
}
