// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration, RemovalPolicy, Size } from 'aws-cdk-lib';
import {
  EcsFargateContainerDefinition,
  EcsJobDefinition,
  FargateComputeEnvironment,
  JobQueue,
} from 'aws-cdk-lib/aws-batch';
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { IRepository } from 'aws-cdk-lib/aws-ecr';
import { ContainerImage, LogDriver } from 'aws-cdk-lib/aws-ecs';
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import {
  addCfnGuardSuppression,
  addCfnGuardSuppressionForAutoCreatedLambdas,
  addCfnGuardSuppressionForAutoCreatedRoles,
} from '#constructs/common/cfnGuardHelper.js';
import { DefaultLogRemovalPolicy, DefaultLogRetentionDays } from '#constructs/common/logGroupsHelper.js';

const MAX_VCPUS = 32;
const JOB_VCPUS = 8;
const JOB_MEMORY_MIB = 16384;
// Bags are processed one at a time, but a single bag archive can be up to 20 GiB.
const JOB_EPHEMERAL_STORAGE_GIB = 100;
const JOB_TIMEOUT = Duration.hours(2);

export interface CarLogsBatchProps {
  readonly encryptionKey: IKey;
  readonly deviceLogsBucket: IBucket;
  readonly modelStorageBucket: IBucket;
  readonly videoProcessorRepository: IRepository;
  readonly videoProcessorImageTag: string;
}

/**
 * AWS Batch on Fargate that runs the car-log video processor container, in a dedicated VPC that
 * has public subnets and no NAT gateway. The only traffic allowed out of the job is HTTPS.
 */
export class CarLogsBatch extends Construct {
  public readonly jobQueue: JobQueue;
  public readonly jobDefinition: EcsJobDefinition;
  public readonly logGroup: LogGroup;

  constructor(scope: Construct, id: string, props: CarLogsBatchProps) {
    super(scope, id);

    const { encryptionKey, deviceLogsBucket, modelStorageBucket, videoProcessorRepository, videoProcessorImageTag } =
      props;

    const vpc = new Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      restrictDefaultSecurityGroup: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: false,
        },
      ],
    });
    vpc.applyRemovalPolicy(RemovalPolicy.DESTROY);
    // CDK creates the role and function that restrict the default security group
    addCfnGuardSuppressionForAutoCreatedRoles(this, 'VpcRestrictDefaultSG');
    addCfnGuardSuppressionForAutoCreatedLambdas(this, 'VpcRestrictDefaultSG');

    const securityGroup = new SecurityGroup(this, 'SecurityGroup', {
      vpc,
      allowAllOutbound: false,
      description: 'Car log video processor: HTTPS egress only',
    });
    securityGroup.addEgressRule(Peer.anyIpv4(), Port.tcp(443), 'HTTPS to S3 and ECR');
    addCfnGuardSuppression(securityGroup, ['SECURITY_GROUP_EGRESS_PORT_RANGE_RULE']);

    this.logGroup = new LogGroup(this, 'LogGroup', {
      retention: DefaultLogRetentionDays,
      removalPolicy: DefaultLogRemovalPolicy,
      encryptionKey,
    });

    const computeEnvironment = new FargateComputeEnvironment(this, 'ComputeEnvironment', {
      vpc,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      securityGroups: [securityGroup],
      maxvCpus: MAX_VCPUS,
    });

    this.jobQueue = new JobQueue(this, 'JobQueue', { priority: 1 });
    this.jobQueue.addComputeEnvironment(computeEnvironment, 1);

    const executionRole = new Role(this, 'ExecutionRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')],
    });

    const jobRole = new Role(this, 'JobRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    const { bucketArn } = deviceLogsBucket;
    jobRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:GetObject'],
        resources: [`${bucketArn}/job-configs/*`, `${bucketArn}/carlogs/*/bags/*`],
      }),
    );
    jobRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:ListBucket'],
        resources: [bucketArn],
        conditions: { StringLike: { 's3:prefix': ['carlogs/*/bags/*'] } },
      }),
    );
    jobRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:PutObject', 's3:AbortMultipartUpload'],
        resources: [`${bucketArn}/carlogs/*/videos/*`, `${bucketArn}/results/*`],
      }),
    );
    modelStorageBucket.grantRead(jobRole);

    this.jobDefinition = new EcsJobDefinition(this, 'JobDefinition', {
      timeout: JOB_TIMEOUT,
      container: new EcsFargateContainerDefinition(this, 'Container', {
        image: ContainerImage.fromEcrRepository(videoProcessorRepository, videoProcessorImageTag),
        cpu: JOB_VCPUS,
        memory: Size.mebibytes(JOB_MEMORY_MIB),
        ephemeralStorageSize: Size.gibibytes(JOB_EPHEMERAL_STORAGE_GIB),
        assignPublicIp: true,
        executionRole,
        jobRole,
        logging: LogDriver.awsLogs({ logGroup: this.logGroup, streamPrefix: 'car-log-video-processor' }),
        environment: {
          CODEC: 'avc1',
          SKIP_DURATION: '5.0',
          RELATIVE_LABELS: 'true',
        },
      }),
    });
  }
}
