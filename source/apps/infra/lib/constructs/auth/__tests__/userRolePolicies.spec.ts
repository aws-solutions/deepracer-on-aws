// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ApiDefinition, SpecRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { describe, it, expect } from 'vitest';

import { UserRoles } from '../userIdentity';
import { UserRolePolicies } from '../userRolePolicies';

describe('UserRolePolicies', () => {
  it('should match snapshot', () => {
    const stack = new Stack(undefined, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });

    const api = new SpecRestApi(stack, 'TestApi', {
      apiDefinition: ApiDefinition.fromInline({
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }),
    });

    const adminRole = new Role(stack, 'AdminRole', {
      assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
    });

    const raceFacilitatorRole = new Role(stack, 'RaceFacilitatorRole', {
      assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
    });

    const racerRole = new Role(stack, 'RacerRole', {
      assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
    });

    const userRoles: UserRoles = {
      adminRole,
      raceFacilitatorRole,
      racerRole,
    };

    new UserRolePolicies(stack, 'TestUserRolePolicies', {
      api,
      userRoles,
      uploadBucketArn: 'arn:aws:s3:::test-bucket',
    });

    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
