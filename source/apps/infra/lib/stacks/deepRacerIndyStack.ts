// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { DEFAULT_NAMESPACE } from '@deepracer-indy/config/src/defaults/commonDefaults.js';
import { Stack, Duration, CfnParameter, Fn, CfnCondition, CfnRule, Token, CfnOutput, ArnFormat } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { ComputeType } from 'aws-cdk-lib/aws-codebuild';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import { getModelOptimizerFunctionName } from '#constants/lambdaNames.js';
import { addCfnGuardSuppression } from '#constructs/common/cfnGuardHelper.js';
import { LogGroupCategory } from '#constructs/common/logGroupsHelper.js';
import { readManifest } from '#constructs/common/manifestReader.js';
import { NodeLambdaFunction } from '#constructs/common/nodeLambdaFunction.js';
import { SesProductionAccessCheck } from '#constructs/ses/sesProductionAccessCheck.js';
import { UsageFunctions } from '#constructs/usage/usageFunctions.js';

import { ApiStack } from './apiStack.js';
import { DeviceManagementStack } from './deviceManagementStack.js';
import { EcrStack } from './ecrStack.js';
import { EventManagementStack } from './eventManagementStack.js';
import { GatewayStack } from './gatewayStack.js';
import { ModelManagementStack } from './modelManagementStack.js';
import { RealTimeRolesStack } from './realTimeRolesStack.js';
import { SolutionStackProps } from './solutionStackProps.js';
import { resolveImageSource } from './utils/helpers.js';
import { UserIdentity } from '../constructs/auth/userIdentity.js';
import { UserRolePolicies } from '../constructs/auth/userRolePolicies.js';
import { BulkInviteWorkflow } from '../constructs/bulk-invite/bulkInviteWorkflow.js';
import { applyDrTag } from '../constructs/common/taggingHelper.js';
import { LiveRaceEvents } from '../constructs/live-race/liveRaceEvents.js';
import { LiveRaceWorkflow } from '../constructs/live-race-workflow/liveRaceWorkflow.js';
import { MetricsInfra } from '../constructs/metrics/metricsInfra.js';
import { MonitoringDashboard } from '../constructs/observability/dashboard.js';
import { LogInsights } from '../constructs/observability/logInsights.js';
import { ResourceGroup } from '../constructs/observability/resourceGroup.js';
import { MonthlyQuotaReset } from '../constructs/scheduled/monthlyQuotaReset.js';
import { EmailDeliveryMethodAudit } from '../constructs/ses/emailDeliveryMethodAudit.js';
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

    const emailDeliveryMethodParam = new CfnParameter(this, 'EmailDeliveryMethod', {
      type: 'String',
      description:
        'Method for delivering authentication emails. If choosing SES, you will need to have production access approved for your account in order to send emails. If choosing Cognito, you will need to consider the daily email limit. See the implementation guide for more information.',
      default: 'COGNITO',
      allowedValues: ['COGNITO', 'SES'],
    });

    const sesVerifiedEmailParam = new CfnParameter(this, 'SesVerifiedEmail', {
      type: 'String',
      description: 'Verified SES email address used to send emails from. Required when EmailDeliveryMethod is SES.',
      default: '',
      allowedPattern: '^$|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      constraintDescription: 'Must be a valid email address or empty.',
    });

    const sesIdentityParam = new CfnParameter(this, 'SesIdentity', {
      type: 'String',
      description:
        'Optional. SES verified identity used to authorize sending. Use a domain (e.g. example.com) if verified at domain level. Defaults to SesVerifiedEmail.',
      default: '',
      allowedPattern: '^$|^[a-zA-Z0-9][a-zA-Z0-9.-]*\\.[a-zA-Z]{2,}$',
      constraintDescription: 'Must be a valid domain name or empty.',
    });

    // CfnRule: block SES if no verified email provided
    new CfnRule(this, 'SesRequiresVerifiedEmail', {
      assertions: [
        {
          assert: Fn.conditionOr(
            Fn.conditionEquals(emailDeliveryMethodParam.valueAsString, 'COGNITO'),
            Fn.conditionNot(Fn.conditionEquals(sesVerifiedEmailParam.valueAsString, '')),
          ),
          assertDescription: 'SesVerifiedEmail must not be empty when EmailDeliveryMethod is SES.',
        },
      ],
    });

    // CfnCondition: true when SES delivery is selected
    const isSesEnabled = new CfnCondition(this, 'IsSesEnabled', {
      expression: Fn.conditionEquals(emailDeliveryMethodParam.valueAsString, 'SES'),
    });

    // CfnCondition: true when a separate SES identity is provided
    const isSesIdentityProvided = new CfnCondition(this, 'IsSesIdentityProvided', {
      expression: Fn.conditionNot(Fn.conditionEquals(sesIdentityParam.valueAsString, '')),
    });

    const { dynamoDBTable } = new DynamoDBTable(this, 'DynamoDBTable', {
      namespace: namespaceParam.valueAsString,
    });
    const { modelStorageBucket, virtualModelBucket, uploadBucket, deviceLogsBucket } = new S3Bucket(this, 'S3Bucket');

    // Default registry/repo-name context values (see cdk.json). Each image can independently
    // redirect to a custom source by setting BOTH its OVERRIDE_*_REPO_NAME context value and
    // OVERRIDE_PUBLIC_ECR_REGISTRY — images that don't set their own override stay pinned to
    // the public AWS Solutions gallery, even if other images are redirected.
    const defaultEcrRegistry = this.node.getContext('PUBLIC_ECR_REGISTRY');
    const overrideEcrRegistry = this.node.tryGetContext('OVERRIDE_PUBLIC_ECR_REGISTRY');

    const { repoName: simAppRepoName, registry: simAppRegistry } = resolveImageSource({
      defaultRegistry: defaultEcrRegistry,
      overrideRegistry: overrideEcrRegistry,
      defaultRepoName: this.node.getContext('SIMAPP_REPO_NAME'),
      overrideRepoName: this.node.tryGetContext('OVERRIDE_SIMAPP_REPO_NAME'),
    });
    const { repoName: validationRewardRepoName, registry: validationRewardRegistry } = resolveImageSource({
      defaultRegistry: defaultEcrRegistry,
      overrideRegistry: overrideEcrRegistry,
      defaultRepoName: this.node.getContext('REWARD_VALIDATION_REPO_NAME'),
      overrideRepoName: this.node.tryGetContext('OVERRIDE_REWARD_VALIDATION_REPO_NAME'),
    });
    const { repoName: modelValidationRepoName, registry: modelValidationRegistry } = resolveImageSource({
      defaultRegistry: defaultEcrRegistry,
      overrideRegistry: overrideEcrRegistry,
      defaultRepoName: this.node.getContext('MODEL_VALIDATION_REPO_NAME'),
      overrideRepoName: this.node.tryGetContext('OVERRIDE_MODEL_VALIDATION_REPO_NAME'),
    });
    const { repoName: modelOptimizerRepoName, registry: modelOptimizerRegistry } = resolveImageSource({
      defaultRegistry: defaultEcrRegistry,
      overrideRegistry: overrideEcrRegistry,
      defaultRepoName: this.node.getContext('MODEL_OPTIMIZER_REPO_NAME'),
      overrideRepoName: this.node.tryGetContext('OVERRIDE_MODEL_OPTIMIZER_REPO_NAME'),
    });

    const { version: solutionVersion } = readManifest();

    // Create ECR nested stack with multiple repositories (one per image)
    const ecrStack = new EcrStack(this, 'Ecr', {
      emptyOnDelete: true, // Set to false for production
      maxImageCount: 20,
      namespace,
      imageConfigs: [
        // DeepRacer simulation application images with custom repository names
        {
          publicImageUri: `${simAppRegistry}/${simAppRepoName}`,
          imageTag: solutionVersion,
          repositoryId: simAppRepoName,
          privateRepositoryName: `${namespace}-${simAppRepoName}`,
        },
        {
          publicImageUri: `${validationRewardRegistry}/${validationRewardRepoName}`,
          imageTag: solutionVersion,
          repositoryId: validationRewardRepoName,
          privateRepositoryName: `${namespace}-${validationRewardRepoName}`,
        },
        {
          publicImageUri: `${modelValidationRegistry}/${modelValidationRepoName}`,
          imageTag: solutionVersion,
          repositoryId: modelValidationRepoName,
          privateRepositoryName: `${namespace}-${modelValidationRepoName}`,
        },
        {
          publicImageUri: `${modelOptimizerRegistry}/${modelOptimizerRepoName}`,
          imageTag: solutionVersion,
          repositoryId: modelOptimizerRepoName,
          privateRepositoryName: `${namespace}-${modelOptimizerRepoName}`,
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

    // Find the Model Optimizer repository
    const modelOptimizerMapping = ecrStack.imageRepositoryMappings.find(
      (mapping) => mapping.repositoryId === modelOptimizerRepoName,
    );

    if (!modelOptimizerMapping) {
      throw new Error('Could not find Model Optimizer repository in ECR stack');
    }

    const { userExecutionVpc, userExecutionSecurityGroup } = new VpcConstruct(this, 'Vpc');

    const globalSettings = new GlobalSettings(this, 'GlobalSettings', { namespace });

    const userIdentity = new UserIdentity(this, 'UserPool', {
      dynamoDBTable,
      adminEmail: adminEmailParam.valueAsString,
      globalSettings,
      namespace,
      isSesEnabled,
      sesVerifiedEmail: sesVerifiedEmailParam.valueAsString,
      sesIdentity: sesIdentityParam.valueAsString,
      isSesIdentityProvided,
    });

    const { userPool, userPoolClient, identityPool, userRoles } = userIdentity;

    const apiStack = new ApiStack(this, 'ApiStack', {
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

    const { workflowJobQueue } = apiStack;

    // ── Epic nested stacks ─────────────────────────────────────────────────────
    // Create in dependency order. Stacks with no epic-to-epic deps can be
    // created in any order relative to each other.
    const eventManagementStack = new EventManagementStack(this, 'EventManagement', {
      namespace,
      dynamoDBTable,
      userPool,
      globalSettings,
      // Physically owned by EcrStack and not relocatable — see EcrStack.encryptionKey.
      encryptionKey: ecrStack.encryptionKey,
    });

    const modelManagementStack = new ModelManagementStack(this, 'ModelManagement', {
      namespace,
      dynamoDBTable,
      modelStorageBucket,
      uploadBucket,
      userPool,
      encryptionKey: ecrStack.encryptionKey,
      modelOptimizerRepositoryArn: modelOptimizerMapping.repository.repositoryArn,
      modelOptimizerRepositoryName: modelOptimizerMapping.repository.repositoryName,
      modelOptimizerImageTag: modelOptimizerMapping.imageTag,
      importModelJobQueueUrl: apiStack.apiConstruct.importModelJobQueue.queueUrl,
      importModelJobQueueArn: apiStack.apiConstruct.importModelJobQueue.queueArn,
    });

    // ECR dependency: ModelManagement uses the optimizer image from EcrStack
    modelManagementStack.node.addDependency(ecrStack);

    // Cross-stack: importModelDispatcher (ApiStack) -> Model Optimizer (ModelManagement)
    // Uses shared constant (not a CDK token) to avoid bidirectional nested stack dependency.
    const optimizerFunctionName = getModelOptimizerFunctionName(namespace);
    apiStack.apiConstruct.importModelWorkflow.importModelDispatcherFunction.addEnvironment(
      'MODEL_OPTIMIZER_FUNCTION_NAME',
      optimizerFunctionName,
    );
    apiStack.apiConstruct.importModelWorkflow.importModelDispatcherFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [
          Stack.of(this).formatArn({
            service: 'lambda',
            resource: 'function',
            resourceName: optimizerFunctionName,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      }),
    );

    const realTimeRolesStack = new RealTimeRolesStack(this, 'RealTimeRoles', {
      namespace,
      dynamoDBTable,
      userPool,
      encryptionKey: ecrStack.encryptionKey,
    });

    const deviceManagementStack = new DeviceManagementStack(this, 'DeviceManagement', {
      namespace,
      dynamoDBTable,
      userPool,
      encryptionKey: ecrStack.encryptionKey,
    });

    // ── API Gateway ────────────────────────────────────────────────────────────
    // Created AFTER every stack that owns API-backed Lambda functions, because it
    // consumes their handler ARNs and owns all of their invoke permissions. The props
    // type is mapped over StackKey, so coverage is checked by the compiler.
    const gatewayStack = new GatewayStack(this, 'Gateway', {
      namespace,
      encryptionKey: ecrStack.encryptionKey,
      handlerArns: {
        core: apiStack.handlerArns,
        eventManagement: eventManagementStack.handlerArns,
        modelManagement: modelManagementStack.handlerArns,
        realTimeRoles: realTimeRolesStack.handlerArns,
        deviceManagement: deviceManagementStack.handlerArns,
      },
    });

    const { api } = gatewayStack;

    new SesProductionAccessCheck(this, 'SesProductionAccessCheck', {
      namespace,
      emailDeliveryMethod: emailDeliveryMethodParam.valueAsString,
      sesVerifiedEmail: sesVerifiedEmailParam.valueAsString,
      isSesEnabled,
    });

    new EmailDeliveryMethodAudit(this, 'EmailDeliveryMethodAudit', {
      namespace,
      emailDeliveryMethod: emailDeliveryMethodParam.valueAsString,
      sesVerifiedEmail: sesVerifiedEmailParam.valueAsString,
    });

    new UserRolePolicies(this, 'UserRolePolicies', {
      api,
      userRoles,
      uploadBucketArn: uploadBucket.bucketArn,
      namespace,
    });

    const workflow = new Workflow(this, 'Workflow', {
      dynamoDBTable,
      modelStorageBucket,
      workflowJobQueue,
      simAppRepositoryUri: `${simAppRepository.repository.repositoryUri}:${simAppRepository.imageTag}`,
      namespace,
    });

    const liveRaceWorkflow = new LiveRaceWorkflow(this, 'LiveRaceWorkflow', {
      dynamoDBTable,
      modelStorageBucket,
      simAppRepositoryUri: `${simAppRepository.repository.repositoryUri}:${simAppRepository.imageTag}`,
      namespace,
      jobInitializerFunction: workflow.jobInitializerFunction,
      jobMonitorFunction: workflow.jobMonitorFunction,
      jobFinalizerFunction: workflow.jobFinalizerFunction,
    });

    // Wire LaunchLiveRace function to the live race state machine
    apiStack.apiConstruct.apiFunctions.LaunchLiveRace.addEnvironment(
      'LIVE_RACE_STATE_MACHINE_ARN',
      liveRaceWorkflow.stateMachine.stateMachineArn,
    );
    liveRaceWorkflow.stateMachine.grantStartExecution(apiStack.apiConstruct.apiFunctions.LaunchLiveRace);

    // ── Bulk invite (Epic 6) — same pattern as LaunchLiveRace above ─────────
    const bulkInviteWorkflow = new BulkInviteWorkflow(this, 'BulkInviteWorkflow', {
      namespace,
      dynamoDBTable,
      userPool,
    });
    const bulkInviteTrigger = apiStack.apiConstruct.apiFunctions.BulkInviteUser;
    bulkInviteTrigger.addEnvironment('BULK_INVITE_STATE_MACHINE_ARN', bulkInviteWorkflow.stateMachine.stateMachineArn);
    // Drives the trigger's pre-flight email-quota check: non-SES deployments are capped at
    // the Cognito daily email limit (the handler defaults COGNITO_DAILY_EMAIL_LIMIT to 50).
    bulkInviteTrigger.addEnvironment('EMAIL_DELIVERY_METHOD', emailDeliveryMethodParam.valueAsString);
    bulkInviteWorkflow.stateMachine.grantStartExecution(bulkInviteTrigger);
    apiStack.apiConstruct.apiFunctions.ClearLiveLeaderboard.addToRolePolicy(
      new PolicyStatement({
        actions: ['states:StopExecution'],
        resources: [
          `arn:aws:states:${this.region}:${this.account}:execution:${liveRaceWorkflow.stateMachine.stateMachineName}:*`,
        ],
      }),
    );

    const attachPolicyFn = apiStack.apiConstruct.apiFunctions.AttachLiveRacePolicy;

    // Create the event bus first so we can pass its resolved name to LiveRaceEvents
    // rather than duplicating the string literal in two places.
    const raceEventBus = new EventBus(this, 'RaceEventBus', {
      eventBusName: `${namespace}-deepracer-events`,
    });

    const liveRaceEvents = new LiveRaceEvents(this, 'LiveRaceEvents', {
      namespace,
      dynamoDBTable,
      attachPolicyFunctionName: attachPolicyFn.functionName,
      devicePrunerFunction: deviceManagementStack.devicePrunerFunction,
      raceEventBusName: raceEventBus.eventBusName,
    });

    attachPolicyFn.addEnvironment('IOT_POLICY_NAME', liveRaceEvents.spectatorPolicyName);
    attachPolicyFn.addEnvironment('IOT_PUBLISH_POLICY_NAME', liveRaceEvents.facilitatorPolicyName);
    attachPolicyFn.addEnvironment('USER_POOL_ID', userPool.userPoolId);
    attachPolicyFn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:AttachPolicy', 'iot:DetachPolicy'],
        resources: ['*'],
      }),
    );
    // Group lookup for policy branching: ListUsers maps the auth-provider sub to a username,
    // AdminListGroupsForUser returns the caller's groups.
    attachPolicyFn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cognito-idp:AdminListGroupsForUser', 'cognito-idp:ListUsers'],
        resources: [userPool.userPoolArn],
      }),
    );

    const website = new StaticWebsite(this, 'Website', {
      apiEndpointUrl: api.url,
      userPoolId: userPool.userPoolId,
      userPoolClientId: userPoolClient.userPoolClientId,
      modelStorageBucket: modelStorageBucket,
      identityPoolId: identityPool.ref,
      uploadBucket,
      namespace,
      solutionVersion,
      iotEndpoint: liveRaceEvents.iotEndpoint,
    });

    // The public leaderboard page fetches public/leaderboards/{id}.json through the website's
    // own CloudFront distribution, so the broadcast handler must write there — not to
    // modelStorageBucket, which isn't behind CloudFront and would be unreachable by that fetch.
    liveRaceEvents.liveBroadcastHandler.addEnvironment('PUBLIC_LEADERBOARD_BUCKET', website.s3Bucket.bucketName);
    liveRaceEvents.liveBroadcastHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:PutObject', 's3:DeleteObject'],
        resources: [website.s3Bucket.arnForObjects('public/leaderboards/*')],
      }),
    );

    // Lets AddTrackToEvent pre-create the public leaderboard placeholder for a new track —
    // see addTrackToEvent.ts / publicLeaderboardS3.ts for why.
    eventManagementStack.addTrackToEventFunction.addEnvironment(
      'PUBLIC_LEADERBOARD_BUCKET',
      website.s3Bucket.bucketName,
    );
    eventManagementStack.addTrackToEventFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:PutObject'],
        resources: [website.s3Bucket.arnForObjects('public/leaderboards/*')],
      }),
    );

    const hasCustomDomain = new CfnCondition(this, 'HasCustomDomain', {
      expression: Fn.conditionNot(Fn.conditionEquals(customDomainParam.valueAsString, '')),
    });

    // Enable wildcard CORS for local development: ENABLE_LOCAL_DEV_CORS=true
    const enableLocalDevCors = process.env.ENABLE_LOCAL_DEV_CORS === 'true';

    const allowedOrigin = enableLocalDevCors
      ? '*'
      : Fn.conditionIf(
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
    // Use the same URL as the CORS allowed origin: custom domain if configured, otherwise CloudFront URL
    userIdentity.updateEmailTemplateWithWebsiteUrl(Token.asString(allowedOrigin));

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
      // Epic constructs expose their shared API log groups explicitly so root can
      // include them in the LogInsights query definitions.
      additionalLogGroups: [
        ...eventManagementStack.logGroups,
        ...modelManagementStack.logGroups,
        ...realTimeRolesStack.logGroups,
        ...deviceManagementStack.logGroups,
      ],
    });

    new MetricsInfra(this, 'MetricsInfra', {
      solutionId: props.solutionId,
      solutionVersion: props.solutionVersion,
      dynamoDBTable,
      namespace,
    });

    // ── Race Stats rebuild (EventBridge-triggered) ─────────────────────────────
    const statsRebuildFn = new NodeLambdaFunction(this, 'StatsRebuildFunction', {
      entry: path.join(__dirname, '../../../../libs/lambda/src/race-management/statsRebuild.ts'),
      functionName: 'RaceManagement-StatsRebuildFn',
      logGroupCategory: LogGroupCategory.DEFAULT,
      namespace,
      timeout: Duration.seconds(60),
      reservedConcurrentExecutions: 1,
    });

    dynamoDBTable.grantReadWriteData(statsRebuildFn);

    const statsRebuildDlq = new Queue(this, 'StatsRebuildDlq', {
      queueName: `${namespace}-RaceManagement-StatsRebuildDLQ`,
      encryption: QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    });
    // SQS_MANAGED (SSE-SQS) is required here because this queue is an EventBridge target DLQ.
    // EventBridge writes failed invocations directly to the DLQ; with KMS_MANAGED the AWS-managed
    // key policy cannot be edited to grant events.amazonaws.com kms:GenerateDataKey, so failed
    // events would be silently dropped instead of landing in the DLQ.
    addCfnGuardSuppression(statsRebuildDlq, ['SQS_QUEUE_KMS_MASTER_KEY_ID_RULE']);

    const statsRebuildDlqAlarm = new Alarm(this, 'StatsRebuildDlqAlarm', {
      metric: statsRebuildDlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 0,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Stats rebuild DLQ has messages — race-submitted events failed after retries',
    });

    new Rule(this, 'RaceSubmittedRule', {
      eventBus: raceEventBus,
      eventPattern: { source: [`deepracer.${namespace}`], detailType: ['race-submitted'] },
      targets: [new LambdaFunction(statsRebuildFn, { deadLetterQueue: statsRebuildDlq, retryAttempts: 2 })],
    });

    new MonitoringDashboard(this, 'MonitoringDashboard', {
      namespace,
      api,
      dynamoDBTable,
      queues: [apiStack.workflowJobQueue],
      alarms: {
        systemAlarms: [
          userIdentity.preSignUpErrorAlarm,
          userIdentity.postSignUpErrorAlarm,
          apiStack.apiConstruct.assetPackagingDLQAlarm,
          apiStack.apiConstruct.workflowJobDeadLetterQueueAlarm,
          apiStack.apiConstruct.importModelWorkflow.lambdaErrorsAlarm,
          liveRaceWorkflow.workflowErrorsAlarm,
          liveRaceWorkflow.streamDlqAlarm,
          statsRebuildDlqAlarm,
          ...bulkInviteWorkflow.alarms,
          // Epic nested stacks contribute their alarms via EpicStack.alarms.
          ...eventManagementStack.alarms,
          ...modelManagementStack.alarms,
          ...realTimeRolesStack.alarms,
          ...deviceManagementStack.alarms,
        ],
        emailAlarms: userIdentity.sesAlarms,
      },
      isSesEnabled,
    });

    // MUST be last: applyDrTag does an eager node.findAll() walk rather than
    // registering an Aspect, so anything constructed after this call is untagged and
    // silently drops out of the ResourceGroup.
    applyDrTag(this, namespace);

    new CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
    });
  }
}
