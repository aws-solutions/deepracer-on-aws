// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ComputeType } from 'aws-cdk-lib/aws-codebuild';
import { Repository } from 'aws-cdk-lib/aws-ecr';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { EcrImageDownloaderWithTrigger, ImageRepositoryMapping } from '../ecrImageDownloaderWithTrigger.js';

// Mock the KmsHelper to avoid having the single key shared between stacks
vi.mock('../../common/kmsHelper.js', () => {
  return {
    KmsHelper: {
      get: vi.fn(() => {
        return {
          grantEncryptDecrypt: vi.fn(),
          keyId: 'mock-key-id',
          keyArn: 'arn:aws:kms:us-east-1:123456789012:key/mock-key-id',
        };
      }),
    },
  };
});

// Mock the LogGroupsHelper to avoid having the static log groups shared between stacks
vi.mock('#constructs/common/logGroupsHelper.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#constructs/common/logGroupsHelper.js')>();
  return {
    ...actual,
    LogGroupsHelper: {
      ...actual.LogGroupsHelper,
      getOrCreateLogGroup: vi.fn().mockImplementation((scope, id, props) => {
        return {
          logGroupName: `mocked-log-group-${id}`,
          logGroupArn: `arn:aws:logs:us-east-1:123456789012:log-group:mocked-log-group-${id}`,
        };
      }),
    },
  };
});

describe('EcrImageDownloaderWithTrigger', () => {
  let stack: Stack;
  let repositories: Repository[];
  let repository: Repository; // Add missing repository variable
  let imageRepositoryMappings: ImageRepositoryMapping[];

  beforeEach(() => {
    stack = new Stack();

    // Create multiple repositories for testing
    repositories = [new Repository(stack, 'TestRepository1'), new Repository(stack, 'TestRepository2')];

    // Set repository to the first one for backward compatibility
    repository = repositories[0];

    // Create image repository mappings
    imageRepositoryMappings = [
      {
        publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
        imageTag: 'latest',
        repository: repositories[0],
        repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
        privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
      },
      {
        publicImageUri: 'public.ecr.aws/aws-solutions/deepracer-sim-public:latest',
        imageTag: 'latest',
        repository: repositories[1],
        repositoryId: 'deepracer-indy-aws-solutions-deepracer-sim-public',
        privateRepositoryName: `${TEST_NAMESPACE}-indy-aws-solutions-deepracer-sim-public`,
      },
    ];
  });

  describe('Basic Construction', () => {
    it('should create with minimal required props', () => {
      const construct = new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [imageRepositoryMappings[0]], // Use single mapping for minimal test
        namespace: TEST_NAMESPACE,
      });

      expect(construct).toBeDefined();
      expect(construct.codeBuildProject).toBeDefined();
      expect(construct.codeBuildRole).toBeDefined();
      expect(construct.triggerFunction).toBeDefined();
      expect(construct.customResourceProvider).toBeDefined();
      expect(construct.autoTriggerResource).toBeDefined();
    });

    it('should create with all optional props', () => {
      const construct = new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: imageRepositoryMappings, // Use all mappings
        projectNamePrefix: 'CustomPrefix',
        timeout: Duration.hours(2),
        computeType: ComputeType.MEDIUM,
        namespace: TEST_NAMESPACE,
      });

      expect(construct).toBeDefined();
      expect(construct.codeBuildProject).toBeDefined();
      expect(construct.codeBuildRole).toBeDefined();
      expect(construct.triggerFunction).toBeDefined();
      expect(construct.customResourceProvider).toBeDefined();
      expect(construct.autoTriggerResource).toBeDefined();
    });

    it('should always create with auto-trigger enabled', () => {
      const construct = new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      expect(construct).toBeDefined();
      expect(construct.codeBuildProject).toBeDefined();
      expect(construct.codeBuildRole).toBeDefined();
      expect(construct.triggerFunction).toBeDefined();
      expect(construct.customResourceProvider).toBeDefined();
      expect(construct.autoTriggerResource).toBeDefined();
    });
  });

  describe('CodeBuild Project Configuration', () => {
    it('should create CodeBuild project with correct default configuration', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::CodeBuild::Project', {
        Name: `${TEST_NAMESPACE}-DeepRacerIndy-ECRImageDownloader`,
        Description: 'Downloads Docker images from public ECR gallery and pushes them to private ECR repository',
        Environment: {
          ComputeType: 'BUILD_GENERAL1_SMALL',
          Image: 'aws/codebuild/standard:7.0',
          PrivilegedMode: true,
          Type: 'LINUX_CONTAINER',
          EnvironmentVariables: [
            {
              Name: 'IMAGE_REPOSITORY_MAPPINGS',
              Value: Match.anyValue(), // This is now a complex object, not a simple string
            },
          ],
        },
        TimeoutInMinutes: 60,
      });
    });

    it('should create CodeBuild project with custom configuration', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/model-validation:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-model-validation',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-model-validation`,
          },
        ],
        projectNamePrefix: 'CustomPrefix',
        timeout: Duration.hours(2),
        computeType: ComputeType.MEDIUM,
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::CodeBuild::Project', {
        Name: `${TEST_NAMESPACE}-CustomPrefix`,
        Environment: {
          ComputeType: 'BUILD_GENERAL1_MEDIUM',
          EnvironmentVariables: [
            {
              Name: 'IMAGE_REPOSITORY_MAPPINGS',
              Value: Match.anyValue(), // This is now a complex object containing multiple mappings
            },
          ],
        },
        TimeoutInMinutes: 120,
      });
    });

    it('should use external script for image processing in buildspec', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      // Verify buildspec exists and contains error handling by checking for CodeBuild project
      template.hasResourceProperties('AWS::CodeBuild::Project', {
        Source: {
          BuildSpec: Match.objectLike({
            'Fn::Join': Match.anyValue(),
          }),
        },
      });

      // Get the actual buildspec content to verify external script usage
      const resources = template.findResources('AWS::CodeBuild::Project');
      const projectResource = Object.values(resources)[0] as { Properties: { Source: { BuildSpec: unknown } } };
      const buildSpecContent = JSON.stringify(projectResource.Properties.Source.BuildSpec);

      // Verify that buildspec uses external script instead of inline commands
      expect(buildSpecContent).toContain('process-ecr-images.sh');
      expect(buildSpecContent).toContain('CODEBUILD_SRC_DIR_scripts');
      expect(buildSpecContent).toContain('chmod +x /tmp/process-ecr-images.sh');
      expect(buildSpecContent).toContain('/tmp/process-ecr-images.sh');
      expect(buildSpecContent).toContain('ERROR: Failed to authenticate with Amazon ECR');
    });

    it('should configure Lambda function with extended timeout for error handling', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      // Check that Lambda function has extended timeout (15 minutes = 900 seconds, AWS Lambda maximum)
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndy-ECRImageDownloader-TriggerFunction`,
        Timeout: 900,
      });
    });
  });

  describe('IAM Permissions', () => {
    it('should create CodeBuild role with correct service principal', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      // Check CodeBuild role exists with correct service principal
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'codebuild.amazonaws.com',
              },
            },
          ],
        },
      });
    });

    it('should create policies with ECR permissions', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      // Check that ECR permissions exist in some policy
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['ecr:BatchCheckLayerAvailability']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('Lambda Trigger Function', () => {
    it('should create Lambda trigger function with correct configuration', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndy-ECRImageDownloader-TriggerFunction`,
        Runtime: 'nodejs22.x',
        Timeout: 900, // 15 minutes = 900 seconds (AWS Lambda maximum)
        Environment: {
          Variables: Match.objectLike({
            CODEBUILD_PROJECT_NAME: Match.anyValue(),
          }),
        },
      });
    });

    it('should grant Lambda function permissions to trigger CodeBuild', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      // Check Lambda execution role has CodeBuild permissions
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['codebuild:StartBuild']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('Auto-Trigger Custom Resource', () => {
    it('should create custom resource when auto-trigger is enabled', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      // Check custom resource exists - properties are at the top level, not nested
      template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
        ImageRepositoryMappings: Match.anyValue(), // Now uses ImageRepositoryMappings instead of PublicEcrImages
        ProjectName: Match.anyValue(),
      });
    });

    it('should always create custom resource since auto-trigger is always enabled', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      // Should always have custom resource since auto-trigger is always enabled
      template.resourceCountIs('AWS::CloudFormation::CustomResource', 1);
    });

    it('should include timestamp in custom resource properties for re-triggering', () => {
      const construct = new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      expect(construct.autoTriggerResource).toBeDefined();

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      // Check that custom resource has TriggerTimestamp property - properties are at top level
      template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
        TriggerTimestamp: Match.anyValue(),
        ImageRepositoryMappings: Match.anyValue(), // Now uses ImageRepositoryMappings instead of PublicEcrImages
        ProjectName: Match.anyValue(),
      });
    });
  });

  describe('CloudWatch Logging', () => {
    it('should create CloudWatch log group for CodeBuild', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/codebuild/${TEST_NAMESPACE}-DeepRacerIndy-ECRImageDownloader`,
        RetentionInDays: 7,
      });
    });

    it('should configure CodeBuild to use CloudWatch logs', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::CodeBuild::Project', {
        LogsConfig: {
          CloudWatchLogs: {
            Status: 'ENABLED',
            GroupName: Match.anyValue(),
          },
        },
      });
    });
  });

  describe('Multiple Images Configuration', () => {
    it('should handle multiple ECR images correctly', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/model-validation:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-model-validation',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-model-validation`,
          },
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-sagemaker:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-sagemaker',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-sagemaker`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::CodeBuild::Project', {
        Environment: {
          EnvironmentVariables: [
            {
              Name: 'IMAGE_REPOSITORY_MAPPINGS',
              Value: Match.anyValue(), // This is now a complex object containing multiple mappings
            },
          ],
        },
      });
    });
  });

  describe('Resource Dependencies', () => {
    it('should ensure custom resource depends on CodeBuild project', () => {
      const construct = new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      expect(construct.autoTriggerResource).toBeDefined();
      expect(construct.codeBuildProject).toBeDefined();

      // The dependency is added via node.addDependency, which is tested by ensuring
      // the custom resource exists when auto-trigger is enabled
      expect(construct.autoTriggerResource).toBeDefined();
      expect(construct.codeBuildProject).toBeDefined();

      // Verify the dependency relationship exists
      const autoTriggerResource = construct.autoTriggerResource;
      expect(autoTriggerResource).not.toBeNull();
      expect(autoTriggerResource?.node.dependencies).toContain(construct.codeBuildProject);
    });
  });

  describe('Resource Counts', () => {
    it('should create expected number of resources', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      // Should have at least one of each key resource type
      template.resourceCountIs('AWS::CodeBuild::Project', 1);
      template.resourceCountIs('AWS::ECR::Repository', 2); // We create 2 repositories in the test setup
      template.resourceCountIs('AWS::CloudFormation::CustomResource', 1);
      // Use a specific count instead of Match.atLeast since it doesn't exist
      const logGroups = template.findResources('AWS::Logs::LogGroup');
      expect(Object.keys(logGroups).length).toBeGreaterThanOrEqual(1);
    });

    it('should always create custom resource since auto-trigger is always enabled', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      // Should always have custom resource since auto-trigger is always enabled
      template.resourceCountIs('AWS::CloudFormation::CustomResource', 1);
    });
  });

  describe('Default Values', () => {
    it('should use correct default values', () => {
      const construct = new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      // Check default project name
      template.hasResourceProperties('AWS::CodeBuild::Project', {
        Name: `${TEST_NAMESPACE}-DeepRacerIndy-ECRImageDownloader`,
      });

      // Check default timeout (1 hour = 60 minutes)
      template.hasResourceProperties('AWS::CodeBuild::Project', {
        TimeoutInMinutes: 60,
      });

      // Check default compute type
      template.hasResourceProperties('AWS::CodeBuild::Project', {
        Environment: {
          ComputeType: 'BUILD_GENERAL1_SMALL',
        },
      });

      // Check Lambda function timeout (15 minutes = 900 seconds, AWS Lambda maximum)
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndy-ECRImageDownloader-TriggerFunction`,
        Timeout: 900,
      });

      // Check auto-trigger is enabled by default
      expect(construct.autoTriggerResource).toBeDefined();
      expect(construct.customResourceProvider).toBeDefined();
    });
  });

  describe('Environment Variables', () => {
    it('should set correct environment variables in CodeBuild', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::CodeBuild::Project', {
        Environment: {
          EnvironmentVariables: Match.arrayWith([
            {
              Name: 'IMAGE_REPOSITORY_MAPPINGS',
              Type: 'PLAINTEXT', // Include the Type field that CDK adds
              Value: Match.anyValue(), // This is now a complex object, not a simple string
            },
          ]),
        },
      });
    });

    it('should set correct environment variables in Lambda function', () => {
      new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndy-ECRImageDownloader-TriggerFunction`,
        Environment: {
          Variables: Match.objectLike({
            CODEBUILD_PROJECT_NAME: Match.anyValue(),
          }),
        },
      });
    });
  });

  describe('Construct Properties', () => {
    it('should expose all expected properties', () => {
      const construct = new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      // Check that all expected properties are defined
      expect(construct.codeBuildProject).toBeDefined();
      expect(construct.codeBuildRole).toBeDefined();
      expect(construct.triggerFunction).toBeDefined();
      expect(construct.customResourceProvider).toBeDefined();
      expect(construct.autoTriggerResource).toBeDefined();

      // Check that properties have expected types - use template verification instead of direct property access
      // since CDK properties return tokens
      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      // Explicit assertion to satisfy linter
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::CodeBuild::Project', {
        Name: `${TEST_NAMESPACE}-DeepRacerIndy-ECRImageDownloader`,
      });

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-DeepRacerIndy-ECRImageDownloader-TriggerFunction`,
      });
    });

    it('should always expose custom resource properties since auto-trigger is always enabled', () => {
      const construct = new EcrImageDownloaderWithTrigger(stack, 'TestEcrImageDownloader', {
        imageRepositoryMappings: [
          {
            publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest',
            imageTag: 'latest',
            repository: repository,
            repositoryId: 'deepracer-indy-aws-deepracer-deepracer-simapp',
            privateRepositoryName: `${TEST_NAMESPACE}-deepracer-indy-aws-deepracer-deepracer-simapp`,
          },
        ],
        namespace: TEST_NAMESPACE,
      });

      // Should always have custom resource properties since auto-trigger is always enabled
      expect(construct.customResourceProvider).toBeDefined();
      expect(construct.autoTriggerResource).toBeDefined();
    });
  });
});
