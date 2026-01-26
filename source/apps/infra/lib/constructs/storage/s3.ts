// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { AnyPrincipal, Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { addCfnGuardSuppression, addCfnGuardSuppressionForAutoCreatedLambdas } from '../common/cfnGuardHelper';

/**
 * S3 buckets for DeepRacer Indy.
 */
export class S3Bucket extends Construct {
  readonly modelStorageBucket: Bucket;
  readonly virtualModelBucket: Bucket;
  readonly uploadBucket: Bucket;
  readonly accessLogsBucket: Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.accessLogsBucket = new Bucket(this, 'AccessLogsBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // an access log bucket
    addCfnGuardSuppression(this.accessLogsBucket, ['S3_BUCKET_LOGGING_ENABLED']);

    // Grant S3 log delivery permissions to write to the access logs bucket
    this.accessLogsBucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal('logging.s3.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources: [this.accessLogsBucket.arnForObjects('*')],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': Stack.of(this).account,
          },
        },
      }),
    );

    this.accessLogsBucket.addToResourcePolicy(this.createDenyNonHttpsPolicy(this.accessLogsBucket));

    this.modelStorageBucket = new Bucket(this, 'ModelStorageBucket', {
      serverAccessLogsBucket: this.accessLogsBucket,
      serverAccessLogsPrefix: 'model-storage-bucket-logs/',
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,

      autoDeleteObjects: true, // TODO: link to config value
      removalPolicy: RemovalPolicy.DESTROY, // TODO: link to config value
      cors: [
        {
          allowedMethods: [HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    this.modelStorageBucket.addToResourcePolicy(this.createDenyNonHttpsPolicy(this.modelStorageBucket));

    this.virtualModelBucket = new Bucket(this, 'VirtualModelBucket', {
      serverAccessLogsBucket: this.accessLogsBucket,
      serverAccessLogsPrefix: 'virtual-model-bucket-logs/',
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      cors: [
        {
          allowedMethods: [HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    this.virtualModelBucket.addToResourcePolicy(this.createDenyNonHttpsPolicy(this.virtualModelBucket));

    this.uploadBucket = new Bucket(this, 'UploadBucket', {
      serverAccessLogsBucket: this.accessLogsBucket,
      serverAccessLogsPrefix: 'upload-bucket-logs/',
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      cors: [
        {
          allowedMethods: [HttpMethods.POST, HttpMethods.GET, HttpMethods.PUT, HttpMethods.DELETE, HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag', 'x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          enabled: true,
          id: 'AutoDeleteUploadedArtifacts',
          expiration: Duration.days(1),
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
      ],
    });

    this.uploadBucket.addToResourcePolicy(this.createDenyNonHttpsPolicy(this.uploadBucket));

    addCfnGuardSuppressionForAutoCreatedLambdas(this, 'Custom::S3AutoDeleteObjectsCustomResourceProvider');
  }

  /**
   * Creates a policy statement that denies non-HTTPS requests to the bucket.
   * @param bucket The S3 bucket to apply the policy to.
   * @returns The policy statement.
   */
  private createDenyNonHttpsPolicy(bucket: Bucket): PolicyStatement {
    return new PolicyStatement({
      effect: Effect.DENY,
      principals: [new AnyPrincipal()],
      actions: ['s3:*'],
      resources: [bucket.bucketArn, bucket.arnForObjects('*')],
      conditions: {
        Bool: {
          'aws:SecureTransport': 'false',
        },
      },
    });
  }
}
