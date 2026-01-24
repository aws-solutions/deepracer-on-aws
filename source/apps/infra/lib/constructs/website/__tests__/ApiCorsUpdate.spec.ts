// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Duration, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { functionNamePrefix } from '../../common/nodeLambdaFunction.js';
import { ApiCorsUpdate } from '../ApiCorsUpdate.js';

describe('ApiCorsUpdate', () => {
  const app = new App();
  const stack = new Stack(app, 'TestStack');

  new ApiCorsUpdate(stack, 'TestApiCorsUpdate', {
    apiId: 'test-api-id',
    allowedOrigin: 'https://example.com',
    namespace: TEST_NAMESPACE,
  });

  const template = Template.fromStack(stack);

  it('creates a Lambda function with correct configuration', () => {
    expect(() =>
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `${TEST_NAMESPACE}-${functionNamePrefix}-UpdateApiCors`,
        Handler: 'index.lambdaHandler',
        Runtime: 'nodejs22.x',
        Timeout: Duration.minutes(5).toSeconds(),
      }),
    ).not.toThrow();
  });

  it('grants correct API Gateway permissions to Lambda function', () => {
    expect(() =>
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['apigateway:GET', 'apigateway:PUT', 'apigateway:PATCH', 'apigateway:POST'],
              Effect: 'Allow',
              Resource: [
                'arn:aws:apigateway:*::/restapis/test-api-id',
                'arn:aws:apigateway:*::/restapis/test-api-id/*',
              ],
            }),
          ]),
        },
      }),
    ).not.toThrow();
  });

  it('creates a custom resource provider', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
        ServiceToken: Match.anyValue(),
      }),
    ).not.toThrow();
  });

  it('creates custom resource with correct properties', () => {
    expect(() =>
      template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
        ServiceToken: Match.anyValue(),
        apiId: 'test-api-id',
        allowedOrigin: 'https://example.com',
        forceUpdate: Match.anyValue(),
      }),
    ).not.toThrow();
  });
});
