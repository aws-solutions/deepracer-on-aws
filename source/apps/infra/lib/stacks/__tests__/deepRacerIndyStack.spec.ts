// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, NestedStack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
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
        MODEL_OPTIMIZER_REPO_NAME: 'deepracer-on-aws-model-optimizer',
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

    it('creates exactly seven nested stacks', () => {
      // Ecr, ApiStack (core handlers), EventManagement, ModelManagement, RealTimeRoles, DeviceManagement, Gateway
      template.resourceCountIs('AWS::CloudFormation::Stack', 7);
      expect(template).toBeDefined();
    });

    it('has ECR nested stack resource', () => {
      const nestedStacks = template.findResources('AWS::CloudFormation::Stack');
      const stackNames = Object.keys(nestedStacks);

      expect(stackNames.some((name) => name.includes('Ecr'))).toBe(true);
    });
  });

  describe('framework contract (nested-stack-decomposition §7.1)', () => {
    it('has no dependency cycle among nested stacks', () => {
      const resources = template.toJSON().Resources as Record<string, { Type: string; DependsOn?: string | string[] }>;
      const nested = Object.entries(resources).filter(([, r]) => r.Type === 'AWS::CloudFormation::Stack');
      expect(nested.length).toBeGreaterThan(1);

      const edges = new Map<string, string[]>(
        nested.map(([id, r]) => {
          const deps = r.DependsOn === undefined ? [] : Array.isArray(r.DependsOn) ? r.DependsOn : [r.DependsOn];
          // Only edges between nested stacks matter for this check.
          return [id, deps.filter((d) => nested.some(([otherId]) => otherId === d))];
        }),
      );

      const visiting = new Set<string>();
      const done = new Set<string>();
      const hasCycle = (node: string): boolean => {
        if (visiting.has(node)) return true;
        if (done.has(node)) return false;
        visiting.add(node);
        for (const next of edges.get(node) ?? []) {
          if (hasCycle(next)) return true;
        }
        visiting.delete(node);
        done.add(node);
        return false;
      };

      for (const [id] of nested) {
        // A failure names the stack via the loop variable in the test output.
        expect({ stack: id, hasCycle: hasCycle(id) }).toEqual({ stack: id, hasCycle: false });
      }
    });

    it('routes epic log groups into LogInsights query definitions', () => {
      // Epic log groups are passed explicitly via EpicStack.logGroups so the root
      // observability wiring remains visible in the stack contract.
      const queries = template.findResources('AWS::Logs::QueryDefinition');
      expect(Object.keys(queries).length).toBeGreaterThan(0);
      const referencingEpic = Object.values(queries).filter((query) =>
        JSON.stringify(query).includes('EventManagement'),
      );
      expect(referencingEpic.length).toBeGreaterThan(0);
    });

    it('surfaces the epic composite alarm on the monitoring dashboard', () => {
      const dashboards = template.findResources('AWS::CloudWatch::Dashboard');
      const body = JSON.stringify(Object.values(dashboards).map((d) => d.Properties?.DashboardBody));
      expect(body).toContain('EventManagement');
    });

    it('creates the gateway nested stack', () => {
      const nested = template.findResources('AWS::CloudFormation::Stack');
      expect(Object.keys(nested).some((id) => /Gateway/.test(id))).toBe(true);
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

    it('creates SesIdentity parameter with correct default', () => {
      template.hasParameter('SesIdentity', {
        Type: 'String',
        Default: '',
      });
      expect(template).toBeDefined();
    });

    it('creates IsSesIdentityProvided condition in synthesized template', () => {
      const templateJson = template.toJSON();
      const conditions = templateJson.Conditions;
      expect(conditions.IsSesIdentityProvided).toBeDefined();
      expect(conditions.IsSesIdentityProvided).toEqual({
        'Fn::Not': [{ 'Fn::Equals': [{ Ref: 'SesIdentity' }, ''] }],
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
      // Training workflow, import workflow, live-race workflow, and the bulk-invite workflow.
      template.resourceCountIs('AWS::StepFunctions::StateMachine', 4);
      expect(template).toBeDefined();
    });

    it('creates the bulk-invite workflow Lambdas at the root stack', () => {
      // The iteration + finalize Lambdas (and their DeepRacerIndyBulkInvite metrics namespace) are
      // created by BulkInviteWorkflow at the root, alongside the state machine. The
      // trigger's env/grant live in the nested ApiStack and are covered by typecheck + api.spec.
      const functions = template.findResources('AWS::Lambda::Function');
      expect(JSON.stringify(functions)).toContain('DeepRacerIndyBulkInvite');
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

    it('grants the live-race broadcast handler write access to the website bucket for public leaderboard JSON', () => {
      // public/leaderboards/{id}.json is fetched by the frontend through the website's own
      // CloudFront distribution, so the write must land in that same bucket to be reachable —
      // not modelStorageBucket, which isn't behind CloudFront.
      interface CfnResource {
        Type: string;
        Properties?: {
          PolicyName?: string;
          PolicyDocument?: { Statement: { Action?: string | string[]; Resource: unknown }[] };
        };
      }
      const templateJson = template.toJSON() as { Resources: Record<string, CfnResource> };
      const policies = Object.values(templateJson.Resources).filter(
        (r) => r.Type === 'AWS::IAM::Policy' && r.Properties?.PolicyName?.includes('LiveBroadcastHandler'),
      );
      const leaderboardStatement = policies
        .flatMap((p) => p.Properties?.PolicyDocument?.Statement ?? [])
        .find((s) => (Array.isArray(s.Action) ? s.Action.includes('s3:PutObject') : s.Action === 's3:PutObject'));

      expect(leaderboardStatement).toBeDefined();
      const resourceRefs = JSON.stringify(leaderboardStatement?.Resource);
      // The referenced bucket's logical ID must come from the Website construct, not ModelStorageBucket.
      expect(resourceRefs).toMatch(/Website/);
      expect(resourceRefs).not.toMatch(/ModelStorageBucket/);
    });

    it('grants AddTrackToEvent write access to the website bucket for the public leaderboard placeholder', () => {
      // AddTrackToEvent pre-creates public/leaderboards/{leaderboardId}.json (and the combined
      // event-wide file for the event's first track) before any race exists, so the public
      // leaderboard page's very first load never 404s at the origin — see addTrackToEvent.ts /
      // publicLeaderboardS3.ts. Its function lives inside the nested EventManagement stack, so
      // the grant must be asserted against that nested stack's own template, not the root's.
      const eventManagementStack = stack.node.findChild('EventManagement') as NestedStack;
      const nestedTemplate = Template.fromStack(eventManagementStack);

      const nestedJson = nestedTemplate.toJSON() as {
        Resources: Record<
          string,
          {
            Type: string;
            Properties?: {
              PolicyName?: string;
              PolicyDocument?: { Statement: { Action?: string | string[]; Resource: unknown }[] };
            };
          }
        >;
      };
      const policies = Object.values(nestedJson.Resources).filter(
        (r) => r.Type === 'AWS::IAM::Policy' && r.Properties?.PolicyName?.includes('AddTrackToEvent'),
      );
      const leaderboardStatement = policies
        .flatMap((p) => p.Properties?.PolicyDocument?.Statement ?? [])
        .find((s) => (Array.isArray(s.Action) ? s.Action.includes('s3:PutObject') : s.Action === 's3:PutObject'));

      expect(leaderboardStatement).toBeDefined();
      const resourceRefs = JSON.stringify(leaderboardStatement?.Resource);
      // The bucket reference is passed in from the root stack as a cross-stack parameter, so it
      // shows up as a "referenceto...Website..." parameter, not a local resource — confirming
      // this resolves to the actual Website bucket and not some other bucket in this nested stack.
      expect(resourceRefs).toMatch(/Website/);
      // Scoped to the leaderboard placeholder prefix only — the grant must not extend to the rest
      // of the Website bucket (e.g. built assets, model artifacts served from the same bucket).
      expect(resourceRefs).toMatch(/public\/leaderboards\/\*/);
    });

    it('creates IAM roles', () => {
      const roles = template.findResources('AWS::IAM::Role');
      const roleCount = Object.keys(roles).length;

      // Should have multiple IAM roles for various services
      expect(roleCount).toBeGreaterThan(5);
    });

    it('passes CustomDomain-aware URL to email template sync handler', () => {
      template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
        websiteUrl: {
          'Fn::If': Match.arrayWith([Match.stringLikeRegexp('HasCustomDomain')]),
        },
      });
      expect(template).toBeDefined();
    });
  });
});
