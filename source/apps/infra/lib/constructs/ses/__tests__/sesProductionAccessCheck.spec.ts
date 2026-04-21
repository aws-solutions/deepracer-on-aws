// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, CfnCondition, Fn, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it, expect } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { createNodeLambdaFunctionMock, createLogGroupsHelperMock } from '../../../constants/testMocks.js';
import { functionNamePrefix } from '../../common/nodeLambdaFunction.js';
import { SesProductionAccessCheck } from '../sesProductionAccessCheck.js';

vi.mock('../../common/logGroupsHelper.js', () => createLogGroupsHelperMock());
vi.mock('../../common/nodeLambdaFunction.js', () => createNodeLambdaFunctionMock());

const createTestStack = (emailDeliveryMethod = 'SES', sesVerifiedEmail = 'test@example.com') => {
  const app = new App();
  const stack = new Stack(app, 'TestStack');

  new SesProductionAccessCheck(stack, 'SesProductionAccessCheck', {
    namespace: TEST_NAMESPACE,
    emailDeliveryMethod,
    sesVerifiedEmail,
  });

  return Template.fromStack(stack);
};

describe('sesproductionaccesscheck construct', () => {
  it('creates the lambda function with correct name', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-SesProductionAccessCheck`,
        Handler: 'index.lambdaHandler',
        Runtime: 'nodejs22.x',
      }),
    ).not.toThrow();
  });

  it('grants ses getaccount permission to the lambda function', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties(
        'AWS::IAM::Policy',
        Match.objectLike({
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: 'ses:GetAccount',
                Effect: 'Allow',
                Resource: '*',
              }),
            ]),
          },
        }),
      ),
    ).not.toThrow();
  });

  it('creates a custom resource with emaildeliverymethod property', () => {
    const template = createTestStack('SES');

    expect(() =>
      template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
        ServiceToken: Match.anyValue(),
        emailDeliveryMethod: 'SES',
        forceUpdate: Match.anyValue(),
      }),
    ).not.toThrow();
  });

  it('passes cognito as emaildeliverymethod when cognito is selected', () => {
    const template = createTestStack('COGNITO');

    expect(() =>
      template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
        emailDeliveryMethod: 'COGNITO',
      }),
    ).not.toThrow();
  });

  it('creates a provider for the custom resource', () => {
    const template = createTestStack();

    const lambdas = template.findResources('AWS::Lambda::Function');
    const lambdaKeys = Object.keys(lambdas);
    expect(lambdaKeys.length).toBeGreaterThanOrEqual(1);
  });

  it('does not apply any conditions to resources', () => {
    const template = createTestStack();
    const allResources = template.toJSON().Resources;

    const constructResources = Object.entries(allResources).filter(([key]) =>
      key.startsWith('SesProductionAccessCheck'),
    );

    for (const [, resource] of constructResources) {
      expect((resource as Record<string, unknown>).Condition).toBeUndefined();
    }
  });

  it('applies the isSesEnabled condition to all construct resources', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    const isSesEnabled = new CfnCondition(stack, 'IsSesEnabled', {
      expression: Fn.conditionEquals('SES', 'SES'),
    });

    new SesProductionAccessCheck(stack, 'SesProductionAccessCheck', {
      namespace: TEST_NAMESPACE,
      emailDeliveryMethod: 'SES',
      sesVerifiedEmail: 'test@example.com',
      isSesEnabled,
    });

    const template = Template.fromStack(stack);
    const allResources = template.toJSON().Resources;

    const constructResources = Object.entries(allResources).filter(([key]) =>
      key.startsWith('SesProductionAccessCheck'),
    );

    expect(constructResources.length).toBeGreaterThan(0);
    for (const [, resource] of constructResources) {
      expect((resource as Record<string, unknown>).Condition).toBeDefined();
    }
  });
});
