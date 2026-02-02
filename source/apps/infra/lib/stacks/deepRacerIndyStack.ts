// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_NAMESPACE } from '@deepracer-indy/config/src/defaults/commonDefaults.js';
import { Stack, Duration, CfnParameter, Fn, CfnCondition, Token, CfnOutput } from 'aws-cdk-lib';
import { ComputeType } from 'aws-cdk-lib/aws-codebuild';
import { Construct } from 'constructs';

import { readManifest } from '#constructs/common/manifestReader.js';
import { UsageFunctions } from '#constructs/usage/usageFunctions.js';

import { ApiStack } from './apiStack.js';
import { EcrStack } from './ecrStack.js';
import { SolutionStackProps } from './solutionStackProps.js';
import { UserIdentity } from '../constructs/auth/userIdentity.js';
import { UserRolePolicies } from '../constructs/auth/userRolePolicies.js';
import { applyDrTag } from '../constructs/common/taggingHelper.js';
import { MetricsInfra } from '../constructs/metrics/metricsInfra.js';
import { MonitoringDashboard } from '../constructs/observability/dashboard.js';
import { LogInsights } from '../constructs/observability/logInsights.js';
import { ResourceGroup } from '../constructs/observability/resourceGroup.js';
import { MonthlyQuotaReset } from '../constructs/scheduled/monthlyQuotaReset.js';
import { GlobalSettings } from '../constructs/storage/appConfig.js';
import { DynamoDBTable } from '../constructs/storage/dynamoDB.js';
import { S3Bucket } from '../constructs/storage/s3.js';
import { VpcConstruct } from '../constructs/vpc/vpcConstruct.js';
import { ApiCorsUpdate } from '../constructs/website/ApiCorsUpdate.js';
import { StaticWebsite } from '../constructs/website/website.js';
import { Workflow } from '../constructs/workflow/workflow.js';

export class DeepRacerIndyStack extends Stack {
  constructor(scope: Construct, id: string, props: SolutionStackProps) {
    super(scope, id, props);

    // Create CFN parameter for admin email
    const adminEmailParam = new CfnParameter(this, 'AdminEmail', {
      type: 'String',
      description:
        'Email address for the initial admin user. This user will be automatically added to the admin group.',
      allowedPattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      constraintDescription: 'Must be a valid email address',
    });

    const namespaceParam = new CfnParameter(this, 'Namespace', {
      type: 'String',
      description:
        'The namespace for this deployment of DeepRacer. Lowercase alphanumeric characters of length between 3 and 12',
      default: DEFAULT_NAMESPACE,
      allowedPattern: '^[a-z0-9]{3,12}$',
    });

    const namespace = namespaceParam.valueAsString;

    const customDomainParam = new CfnParameter(this, 'CustomDomain', {
      type: 'String',
      description:
        'Custom domain URL for CORS allowlist (only if you have or plan to map a custom domain to CloudFront)',
      allowedPattern: '^(https?://([a-zA-Z0-9.-]+)(\\.([a-zA-Z0-9.-]{2,6}))?(:[0-9]+)?)?$',
      default: '',
    });

    const { dynamoDBTable } = new DynamoDBTable(this, 'DynamoDBTable', {
      namespace: namespaceParam.valueAsString,
    });
    const { modelStorageBucket, virtualModelBucket, uploadBucket } = new S3Bucket(this, 'S3Bucket');

    const publicEcrRegistory = this.node.getContext('PUBLIC_ECR_REGISTRY');
    const simAppRepoName = this.node.getContext('SIMAPP_REPO_NAME');
    const validationRewardRepoName = this.node.getContext('REWARD_VALIDATION_REPO_NAME');
    const modelValidationRepoName = this.node.getContext('MODEL_VALIDATION_REPO_NAME');
    const { version: solutionVersion } = readManifest();

    // Create ECR nested stack with multiple repositories (one per image)
    const ecrStack = new EcrStack(this, 'Ecr', {
      emptyOnDelete: true, // Set to false for production
      maxImageCount: 20,
      namespace,
      imageConfigs: [
        // DeepRacer simulation application images with custom repository names
        {
          publicImageUri: `${publicEcrRegistory}/${simAppRepoName}`,
          imageTag: solutionVersion,
          repositoryId: simAppRepoName,
          privateRepositoryName: `${namespace}-${simAppRepoName}`,
        },
        {
          publicImageUri: `${publicEcrRegistory}/${validationRewardRepoName}`,
          imageTag: solutionVersion,
          repositoryId: validationRewardRepoName,
          privateRepositoryName: `${namespace}-${validationRewardRepoName}`,
        },
        {
          publicImageUri: `${publicEcrRegistory}/${modelValidationRepoName}`,
          imageTag: solutionVersion,
          repositoryId: modelValidationRepoName,
          privateRepositoryName: `${namespace}-${modelValidationRepoName}`,
        },
      ],
      projectNamePrefix: 'DeepRacerIndy-ImageDownloader',
      downloadTimeout: Duration.hours(2), // Allow more time for large images
      computeType: ComputeType.MEDIUM, // Use medium compute for faster downloads
    });

    // Find the SimApp repository URI
    const simAppRepository = ecrStack.imageRepositoryMappings.find(
      (mapping) => mapping.repositoryId === simAppRepoName,
    );

    if (!simAppRepository) {
      throw new Error('Could not find SimApp repository in ECR stack');
    }

    const { userExecutionVpc, userExecutionSecurityGroup } = new VpcConstruct(this, 'Vpc');

    const globalSettings = new GlobalSettings(this, 'GlobalSettings', { namespace });

    const userIdentity = new UserIdentity(this, 'UserPool', {
      dynamoDBTable,
      adminEmail: adminEmailParam.valueAsString,
      globalSettings,
      namespace,
    });

    const { userPool, userPoolClient, identityPool, userRoles } = userIdentity;

    const apiStack = new ApiStack(this, 'ApiStack', {
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

    const { api, workflowJobQueue } = apiStack;

    new UserRolePolicies(this, 'UserRolePolicies', {
      api,
      userRoles,
      uploadBucketArn: uploadBucket.bucketArn,
    });

    new Workflow(this, 'Workflow', {
      dynamoDBTable,
      modelStorageBucket,
      workflowJobQueue,
      simAppRepositoryUri: `${simAppRepository.repository.repositoryUri}:${simAppRepository.imageTag}`,
      namespace,
    });

    const website = new StaticWebsite(this, 'Website', {
      apiEndpointUrl: api.url,
      userPoolId: userPool.userPoolId,
      userPoolClientId: userPoolClient.userPoolClientId,
      modelStorageBucket: modelStorageBucket,
      identityPoolId: identityPool.ref,
      uploadBucket,
      namespace,
    });

    const hasCustomDomain = new CfnCondition(this, 'HasCustomDomain', {
      expression: Fn.conditionNot(Fn.conditionEquals(customDomainParam.valueAsString, '')),
    });

    const allowedOrigin = Fn.conditionIf(
      hasCustomDomain.logicalId,
      customDomainParam.valueAsString,
      `https://${website.cloudFrontDomainName}`,
    );
    new ApiCorsUpdate(this, 'UpdateApiCors', {
      apiId: api.restApiId,
      allowedOrigin: Token.asString(allowedOrigin),
      namespace,
    });

    // Update email template with website URL after website is deployed
    userIdentity.updateEmailTemplateWithWebsiteUrl(`https://${website.cloudFrontDomainName}`);

    new UsageFunctions(this, 'UsageFunctions', {
      dynamoDBTable,
      modelStorageBucket,
      namespace,
    });

    new MonthlyQuotaReset(this, 'MonthlyQuotaReset', {
      dynamoDBTable,
      namespace,
    });

    new ResourceGroup(this, 'ResourceGroup', {
      namespace,
    });

    new LogInsights(this, 'LogInsights', {
      namespace,
    });

    new MetricsInfra(this, 'MetricsInfra', {
      solutionId: props.solutionId,
      solutionVersion: props.solutionVersion,
      dynamoDBTable,
      namespace,
    });

    new MonitoringDashboard(this, 'MonitoringDashboard', {
      namespace,
      api: apiStack.api,
      dynamoDBTable,
      queues: [apiStack.workflowJobQueue],
      alarms: [
        userIdentity.preSignUpErrorAlarm,
        userIdentity.postSignUpErrorAlarm,
        apiStack.apiConstruct.assetPackagingDLQAlarm,
        apiStack.apiConstruct.importModelWorkflow.lambdaErrorsAlarm,
      ],
    });

    applyDrTag(this, namespace);

    new CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
    });
  }
}
