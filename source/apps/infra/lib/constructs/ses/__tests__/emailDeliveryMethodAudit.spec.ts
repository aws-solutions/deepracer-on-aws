// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, it, expect } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { createNodeLambdaFunctionMock, createLogGroupsHelperMock } from '../../../constants/testMocks.js';
import { functionNamePrefix } from '../../common/nodeLambdaFunction.js';
import { EmailDeliveryMethodAudit } from '../emailDeliveryMethodAudit.js';

vi.mock('../../common/logGroupsHelper.js', () => createLogGroupsHelperMock());
vi.mock('../../common/nodeLambdaFunction.js', () => createNodeLambdaFunctionMock());

const createTestStack = (emailDeliveryMethod = 'COGNITO', sesVerifiedEmail = '') => {
  const app = new App();
  const stack = new Stack(app, 'TestStack');

  new EmailDeliveryMethodAudit(stack, 'EmailDeliveryMethodAudit', {
    namespace: TEST_NAMESPACE,
    emailDeliveryMethod,
    sesVerifiedEmail,
  });

  return Template.fromStack(stack);
};

describe('emaildeliverymethodaudit construct', () => {
  it('creates the lambda function with correct name', () => {
    const template = createTestStack();

    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-EmailDeliveryMethodAudit`,
        Handler: 'index.lambdaHandler',
        Runtime: 'nodejs22.x',
      }),
    ).not.toThrow();
  });

  it('creates custom resource with cognito delivery method', () => {
    const template = createTestStack('COGNITO');

    expect(() =>
      template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
        emailDeliveryMethod: 'COGNITO',
        sesVerifiedEmail: '',
      }),
    ).not.toThrow();
  });

  it('creates custom resource with ses delivery method and verified email', () => {
    const template = createTestStack('SES', 'admin@example.com');

    expect(() =>
      template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
        emailDeliveryMethod: 'SES',
        sesVerifiedEmail: 'admin@example.com',
      }),
    ).not.toThrow();
  });

  it('creates a provider for the custom resource', () => {
    const template = createTestStack();

    const lambdas = template.findResources('AWS::Lambda::Function');
    expect(Object.keys(lambdas).length).toBeGreaterThanOrEqual(1);
  });

  it('does not apply any conditions to resources', () => {
    const template = createTestStack();
    const allResources = template.toJSON().Resources;

    const constructResources = Object.entries(allResources).filter(([key]) =>
      key.startsWith('EmailDeliveryMethodAudit'),
    );

    for (const [, resource] of constructResources) {
      expect((resource as Record<string, unknown>).Condition).toBeUndefined();
    }
  });
});
