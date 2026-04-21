// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Source } from 'aws-cdk-lib/aws-s3-deployment';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

import { DeepRacerIndyStack } from '../deepRacerIndyStack.js';
import { SolutionStackProps } from '../solutionStackProps.js';

// Mock NodeLambdaFunction to use inline code instead of esbuild bundling.
// Note: uses dynamic import because the static import of createNodeLambdaFunctionMock
// triggers transitive module loading that conflicts with vi.mock hoisting at the stack level.
vi.mock('../../constructs/common/nodeLambdaFunction.js', async () => {
  const { createNodeLambdaFunctionMock } = await import('../../constants/testMocks.js');
  return createNodeLambdaFunctionMock();
});

// Mock the LogGroupsHelper to avoid having the static log groups shared between stacks
vi.mock('../../constructs/common/logGroupsHelper.js', async () => {
  const { createLogGroupsHelperMock } = await import('../../constants/testMocks.js');
  return createLogGroupsHelperMock();
});

describe('DeepRacerIndyStack', () => {
  let originalAsset: typeof Source.asset;
  let app: App;
  let props: SolutionStackProps;
  let stack: DeepRacerIndyStack;
  let template: Template;

  beforeAll(() => {
    // Mock Source.asset first
    originalAsset = Source.asset;
    Source.asset = vi.fn().mockImplementation((path: string) => ({
      bind: vi.fn().mockReturnValue({
        bucket: {
          bucketName: 'mock-bucket',
          bucketArn: 'arn:aws:s3:::mock-bucket',
        },
        zipObjectKey: 'mock-key',
      }),
    })) as typeof Source.asset;

    // Now create the stack with mocking in place
    app = new App({
      context: {
        PUBLIC_ECR_REGISTRY: 'public.ecr.aws/aws-solutions',
        MODEL_VALIDATION_REPO_NAME: 'deepracer-on-aws-model-validation',
        REWARD_VALIDATION_REPO_NAME: 'deepracer-on-aws-reward-function-validation',
        SIMAPP_REPO_NAME: 'deepracer-on-aws-simapp',
      },
    });
    props = {
      solutionId: 'SO0144',
      solutionVersion: 'v1.0.0',
    };

    stack = new DeepRacerIndyStack(app, 'TestStack', props);
    template = Template.fromStack(stack);
  });

  afterAll(() => {
    // Restore the original Source.asset implementation
    Source.asset = originalAsset;
  });

  describe('EcrStack Nested Stack', () => {
    it('creates ECR nested stack', () => {
      // Just verify the nested stack exists with a TemplateURL
      const nestedStacks = template.findResources('AWS::CloudFormation::Stack');
      const stackResource = Object.values(nestedStacks)[0] as { Properties: { TemplateURL: { 'Fn::Join': unknown } } };

      expect(stackResource.Properties.TemplateURL).toBeDefined();
      expect(stackResource.Properties.TemplateURL['Fn::Join']).toBeDefined();
    });

    it('creates exactly two nested stacks', () => {
      template.resourceCountIs('AWS::CloudFormation::Stack', 2);
      expect(template).toBeDefined();
    });

    it('has ECR nested stack resource', () => {
      const nestedStacks = template.findResources('AWS::CloudFormation::Stack');
      const stackNames = Object.keys(nestedStacks);

      expect(stackNames.some((name) => name.includes('Ecr'))).toBe(true);
    });
  });

  describe('Stack Integration', () => {
    it('creates admin email parameter', () => {
      template.hasParameter('AdminEmail', {
        Type: 'String',
        AllowedPattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      });
      expect(template).toBeDefined();
    });

    it('creates EmailDeliveryMethod parameter with correct configuration', () => {
      template.hasParameter('EmailDeliveryMethod', {
        Type: 'String',
        Default: 'COGNITO',
        AllowedValues: ['COGNITO', 'SES'],
      });
      expect(template).toBeDefined();
    });

    it('creates SesVerifiedEmail parameter with correct default', () => {
      template.hasParameter('SesVerifiedEmail', {
        Type: 'String',
        Default: '',
      });
      expect(template).toBeDefined();
    });

    it('creates SesRequiresVerifiedEmail CfnRule in synthesized template', () => {
      const templateJson = template.toJSON();
      const rules = templateJson.Rules;
      expect(rules).toBeDefined();
      expect(rules.SesRequiresVerifiedEmail).toBeDefined();
      const rule = rules.SesRequiresVerifiedEmail;
      expect(rule.Assertions).toBeDefined();
      expect(rule.Assertions).toHaveLength(1);
      expect(rule.Assertions[0].AssertDescription).toBe(
        'SesVerifiedEmail must not be empty when EmailDeliveryMethod is SES.',
      );
    });

    it('creates IsSesEnabled condition in synthesized template', () => {
      const templateJson = template.toJSON();
      const conditions = templateJson.Conditions;
      expect(conditions).toBeDefined();
      expect(conditions.IsSesEnabled).toBeDefined();
      expect(conditions.IsSesEnabled).toEqual({
        'Fn::Equals': [{ Ref: 'EmailDeliveryMethod' }, 'SES'],
      });
    });

    it('creates multiple S3 buckets', () => {
      // The stack creates more buckets than just the 3 main ones due to CDK assets
      const bucketCount = template.findResources('AWS::S3::Bucket');
      expect(Object.keys(bucketCount).length).toBeGreaterThanOrEqual(3);
    });

    it('creates VPC resources', () => {
      template.hasResourceProperties('AWS::EC2::VPC', {
        EnableDnsHostnames: true,
        EnableDnsSupport: true,
      });
      expect(template).toBeDefined();
    });

    it('creates Cognito user pool', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AutoVerifiedAttributes: ['email'],
      });
      expect(template).toBeDefined();
    });

    it('creates Step Functions state machines', () => {
      template.resourceCountIs('AWS::StepFunctions::StateMachine', 1);
      expect(template).toBeDefined();
    });

    it('creates CloudFront distribution', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Enabled: true,
        },
      });
      expect(template).toBeDefined();
    });

    it('creates Lambda functions for API handlers', () => {
      const functions = template.findResources('AWS::Lambda::Function');
      const functionCount = Object.keys(functions).length;

      // Should have multiple Lambda functions for API handlers
      expect(functionCount).toBeGreaterThan(10);
    });

    it('creates IAM roles', () => {
      const roles = template.findResources('AWS::IAM::Role');
      const roleCount = Object.keys(roles).length;

      // Should have multiple IAM roles for various services
      expect(roleCount).toBeGreaterThan(5);
    });
  });
});
