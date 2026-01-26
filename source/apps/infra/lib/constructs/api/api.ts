// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';
import path from 'node:path';

import { WafwebaclToApiGateway } from '@aws-solutions-constructs/aws-wafwebacl-apigateway';
import type { DeepRacerIndyServiceOperations } from '@deepracer-indy/typescript-server-client';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  ApiDefinition,
  LogGroupLogDestination,
  MethodLoggingLevel,
  ResponseType,
  SpecRestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { Alarm, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { IUserPool, UserPool } from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { IVpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, DockerImageCode, DockerImageFunction } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import { EcrStack } from '../../stacks/ecrStack.js';
import { addCfnGuardSuppression } from '../common/cfnGuardHelper.js';
import { KmsHelper } from '../common/kmsHelper.js';
import { DefaultLogRemovalPolicy, DefaultLogRetentionDays, LogGroupCategory } from '../common/logGroupsHelper.js';
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
  globalSettings: GlobalSettings;
  namespace: string;
}

export class Api extends Construct {
  public readonly api: SpecRestApi;
  public readonly workflowJobQueue: Queue;
  public readonly assetPackagingDLQAlarm: Alarm;
  public readonly importModelJobQueue: Queue;
  public readonly importModelWorkflow: ImportWorkflow;
  public readonly rewardFunctionValidationLambda: DockerImageFunction;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const { namespace } = props;

    this.workflowJobQueue = new Queue(this, 'WorkflowJobQueue', {
      encryption: QueueEncryption.KMS_MANAGED,
      enforceSSL: true,
      fifo: true,
      removalPolicy: RemovalPolicy.DESTROY, // TODO: link to config value
      retentionPeriod: Duration.days(14),
      visibilityTimeout: Duration.minutes(1),
    });

    // Entry points for api lambda handlers in the lambda lib
    const apiHandlerEntryPoints = {
      UpdateGroupMembership: 'api/handlers/updateGroupMembership',
      CreateEvaluation: 'api/handlers/createEvaluation',
      CreateLeaderboard: 'api/handlers/createLeaderboard',
      CreateModel: 'api/handlers/createModel',
      CreateProfile: 'api/handlers/createProfile',
      DeleteLeaderboard: 'api/handlers/deleteLeaderboard',
      DeleteModel: 'api/handlers/deleteModel',
      DeleteProfile: 'api/handlers/deleteProfile',
      DeleteProfileModels: 'api/handlers/deleteProfileModels',
      EditLeaderboard: 'api/handlers/editLeaderboard',
      GetAssetUrl: 'api/handlers/getAssetUrl',
      GetEvaluation: 'api/handlers/getEvaluation',
      GetGlobalSetting: 'api/handlers/getGlobalSetting',
      GetLeaderboard: 'api/handlers/getLeaderboard',
      GetModel: 'api/handlers/getModel',
      GetProfile: 'api/handlers/getProfile',
      GetRanking: 'api/handlers/getRanking',
      ImportModel: 'api/handlers/importModel',
      JoinLeaderboard: 'api/handlers/joinLeaderboard',
      ListEvaluations: 'api/handlers/listEvaluations',
      ListLeaderboards: 'api/handlers/listLeaderboards',
      ListModels: 'api/handlers/listModels',
      ListRankings: 'api/handlers/listRankings',
      ListSubmissions: 'api/handlers/listSubmissions',
      ListProfiles: 'api/handlers/listProfiles',
      StopModel: 'api/handlers/stopModel',
      CreateSubmission: 'api/handlers/createSubmission',
      TestRewardFunction: 'api/handlers/testRewardFunction',
      UpdateGlobalSetting: 'api/handlers/updateGlobalSetting',
      UpdateProfile: 'api/handlers/updateProfile',
    } as const satisfies { [Operation in DeepRacerIndyServiceOperations]: string };

    const functions = (Object.keys(apiHandlerEntryPoints) as DeepRacerIndyServiceOperations[]).reduce(
      (acc, operation) => ({
        ...acc,
        [operation]: new NodeLambdaFunction(this, `${operation}Function`, {
          entry: path.join(__dirname, `../../../../../libs/lambda/src/${apiHandlerEntryPoints[operation]}.ts`),
          functionName: `DeepRacerIndyApi-${operation}Function`,
          logGroupCategory: LogGroupCategory.API,
          namespace,
          timeout:
            operation === 'CreateModel' || operation === 'TestRewardFunction'
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
          ...(operation === 'GetAssetUrl' && { memorySize: 4096 }),
        }),
      }),
      {} as { [Operation in DeepRacerIndyServiceOperations]: NodejsFunction },
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

    const appConfigConsumers = [
      functions.CreateEvaluation,
      functions.CreateModel,
      functions.StopModel,
      functions.GetGlobalSetting,
      functions.UpdateGlobalSetting,
    ];
    appConfigConsumers.forEach((fn) => grantAppConfigAccess(this, fn, props.globalSettings));

    const assetPackagingDLQ = new Queue(this, 'AssetPackagingDLQ', {
      retentionPeriod: Duration.days(1),
      encryption: QueueEncryption.KMS_MANAGED,
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

    // Create Reward Function Validation Lambda using private ECR repository
    const rewardValidationMapping = props.ecrStack.imageRepositoryMappings.find(
      (mapping) => mapping.repositoryId === this.node.getContext('REWARD_VALIDATION_REPO_NAME'),
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

    functions.ImportModel.addEnvironment('IMPORT_MODEL_JOB_QUEUE_URL', this.importModelJobQueue.queueUrl);

    // Grant ImportModel function permission to send messages to import model job queue
    this.importModelJobQueue.grantSendMessages(functions.ImportModel);

    // Grant upload bucket read access to ImportModel function
    props.uploadBucket.grantRead(functions.ImportModel);

    const testRewardFunctionConsumers = [functions.CreateModel, functions.TestRewardFunction];
    testRewardFunctionConsumers.forEach((fn) => {
      fn.addEnvironment('REWARD_FUNCTION_VALIDATION_LAMBDA_NAME', this.rewardFunctionValidationLambda.functionName);
    });

    // Create ApiGateway based on OpenApi spec generated from model
    this.api = new SpecRestApi(this, 'Api', {
      apiDefinition: ApiDefinition.fromInline(this.getOpenApiDef(functions, props.userPool)),
      deploy: true,
      restApiName: `${namespace}-DeepRacerIndyApi`,
      description: 'DeepRacerIndy API',
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(
          new LogGroup(this, 'AccessLogs', {
            encryptionKey: KmsHelper.get(this, props.namespace),
            removalPolicy: DefaultLogRemovalPolicy,
            retention: DefaultLogRetentionDays,
          }),
        ),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        metricsEnabled: true,
        tracingEnabled: true,
      },
    });

    this.api.addGatewayResponse('BadRequestBodyResponse', {
      type: ResponseType.BAD_REQUEST_BODY,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
      statusCode: '400',
      templates: {
        'application/json': '{ "errorMessage": "$context.error.message: $context.error.validationErrorString" }',
      },
    });

    this.api.addGatewayResponse('BadRequestParametersResponse', {
      type: ResponseType.BAD_REQUEST_PARAMETERS,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
      statusCode: '400',
      templates: {
        'application/json': '{ "errorMessage": "$context.error.message: $context.error.validationErrorString" }',
      },
    });

    this.api.applyRemovalPolicy(RemovalPolicy.DESTROY); // TODO: link to config value

    // caching in CloudFront
    addCfnGuardSuppression(this.api.deploymentStage, ['API_GW_CACHE_ENABLED_AND_ENCRYPTED']);

    new WafwebaclToApiGateway(this, 'WafwebaclToApiGateway', {
      existingApiGatewayInterface: this.api,
    });

    for (const apiLambdaHandler of Object.values(functions)) {
      // Grant APIGateway permission to invoke each lambda handler
      apiLambdaHandler.addPermission('PermitAPIGInvocation', {
        principal: new ServicePrincipal('apigateway.amazonaws.com'),
        sourceArn: this.api.arnForExecuteApi('*'),
      });

      // Grant each lambda handler permissions to the DeepRacerIndy data layer
      props.dynamoDBTable.grantReadWriteData(apiLambdaHandler);
      props.modelStorageBucket.grantReadWrite(apiLambdaHandler);

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
          actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminDeleteUser'],
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

    functions.StopModel.addToRolePolicy(
      new PolicyStatement({
        actions: ['sagemaker:DescribeTrainingJob', 'sagemaker:StopTrainingJob'],
        resources: [
          `arn:aws:sagemaker:${Stack.of(this).region}:${Stack.of(this).account}:training-job/deepracerindy-*`,
        ],
      }),
    );

    // Grant the permissions to invoke the RewardFunctionValidationLambda
    this.rewardFunctionValidationLambda.grantInvoke(functions.TestRewardFunction);
    this.rewardFunctionValidationLambda.grantInvoke(functions.CreateModel);
  }

  // Validate and adjust api spec
  private getOpenApiDef(
    functions: { [Operation in DeepRacerIndyServiceOperations]?: NodejsFunction },
    userPool: UserPool | IUserPool,
  ) {
    const openApiSpec = JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          '../../../../../libs/model/build/smithyprojections/model/source/openapi/DeepRacerIndy.openapi.json',
        ),
        'utf-8',
      ),
    );

    // Add the IAM authorizer
    openApiSpec.components.securitySchemes = {
      'aws.iam': {
        type: 'apiKey',
        name: 'authorization',
        in: 'header',
        'x-amazon-apigateway-authtype': 'awsSigv4',
      },
    };

    for (const openApiPath in openApiSpec.paths) {
      for (const operation in openApiSpec.paths[openApiPath]) {
        const op = openApiSpec.paths[openApiPath][operation];
        const integration = op['x-amazon-apigateway-integration'];

        // Configure method integration
        if (!integration) {
          throw new Error(
            `No x-amazon-apigateway-integration for ${op.operationId}. Make sure API Gateway integration is configured.`,
          );
        }

        // Set the authorizer and CORS headers based on method type
        if (operation === 'options') {
          const accessControlAllowHeaders =
            integration.responses.default.responseParameters['method.response.header.Access-Control-Allow-Headers'];
          const updatedHeader = `'x-amz-security-token,x-amz-date,x-amz-content-sha256,${accessControlAllowHeaders.slice(1, -1)}'`;
          integration.responses.default.responseParameters['method.response.header.Access-Control-Allow-Headers'] =
            updatedHeader;
        } else {
          op.security = [{ 'aws.iam': [] }];
        }

        // Don't touch mock integrations
        if (integration?.type === 'mock') {
          continue;
        }

        const functionArn = functions[op.operationId as DeepRacerIndyServiceOperations]?.functionArn;

        if (typeof functionArn !== 'string') {
          throw new Error('No function for ' + op.operationId);
        }

        // Set the operation integration uri to the corresponding lambda handler ARN
        integration.uri = `arn:${Stack.of(this).partition}:apigateway:${Stack.of(this).region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`;
      }
    }

    return openApiSpec;
  }
}
