// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { CustomResource, Duration, Stack } from 'aws-cdk-lib';
import { BuildSpec, ComputeType, LinuxBuildImage, Project, ProjectProps, Source } from 'aws-cdk-lib/aws-codebuild';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { ManagedPolicy, Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct, IConstruct } from 'constructs';

import { extractEcrLoginMap, generateEcrLoginCommands } from './helpers.js';
import { addCfnGuardSuppression, addCfnGuardSuppressionForAutoCreatedLambdas } from '../common/cfnGuardHelper.js';
import { KmsHelper } from '../common/kmsHelper.js';
import { DefaultLogRemovalPolicy, LogGroupCategory, LogGroupsHelper } from '../common/logGroupsHelper.js';
import { NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

export interface ImageRepositoryMapping {
  publicImageUri: string;
  imageTag: string;
  repository: Repository;
  /**
   * The name for the private ECR repository where this image will be stored
   */
  privateRepositoryName: string;

  /**
   * the identifier used in the collection of images passed around between components
   * would be set to the values of the repo names in the context
   */
  repositoryId: string;
}

export interface EcrImageDownloaderWithTriggerProps {
  /**
   * Mappings of public ECR images to their target repositories
   */
  imageRepositoryMappings: ImageRepositoryMapping[];

  /**
   * Optional project name prefix
   * @default 'DeepRacerIndy-ECRImageDownloader'
   */
  projectNamePrefix?: string;

  /**
   * Optional timeout for the CodeBuild project
   * @default Duration.hours(1)
   */
  timeout?: Duration;

  /**
   * Optional compute type for the CodeBuild project
   * @default ComputeType.SMALL
   */
  computeType?: ComputeType;
  /**
   * the deployment's namespace
   */
  namespace: string;
}

export class EcrImageDownloaderWithTrigger extends Construct {
  public readonly codeBuildProject: Project;
  public readonly codeBuildRole: Role;
  public readonly triggerFunction: NodeLambdaFunction;
  public readonly customResourceProvider: Provider;
  public readonly autoTriggerResource: CustomResource;

  constructor(scope: Construct, id: string, props: EcrImageDownloaderWithTriggerProps) {
    super(scope, id);

    const region = Stack.of(this).region;
    const account = Stack.of(this).account;
    const projectNamePrefix = `${props.projectNamePrefix ?? 'DeepRacerIndy-ECRImageDownloader'}`;
    const projectNamePrefixNamespaced = `${props.namespace}-${projectNamePrefix}`;

    // Create stack-specific log group name to ensure isolation between deployments
    // This allows each stack to have its own log group that persists after rollback
    // const stackSpecificLogGroupName = `/aws/codebuild/${projectNamePrefix}-${stackName}`;
    const namespacedLogGroupName = `/aws/codebuild/${projectNamePrefixNamespaced}`;

    // Create IAM role for CodeBuild
    this.codeBuildRole = new Role(this, 'CodeBuildRole', {
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
      description: 'Role for CodeBuild project to download ECR images from public gallery',
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly')],
    });

    // Attach inline policy using attachInlinePolicy method to comply with CFN Guard
    this.codeBuildRole.attachInlinePolicy(
      new Policy(this, 'ECRAccessPolicy', {
        document: new PolicyDocument({
          statements: [
            // ECR permissions for all target repositories
            new PolicyStatement({
              actions: [
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'ecr:GetAuthorizationToken',
                'ecr:PutImage',
                'ecr:InitiateLayerUpload',
                'ecr:UploadLayerPart',
                'ecr:CompleteLayerUpload',
              ],
              resources: props.imageRepositoryMappings.map((mapping) => mapping.repository.repositoryArn),
            }),
            // ECR authorization token (required for all ECR operations)
            new PolicyStatement({
              actions: ['ecr:GetAuthorizationToken'],
              resources: ['*'],
            }),
            // Public ECR permissions
            new PolicyStatement({
              actions: [
                'ecr-public:GetAuthorizationToken',
                'ecr-public:BatchCheckLayerAvailability',
                'ecr-public:GetDownloadUrlForLayer',
                'ecr-public:BatchGetImage',
              ],
              resources: ['*'],
            }),
            // STS permissions for ECR Public authentication
            new PolicyStatement({
              actions: ['sts:GetServiceBearerToken'],
              resources: ['*'],
            }),
            // CloudWatch Logs permissions
            new PolicyStatement({
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: [
                `arn:aws:logs:${region}:${account}:log-group:${namespacedLogGroupName}`,
                `arn:aws:logs:${region}:${account}:log-group:${namespacedLogGroupName}:*`,
              ],
            }),
          ],
        }),
      }),
    );

    // Grant CodeBuild role permissions to use KMS key for log encryption
    const kmsKey = KmsHelper.get(this, props.namespace);
    kmsKey.grantEncryptDecrypt(this.codeBuildRole);

    // Create CloudWatch Log Group with stack-specific naming and retention policy
    // This ensures the log group persists after stack rollback for debugging purposes
    const logGroup = new LogGroup(this, 'LogGroup', {
      logGroupName: namespacedLogGroupName,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: DefaultLogRemovalPolicy,
      encryptionKey: kmsKey,
    });

    // Extract unique account ID and region pairs from publicImageUri
    const ecrLoginMap = extractEcrLoginMap(props.imageRepositoryMappings);
    const ecrLoginCommands = generateEcrLoginCommands(ecrLoginMap);

    // Create buildspec for downloading and pushing images
    const buildSpec = BuildSpec.fromObject({
      version: '0.2',
      env: {
        variables: {
          AWS_DEFAULT_REGION: region,
          AWS_ACCOUNT_ID: account,
          ECR_LOGIN_MAP: JSON.stringify(ecrLoginMap),
          IMAGE_REPOSITORY_MAPPINGS: JSON.stringify(
            props.imageRepositoryMappings.map((mapping) => ({
              publicImageUri: mapping.publicImageUri,
              imageTag: mapping.imageTag,
              repositoryUri: mapping.repository.repositoryUri,
              repositoryName: mapping.privateRepositoryName,
            })),
          ),
        },
      },
      phases: {
        pre_build: {
          commands: [
            'echo Installing jq for JSON processing...',
            'apt-get update -y && apt-get install -y jq',
            'echo Logging in to Amazon ECR...',
            'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com || { echo "ERROR: Failed to authenticate with Amazon ECR"; exit 1; }',
            'echo Logging in to Amazon ECR Public...',
            'aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws || { echo "ERROR: Failed to authenticate with Amazon ECR Public"; exit 1; }',
            'echo Logging in to Amazon ECR sources...',
            ...ecrLoginCommands,
            'echo "Image repository mappings: $IMAGE_REPOSITORY_MAPPINGS"',
            'echo "Authentication successful - proceeding with image download"',
          ],
        },
        build: {
          commands: [
            // Copy the script from secondary source to build environment and execute it
            'cp $CODEBUILD_SRC_DIR_scripts/process-ecr-images.sh /tmp/process-ecr-images.sh',
            'chmod +x /tmp/process-ecr-images.sh',
            '/tmp/process-ecr-images.sh',
          ],
        },
        post_build: {
          commands: [
            'echo Image download and push process completed',
            'docker system prune -f',
            // This will only run if build phase succeeded (exit code 0)
            'echo "All ECR images downloaded and pushed successfully"',
          ],
        },
      },
    });

    // Create asset for the ECR image processing script
    const scriptAsset = new Asset(this, 'ProcessEcrImagesScript', {
      path: path.join(__dirname, 'scripts'),
    });

    // Create CodeBuild project
    this.codeBuildProject = new Project(this, 'Project', {
      projectName: projectNamePrefixNamespaced,
      description: 'Downloads Docker images from public ECR gallery and pushes them to private ECR repository',
      role: this.codeBuildRole,
      environment: {
        buildImage: LinuxBuildImage.STANDARD_7_0,
        computeType: props.computeType ?? ComputeType.SMALL,
        privileged: true, // Required for Docker operations
        environmentVariables: {
          IMAGE_REPOSITORY_MAPPINGS: {
            value: JSON.stringify(
              props.imageRepositoryMappings.map((mapping) => ({
                publicImageUri: mapping.publicImageUri,
                imageTag: mapping.imageTag,
                repositoryUri: mapping.repository.repositoryUri,
                repositoryName: mapping.privateRepositoryName,
              })),
            ),
          },
        },
      },
      buildSpec,
      timeout: props.timeout ?? Duration.hours(1),
      secondarySources: [
        Source.s3({
          bucket: scriptAsset.bucket,
          path: scriptAsset.s3ObjectKey,
          identifier: 'scripts',
        }),
      ],
      logging: {
        cloudWatch: {
          logGroup,
        },
      },
    } as ProjectProps);

    // Grant ECR permissions to all target repositories
    props.imageRepositoryMappings.forEach((mapping) => {
      mapping.repository.grantPullPush(this.codeBuildRole);
    });

    // Grant access to the script asset
    scriptAsset.grantRead(this.codeBuildRole);

    // Create Lambda function to trigger CodeBuild
    this.triggerFunction = new NodeLambdaFunction(this, 'TriggerFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/ecr/handlers/triggerImageDownload.ts'),
      functionName: `${projectNamePrefix}-TriggerFunction`,
      logGroupCategory: LogGroupCategory.ECR_IMAGES,
      namespace: props.namespace,
      handler: 'onEventHandler', // Use the specific onEvent handler
      environment: {
        CODEBUILD_PROJECT_NAME: this.codeBuildProject.projectName,
      },
      timeout: Duration.seconds(900), // 15 minutes (AWS Lambda maximum)
    });
    addCfnGuardSuppression(this.triggerFunction, ['LAMBDA_INSIDE_VPC', 'LAMBDA_CONCURRENCY_CHECK']);

    // Create separate Lambda function for isComplete checks
    const isCompleteFunction = new NodeLambdaFunction(this, 'IsCompleteFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/ecr/handlers/triggerImageDownload.ts'),
      functionName: `${projectNamePrefix}-IsCompleteFunction`,
      logGroupCategory: LogGroupCategory.ECR_IMAGES,
      namespace: props.namespace,
      handler: 'isCompleteHandler', // Use the specific isComplete handler
      environment: {
        CODEBUILD_PROJECT_NAME: this.codeBuildProject.projectName,
      },
      timeout: Duration.seconds(60), // Shorter timeout for status checks
    });
    addCfnGuardSuppression(isCompleteFunction, ['LAMBDA_INSIDE_VPC', 'LAMBDA_CONCURRENCY_CHECK']);

    // Grant permissions to trigger CodeBuild
    this.triggerFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['codebuild:StartBuild', 'codebuild:BatchGetBuilds'],
        resources: [this.codeBuildProject.projectArn],
      }),
    );

    // Grant permissions to the isComplete function to check CodeBuild status
    isCompleteFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['codebuild:BatchGetBuilds'],
        resources: [this.codeBuildProject.projectArn],
      }),
    );

    // Create custom resource to auto-trigger on deployment (always enabled)
    // Create a custom resource provider using separate handler functions
    this.customResourceProvider = new Provider(this, 'AutoTriggerProvider', {
      onEventHandler: this.triggerFunction,
      isCompleteHandler: isCompleteFunction, // Use separate function for isComplete
      logGroup: LogGroupsHelper.getOrCreateLogGroup(scope, id, {
        functionName: `${projectNamePrefix}-AutoTriggerProvider`,
        logGroupCategory: LogGroupCategory.ECR_IMAGES,
        namespace: props.namespace,
        retention: RetentionDays.ONE_WEEK,
      }),
      // Now we can set totalTimeout since we have isCompleteHandler
      totalTimeout: Duration.minutes(60), // 1 hour total timeout for long-running builds
      queryInterval: Duration.seconds(30), // Check every 30 seconds
    });

    // Create the custom resource that will trigger the Lambda on deployment
    this.autoTriggerResource = new CustomResource(this, 'AutoTriggerResource', {
      serviceToken: this.customResourceProvider.serviceToken,
      properties: {
        // Add a timestamp to ensure the custom resource runs on every deployment
        TriggerTimestamp: Date.now().toString(),
        ImageRepositoryMappings: JSON.stringify(
          props.imageRepositoryMappings.map((mapping) => ({
            publicImageUri: mapping.publicImageUri,
            imageTag: mapping.imageTag,
            repositoryUri: mapping.repository.repositoryUri,
            repositoryName: mapping.privateRepositoryName,
          })),
        ),
        ProjectName: this.codeBuildProject.projectName,
      },
    });
    addCfnGuardSuppressionForAutoCreatedLambdas(this, 'AutoTriggerProvider');

    // Ensure the custom resource depends on the CodeBuild project
    this.autoTriggerResource.node.addDependency(this.codeBuildProject);

    // Suppress CFN Guard rule for internal waiter state machine log group - created by CDK Provider construct
    // We need to find the log group in the Provider's child constructs
    const waiterStateMachine = this.customResourceProvider.node.findChild('waiter-state-machine');
    const waiterLogGroup = waiterStateMachine.node.tryFindChild('LogGroup');
    addCfnGuardSuppression(waiterLogGroup as IConstruct, ['CLOUDWATCH_LOG_GROUP_ENCRYPTED']);
  }
}
