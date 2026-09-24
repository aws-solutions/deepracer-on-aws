// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import type { DeepRacerIndyServiceOperations } from '@deepracer-indy/typescript-server-client';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Alarm, MathExpression, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { IUserPool, UserPool } from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { IVpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, DockerImageCode, DockerImageFunction } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { FilterPattern, MetricFilter } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import { OperationsOwnedBy, operationsOwnedBy } from '../../constants/operationOwnership.js';
import { EcrStack } from '../../stacks/ecrStack.js';
import { BULK_INVITE_METRICS_NAMESPACE } from '../bulk-invite/bulkInviteWorkflow.js';
import { addCfnGuardSuppression } from '../common/cfnGuardHelper.js';
import { LogGroupCategory } from '../common/logGroupsHelper.js';
import { NodeLambdaFunction } from '../common/nodeLambdaFunction.js';
import { grantAppConfigAccess } from '../common/permissionsHelper.js';
import { ImportWorkflow } from '../import-workflow/importWorkflow.js';
import { GlobalSettings } from '../storage/appConfig.js';

export interface ApiProps {
  userPool: UserPool | IUserPool;
  dynamoDBTable: TableV2;
  modelStorageBucket: Bucket;
  uploadBucket: Bucket;
  ecrStack: EcrStack;
  userExecutionVpc: IVpc;
  userExecutionSecurityGroup: SecurityGroup;
  virtualModelBucket: Bucket;
  deviceLogsBucket: Bucket;
  globalSettings: GlobalSettings;
  namespace: string;
}

/**
 * Operations that live in the Api construct. Derived from OPERATION_OWNER — do not
 * maintain a second list here. Operations owned by an epic nested stack are absent
 * by construction, so including one by accident is a compile error.
 *
 * @see lib/constants/operationOwnership.ts
 */
type CoreOperations = OperationsOwnedBy<'core'>;

export class Api extends Construct {
  public readonly workflowJobQueue: Queue;
  public readonly workflowJobDeadLetterQueue: Queue;
  public readonly workflowJobDeadLetterQueueAlarm: Alarm;
  public readonly assetPackagingDLQAlarm: Alarm;
  public readonly importModelJobQueue: Queue;
  public readonly importModelWorkflow: ImportWorkflow;
  public readonly rewardFunctionValidationLambda: DockerImageFunction;
  /**
   * Core API Lambda functions owned by ApiStack. Epic operations are absent —
   * they live in their own NestedStack and are accessed via epicHandlerOverrides.
   */
  public readonly apiFunctions: { [Operation in CoreOperations]: NodeLambdaFunction };
  /**
   * Smithy operation → Lambda ARN for every core-owned operation.
   * Root passes this to GatewayStack, which builds the OpenAPI integrations and the
   * invoke permissions. Plain strings: no construct references cross the boundary.
   */
  public readonly handlerArns: Readonly<Record<CoreOperations, string>>;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const { namespace } = props;

    // DLQ for the workflow queue: a repeatedly-failing message (single MessageGroupId =
    // head-of-line blocking) would otherwise block the queue for its whole retention.
    this.workflowJobDeadLetterQueue = new Queue(this, 'WorkflowJobDeadLetterQueue', {
      encryption: QueueEncryption.KMS_MANAGED,
      enforceSSL: true,
      fifo: true,
      removalPolicy: RemovalPolicy.DESTROY,
      retentionPeriod: Duration.days(14),
    });

    // Alarm on any DLQ message (a never-dispatched job); mirrors assetPackagingDLQAlarm.
    this.workflowJobDeadLetterQueueAlarm = new Alarm(this, 'WorkflowJobDLQAlarm', {
      metric: this.workflowJobDeadLetterQueue.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription:
        'A training job dispatch message has been moved to the workflow job DLQ after exhausting retries',
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    this.workflowJobQueue = new Queue(this, 'WorkflowJobQueue', {
      encryption: QueueEncryption.KMS_MANAGED,
      enforceSSL: true,
      fifo: true,
      removalPolicy: RemovalPolicy.DESTROY, // TODO: link to config value
      retentionPeriod: Duration.days(14),
      // >= 6x the JobDispatcher timeout (2 min); otherwise a message redelivers mid-processing
      // and the job is dispatched twice.
      visibilityTimeout: Duration.minutes(12),
      deadLetterQueue: {
        queue: this.workflowJobDeadLetterQueue,
        // 3 x 12-min visibility = a poison message blocks at most ~36 min before moving aside.
        maxReceiveCount: 3,
      },
    });

    // Entry points for api lambda handlers in the lambda lib
    const apiHandlerEntryPoints = {
      ClearLiveLeaderboard: 'api/handlers/clearLiveLeaderboard',
      BulkInviteUser: 'api/handlers/bulkInviteUser',
      CreateEvaluation: 'api/handlers/createEvaluation',
      CreateLeaderboard: 'api/handlers/createLeaderboard',
      CreateModel: 'api/handlers/createModel',
      CreateProfile: 'api/handlers/createProfile',
      CreateSubmission: 'api/handlers/createSubmission',
      DeclareWinner: 'api/handlers/declareWinner',
      GetBulkInviteUserJobStatus: 'api/handlers/getBulkInviteUserJobStatus',
      ListBulkInviteUserJobs: 'api/handlers/listBulkInviteUserJobs',
      ResendInvite: 'api/handlers/resendInvite',
      DeleteLeaderboard: 'api/handlers/deleteLeaderboard',
      DeleteModel: 'api/handlers/deleteModel',
      DeleteProfile: 'api/handlers/deleteProfile',
      DeleteProfileModels: 'api/handlers/deleteProfileModels',
      EditLeaderboard: 'api/handlers/editLeaderboard',
      GetAdminAssetUrl: 'api/handlers/getAdminAssetUrl',
      GetAssetUrl: 'api/handlers/getAssetUrl',
      GetEvaluation: 'api/handlers/getEvaluation',
      GetGlobalSetting: 'api/handlers/getGlobalSetting',
      GetLeaderboard: 'api/handlers/getLeaderboard',
      GetLiveRaceState: 'api/handlers/getLiveRaceState',
      GetModel: 'api/handlers/getModel',
      GetProfile: 'api/handlers/getProfile',
      GetRanking: 'api/handlers/getRanking',
      ImportModel: 'api/handlers/importModel',
      JoinLeaderboard: 'api/handlers/joinLeaderboard',
      LaunchLiveRace: 'api/handlers/launchLiveRace',
      ListAdminProfiles: 'api/handlers/listAdminProfiles',
      ListEvaluations: 'api/handlers/listEvaluations',
      ListLeaderboards: 'api/handlers/listLeaderboards',
      ListLiveQueueItems: 'api/handlers/listLiveQueueItems',
      ListModels: 'api/handlers/listModels',
      ListModelsForProfile: 'api/handlers/listModelsForProfile',
      ListProfiles: 'api/handlers/listProfiles',
      ListRankings: 'api/handlers/listRankings',
      ListSubmissions: 'api/handlers/listSubmissions',
      AttachLiveRacePolicy: 'live-race/attachPolicy',
      RemoveLiveQueueItem: 'api/handlers/removeLiveQueueItem',
      ReorderLiveQueue: 'api/handlers/reorderLiveQueue',
      GetRaceStats: 'api/handlers/getStats',
      ResetLiveQueueModel: 'api/handlers/resetLiveQueueModel',
      RetryTraining: 'api/handlers/retryTraining',
      StopModel: 'api/handlers/stopModel',
      TestRewardFunction: 'api/handlers/testRewardFunction',
      UpdateGlobalSetting: 'api/handlers/updateGlobalSetting',
      UpdateGroupMembership: 'api/handlers/updateGroupMembership',
      UpdateProfile: 'api/handlers/updateProfile',
    } as const satisfies Partial<{ [Operation in DeepRacerIndyServiceOperations]: string }>;
    // Cast to allow indexing by any operation (missing keys return undefined at runtime).
    const coreEntryPoints = apiHandlerEntryPoints as Partial<Record<DeepRacerIndyServiceOperations, string>>;

    // Operations owned by epic nested stacks are absent from apiHandlerEntryPoints and
    // from operationsOwnedBy('core'). Their Lambda ARNs arrive via props.epicHandlerOverrides.
    // Any core operation without an explicit entry falls back to the notImplemented handler.
    const notImplementedEntry = 'api/handlers/notImplemented';

    // Core operation list comes from OPERATION_OWNER — the single source of truth.
    // Epic operations are excluded by construction: creating a Lambda here for an
    // operation an epic stack also owns would produce a duplicate physical function
    // name and fail the deployment.
    const allEntryPoints = Object.fromEntries(
      operationsOwnedBy('core').map((op) => [op, coreEntryPoints[op] ?? notImplementedEntry]),
    ) as Record<CoreOperations, string>;

    const functions = (Object.keys(allEntryPoints) as CoreOperations[]).reduce(
      (acc, operation) => ({
        ...acc,
        [operation]: new NodeLambdaFunction(this, `${operation}Function`, {
          entry: path.join(__dirname, `../../../../../libs/lambda/src/${allEntryPoints[operation]}.ts`),
          functionName: `DeepRacerIndyApi-${operation}Function`,
          logGroupCategory: LogGroupCategory.API,
          namespace,
          timeout:
            operation === 'CreateModel' || operation === 'TestRewardFunction' || operation === 'RetryTraining'
              ? Duration.seconds(60)
              : Duration.seconds(30),
          environment: {
            POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyApi',
            WORKFLOW_JOB_QUEUE_URL: this.workflowJobQueue.queueUrl,
            MODEL_DATA_BUCKET_NAME: props.modelStorageBucket.bucketName,
            AWS_APPCONFIG_APPLICATION_ID: props.globalSettings.app.attrApplicationId,
            AWS_APPCONFIG_ENVIRONMENT_ID: props.globalSettings.environment.attrEnvironmentId,
            AWS_APPCONFIG_CONFIGURATION_PROFILE_ID:
              props.globalSettings.configurationProfile.attrConfigurationProfileId,
            AWS_APPCONFIG_DEPLOYMENT_STRATEGY: props.globalSettings.deploymentStrategy.attrId,
            USER_POOL_ID: props.userPool.userPoolId,
          },
          ...(operation === 'GetAssetUrl' && { memorySize: 3008 }),
        }),
      }),
      {} as { [Operation in CoreOperations]: NodejsFunction },
    );

    functions.ListProfiles.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:AdminListGroupsForUser'],
        resources: [
          Stack.of(this).formatArn({
            service: 'cognito-idp',
            resource: 'userpool',
            resourceName: props.userPool.userPoolId,
          }),
        ],
      }),
    );

    functions.UpdateProfile.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:AdminListGroupsForUser'],
        resources: [
          Stack.of(this).formatArn({
            service: 'cognito-idp',
            resource: 'userpool',
            resourceName: props.userPool.userPoolId,
          }),
        ],
      }),
    );

    functions.DeleteProfile.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:AdminListGroupsForUser', 'cognito-idp:AdminDeleteUser'],
        resources: [
          Stack.of(this).formatArn({
            service: 'cognito-idp',
            resource: 'userpool',
            resourceName: props.userPool.userPoolId,
          }),
        ],
      }),
    );

    const adminCognitoPolicy = new PolicyStatement({
      actions: ['cognito-idp:AdminListGroupsForUser'],
      resources: [
        Stack.of(this).formatArn({
          service: 'cognito-idp',
          resource: 'userpool',
          resourceName: props.userPool.userPoolId,
        }),
      ],
    });
    functions.ListAdminProfiles.addToRolePolicy(adminCognitoPolicy);
    functions.ListModelsForProfile.addToRolePolicy(adminCognitoPolicy);
    functions.GetAdminAssetUrl.addToRolePolicy(adminCognitoPolicy);
    functions.DeleteProfileModels.addToRolePolicy(adminCognitoPolicy);
    // EditLeaderboard and DeleteLeaderboard call isUserAdmin (AdminListGroupsForUser)
    // to gate admin-only operations on active community races.
    functions.EditLeaderboard.addToRolePolicy(adminCognitoPolicy);
    functions.DeleteLeaderboard.addToRolePolicy(adminCognitoPolicy);
    // GetRaceStats calls isUserAdmin to gate the admin-only Race Statistics page.
    functions.GetRaceStats.addToRolePolicy(adminCognitoPolicy);
    // AttachLiveRacePolicy calls isUserAdminOrFacilitator (AdminListGroupsForUser) to decide
    // whether to attach the publish-capable or subscribe-only IoT policy. Without this grant the
    // call throws and the handler fails closed to the subscribe-only policy for every caller,
    // silently denying Admin/Facilitator the countdown-publish topic (MQTT PUBACK 135).
    functions.AttachLiveRacePolicy.addToRolePolicy(adminCognitoPolicy);
    // UpdateGlobalSetting calls isUserAdmin (AdminListGroupsForUser)
    functions.UpdateGlobalSetting.addToRolePolicy(adminCognitoPolicy);

    const appConfigConsumers = [
      functions.CreateEvaluation,
      functions.CreateModel,
      functions.StopModel,
      functions.GetGlobalSetting,
      functions.UpdateGlobalSetting,
    ];
    appConfigConsumers.forEach((fn) => grantAppConfigAccess(this, fn, props.globalSettings));

    // CreateModel and RetryTraining both gate training dispatch on the two SageMaker training
    // quotas. Usage is summed across every active training job in the account — including jobs this
    // solution did not create — so DescribeTrainingJob is scoped to this account and Region but
    // deliberately not to the deepracerindy- prefix: foreign describes must succeed or the
    // account-wide quota (L-00C91CB5) is under-reported. ListTrainingJobs defines no IAM resource
    // type, so it can only be granted on '*'.
    // SAGEMAKER_INSTANCE_TYPE must match the value JobInitializer passes to CreateTrainingJob, or the
    // check would compare usage against the wrong instance-type quota.
    const region = Stack.of(this).region;
    const account = Stack.of(this).account;
    const trainingCapacityConsumers = [functions.CreateModel, functions.RetryTraining];
    trainingCapacityConsumers.forEach((fn) => {
      fn.addEnvironment('SAGEMAKER_INSTANCE_TYPE', scope.node.tryGetContext('SAGEMAKER_INSTANCE_TYPE') ?? '');
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: ['sagemaker:ListTrainingJobs'],
          resources: ['*'],
        }),
      );
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: ['sagemaker:DescribeTrainingJob'],
          resources: [`arn:aws:sagemaker:${region}:${account}:training-job/*`],
        }),
      );
      fn.addToRolePolicy(
        new PolicyStatement({
          // Granted on '*' deliberately — see the matching comment on the JobInitializer policy in
          // workflow.ts. Scoping to a `quota` ARN is documented but unverified, and a mismatch fails
          // silently as a permanent WAITING_FOR_CAPACITY.
          actions: ['servicequotas:GetServiceQuota'],
          resources: ['*'],
        }),
      );
    });

    const assetPackagingDLQ = new Queue(this, 'AssetPackagingDLQ', {
      retentionPeriod: Duration.days(1),
      encryption: QueueEncryption.KMS_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const assetPackagingLambda = new NodeLambdaFunction(this, 'AssetPackagingLambdaFunction', {
      functionName: 'DeepRacerIndy-AssetPackagingFunction',
      logGroupCategory: LogGroupCategory.SYSTEM_EVENTS,
      namespace,
      entry: path.join(__dirname, '../../../../../libs/lambda/src/async/assetpackaging.ts'),
      architecture: Architecture.X86_64,
      timeout: Duration.minutes(15),
      environment: {
        SOURCE_BUCKET: props.modelStorageBucket.bucketName,
        DEST_BUCKET: props.virtualModelBucket.bucketName,
      },
      deadLetterQueue: assetPackagingDLQ,
    });

    this.assetPackagingDLQAlarm = new Alarm(this, 'AssetPackagingDLQAlarm', {
      metric: assetPackagingDLQ.metricApproximateNumberOfMessagesVisible(),
      threshold: 5,
      evaluationPeriods: 1,
      alarmDescription: 'High number of packaging failures detected in Asset Packaging DLQ',
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    functions.GetAssetUrl.addEnvironment('ASSET_PACKAGING_LAMBDA_NAME', assetPackagingLambda.functionName);
    assetPackagingLambda.grantInvoke(functions.GetAssetUrl);
    props.virtualModelBucket.grantRead(functions.GetAssetUrl);

    props.modelStorageBucket.grantRead(assetPackagingLambda);
    props.virtualModelBucket.grantPut(assetPackagingLambda);
    props.dynamoDBTable.grantWriteData(assetPackagingLambda);

    // The ECR mapping ID is the resolved repository name, including an optional override.
    const rewardValidationRepositoryId =
      this.node.tryGetContext('OVERRIDE_REWARD_VALIDATION_REPO_NAME') ??
      this.node.getContext('REWARD_VALIDATION_REPO_NAME');
    const rewardValidationMapping = props.ecrStack.imageRepositoryMappings.find(
      (mapping) => mapping.repositoryId === rewardValidationRepositoryId,
    );

    if (!rewardValidationMapping) {
      throw new Error('Reward validation ECR repository mapping not found in EcrStack');
    }

    this.rewardFunctionValidationLambda = new DockerImageFunction(this, 'RewardFunctionValidationLambda', {
      functionName: `${namespace}-DeepRacerIndy-RewardFunctionValidationFn`,
      code: DockerImageCode.fromEcr(rewardValidationMapping.repository, {
        tagOrDigest: rewardValidationMapping.imageTag,
      }),
      architecture: Architecture.X86_64,
      timeout: Duration.seconds(60),
      securityGroups: [props.userExecutionSecurityGroup],
      vpc: props.userExecutionVpc,
    });

    addCfnGuardSuppression(this.rewardFunctionValidationLambda, ['LAMBDA_INSIDE_VPC', 'LAMBDA_CONCURRENCY_CHECK']);

    // Add ECR dependency only to the specific lambda function, not the entire Api construct
    this.rewardFunctionValidationLambda.node.addDependency(props.ecrStack);

    this.importModelWorkflow = new ImportWorkflow(this, 'importWorkflow', {
      dynamoDBTable: props.dynamoDBTable,
      modelStorageBucket: props.modelStorageBucket,
      uploadBucket: props.uploadBucket,
      userExecutionVpc: props.userExecutionVpc,
      userExecutionSecurityGroup: props.userExecutionSecurityGroup,
      rewardFunctionValidationLambda: this.rewardFunctionValidationLambda,
      ecrStack: props.ecrStack,
      namespace,
    });
    this.importModelJobQueue = this.importModelWorkflow.importModelJobQueue;

    this.apiFunctions = functions;
    this.handlerArns = Object.fromEntries(
      Object.entries(functions).map(([operation, fn]) => [operation, fn.functionArn]),
    ) as Record<CoreOperations, string>;

    functions.ImportModel.addEnvironment('IMPORT_MODEL_JOB_QUEUE_URL', this.importModelJobQueue.queueUrl);

    // Grant ImportModel function permission to send messages to import model job queue
    this.importModelJobQueue.grantSendMessages(functions.ImportModel);

    // Grant upload bucket read access to ImportModel function
    props.uploadBucket.grantRead(functions.ImportModel);

    const testRewardFunctionConsumers = [functions.CreateModel, functions.TestRewardFunction];
    testRewardFunctionConsumers.forEach((fn) => {
      fn.addEnvironment('REWARD_FUNCTION_VALIDATION_LAMBDA_NAME', this.rewardFunctionValidationLambda.functionName);
    });

    // NOTE: the SpecRestApi, its stage, access logs, gateway responses, WAF, and every
    // AWS::Lambda::Permission for API Gateway invoke now live in GatewayStack.
    // This construct exposes `handlerArns`; root passes it to GatewayStack, which is
    // constructed last.

    const adminMetricNamespace = 'DeepRacerIndyAdmin';

    new MetricFilter(this, 'AdminModelDownloadMetricFilter', {
      logGroup: functions.GetAdminAssetUrl.logGroup,
      filterPattern: FilterPattern.stringValue('$.action', '=', 'ADMIN_MODEL_DOWNLOAD'),
      metricName: 'AdminModelDownloadCount',
      metricNamespace: adminMetricNamespace,
      metricValue: '1',
    });

    new MetricFilter(this, 'AdminAuthFailureMetricFilter', {
      logGroup: functions.ListAdminProfiles.logGroup,
      filterPattern: FilterPattern.stringValue('$.action', '=', 'ADMIN_AUTH_FAILURE'),
      metricName: 'AdminAuthFailureCount',
      metricNamespace: adminMetricNamespace,
      metricValue: '1',
    });

    new MetricFilter(this, 'AdminAuthFailureGetAssetMetricFilter', {
      logGroup: functions.GetAdminAssetUrl.logGroup,
      filterPattern: FilterPattern.stringValue('$.action', '=', 'ADMIN_AUTH_FAILURE'),
      metricName: 'AdminAuthFailureCount',
      metricNamespace: adminMetricNamespace,
      metricValue: '1',
    });

    new MetricFilter(this, 'AdminAuthFailureListModelsMetricFilter', {
      logGroup: functions.ListModelsForProfile.logGroup,
      filterPattern: FilterPattern.stringValue('$.action', '=', 'ADMIN_AUTH_FAILURE'),
      metricName: 'AdminAuthFailureCount',
      metricNamespace: adminMetricNamespace,
      metricValue: '1',
    });

    new MetricFilter(this, 'AdminProfileListMetricFilter', {
      logGroup: functions.ListAdminProfiles.logGroup,
      filterPattern: FilterPattern.stringValue('$.action', '=', 'ADMIN_PROFILE_LIST'),
      metricName: 'AdminProfileListCount',
      metricNamespace: adminMetricNamespace,
      metricValue: '1',
    });

    new MetricFilter(this, 'AdminListModelsMetricFilter', {
      logGroup: functions.ListModelsForProfile.logGroup,
      filterPattern: FilterPattern.stringValue('$.action', '=', 'ADMIN_LIST_MODELS'),
      metricName: 'AdminListModelsCount',
      metricNamespace: adminMetricNamespace,
      metricValue: '1',
    });

    new Alarm(this, 'AdminBulkDownloadAlarm', {
      metric: new Metric({
        namespace: adminMetricNamespace,
        metricName: 'AdminModelDownloadCount',
        period: Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 50,
      evaluationPeriods: 1,
      alarmDescription: 'Unusual bulk admin model download activity detected',
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    new Alarm(this, 'AdminAuthFailuresAlarm', {
      metric: new Metric({
        namespace: adminMetricNamespace,
        metricName: 'AdminAuthFailureCount',
        period: Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 1,
      alarmDescription: 'Potential unauthorized admin access attempts detected',
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    for (const apiLambdaHandler of Object.values(functions)) {
      // API Gateway invoke permission is NOT granted here — GatewayStack owns every
      // Lambda::Permission for the API so that no stack needs both the API ID and the
      // function ARNs (which would close a CloudFormation cycle).

      // Grant each lambda handler permissions to the DeepRacerIndy data layer
      props.dynamoDBTable.grantReadWriteData(apiLambdaHandler);
      // GetAdminAssetUrl only needs read access (least privilege)
      if (apiLambdaHandler === functions.GetAdminAssetUrl) {
        props.modelStorageBucket.grantRead(apiLambdaHandler);
      } else {
        props.modelStorageBucket.grantReadWrite(apiLambdaHandler);
      }

      // Grant lambda permission to call SQS queue
      this.workflowJobQueue.grantSendMessages(apiLambdaHandler);

      // Grant lambda permission to access cognito
      apiLambdaHandler.addToRolePolicy(
        new PolicyStatement({
          actions: ['cognito-idp:ListUsers'],
          resources: [props.userPool.userPoolArn],
        }),
      );

      // Grant CreateProfile function permission to add users to groups
      functions.CreateProfile.addToRolePolicy(
        new PolicyStatement({
          actions: [
            'cognito-idp:AdminCreateUser',
            'cognito-idp:AdminAddUserToGroup',
            'cognito-idp:AdminDeleteUser',
            'cognito-idp:AdminListGroupsForUser',
          ],
          resources: [props.userPool.userPoolArn],
        }),
      );

      // Grant UpdateGroupMembership function permission to manage user groups
      functions.UpdateGroupMembership.addToRolePolicy(
        new PolicyStatement({
          actions: [
            'cognito-idp:AdminAddUserToGroup',
            'cognito-idp:AdminRemoveUserFromGroup',
            'cognito-idp:AdminListGroupsForUser',
          ],
          resources: [props.userPool.userPoolArn],
        }),
      );
    }

    // Grant DeleteModel and DeleteProfileModels Lambda permission to delete models from the Virtual Model S3 bucket
    props.virtualModelBucket.grantDelete(functions.DeleteModel);
    props.virtualModelBucket.grantRead(functions.DeleteModel);
    props.virtualModelBucket.grantDelete(functions.DeleteProfileModels);
    props.virtualModelBucket.grantRead(functions.DeleteProfileModels);

    // ── Bulk invite (Epic 6) ───────────────────────────────────────────────
    // The trigger, status, and resend handlers all gate on isUserAdmin (AdminListGroupsForUser).
    for (const fn of [
      functions.BulkInviteUser,
      functions.GetBulkInviteUserJobStatus,
      functions.ListBulkInviteUserJobs,
      functions.ResendInvite,
    ]) {
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: ['cognito-idp:AdminListGroupsForUser'],
          resources: [props.userPool.userPoolArn],
        }),
      );
    }
    // Resend re-issues the Cognito invitation (AdminCreateUser with MessageAction RESEND) after
    // reading the user's status (AdminGetUser). ListUsers is already granted to every core function.
    functions.ResendInvite.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:AdminGetUser', 'cognito-idp:AdminCreateUser'],
        resources: [props.userPool.userPoolArn],
      }),
    );

    // Business metrics + health alarm. The trigger logs BULK_INVITE_START on every
    // accepted request; the iteration Lambda emits BulkInviteUsersCreated. The StartExecution grant
    // and the state machine ARN env are wired at the root stack (see deepRacerIndyStack), mirroring
    // LaunchLiveRace, because the bulk-invite state machine is created there.
    new MetricFilter(this, 'BulkInviteUsedMetricFilter', {
      logGroup: functions.BulkInviteUser.logGroup,
      filterPattern: FilterPattern.stringValue('$.action', '=', 'BULK_INVITE_START'),
      metricName: 'BulkInviteUsed',
      metricNamespace: BULK_INVITE_METRICS_NAMESPACE,
      metricValue: '1',
    });
    new MetricFilter(this, 'BulkInviteSizeMetricFilter', {
      logGroup: functions.BulkInviteUser.logGroup,
      filterPattern: FilterPattern.stringValue('$.action', '=', 'BULK_INVITE_START'),
      metricName: 'BulkInviteSize',
      metricNamespace: BULK_INVITE_METRICS_NAMESPACE,
      metricValue: '$.totalEntries',
    });
    // Feature-health: jobs were started but zero users were created AND zero were skipped over the
    // window — a strong signal the onboarding path is broken. Requiring skipped<1 too prevents a
    // spurious alarm on a legitimate all-skipped re-import (every entry already exists). FILL
    // anchors the timeline so absent metrics are treated as 0 rather than missing.
    new Alarm(this, 'BulkInviteFeatureHealthAlarm', {
      metric: new MathExpression({
        expression: '(FILL(used, 0) > 0) * (FILL(created, 0) < 1) * (FILL(skipped, 0) < 1)',
        usingMetrics: {
          used: new Metric({
            namespace: BULK_INVITE_METRICS_NAMESPACE,
            metricName: 'BulkInviteUsed',
            statistic: 'Sum',
            period: Duration.minutes(15),
          }),
          created: new Metric({
            namespace: BULK_INVITE_METRICS_NAMESPACE,
            metricName: 'BulkInviteUsersCreated',
            statistic: 'Sum',
            period: Duration.minutes(15),
          }),
          skipped: new Metric({
            namespace: BULK_INVITE_METRICS_NAMESPACE,
            metricName: 'BulkInviteUsersSkipped',
            statistic: 'Sum',
            period: Duration.minutes(15),
          }),
        },
        period: Duration.minutes(15),
        label: 'BulkInviteStartedButNothingProcessed',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Bulk invite jobs started but zero users were created — the feature is likely broken',
    });

    // Trigger-side failures (StartExecution failure, submission-time errors) that never produce a
    // job record and are therefore invisible to the job/execution alarms
    new Alarm(this, 'BulkInviteTriggerErrorsAlarm', {
      metric: functions.BulkInviteUser.metricErrors({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Bulk invite trigger Lambda errored (e.g. StartExecution failure)',
    });

    functions.StopModel.addToRolePolicy(
      new PolicyStatement({
        actions: ['sagemaker:DescribeTrainingJob', 'sagemaker:StopTrainingJob'],
        resources: [
          `arn:aws:sagemaker:${Stack.of(this).region}:${Stack.of(this).account}:training-job/deepracerindy-*`,
        ],
      }),
    );

    for (const fn of [functions.ResetLiveQueueModel, functions.ClearLiveLeaderboard]) {
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: ['sagemaker:DescribeTrainingJob', 'sagemaker:StopTrainingJob'],
          resources: [
            `arn:aws:sagemaker:${Stack.of(this).region}:${Stack.of(this).account}:training-job/deepracerindy-*`,
          ],
        }),
      );
    }

    // Grant the permissions to invoke the RewardFunctionValidationLambda
    this.rewardFunctionValidationLambda.grantInvoke(functions.TestRewardFunction);
    this.rewardFunctionValidationLambda.grantInvoke(functions.CreateModel);
  }
}
