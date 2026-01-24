// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Stack } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

import { NodeLambdaFunction } from './nodeLambdaFunction';
import { GlobalSettings } from '../storage/appConfig.js';

export function grantAppConfigAccess(
  scope: Construct,
  lambdaFunction: NodeLambdaFunction,
  globalSettings: GlobalSettings,
) {
  const stack = Stack.of(scope);
  lambdaFunction.addToRolePolicy(
    new PolicyStatement({
      actions: ['appconfig:GetLatestConfiguration', 'appconfig:StartConfigurationSession'],
      resources: [
        stack.formatArn({
          service: 'appconfig',
          resource: `application/${globalSettings.app.attrApplicationId}/environment/${globalSettings.environment.attrEnvironmentId}/configuration`,
          resourceName: globalSettings.configurationProfile.attrConfigurationProfileId,
        }),
      ],
    }),
  );
  lambdaFunction.addToRolePolicy(
    new PolicyStatement({
      actions: ['appconfig:CreateHostedConfigurationVersion', 'appconfig:StartDeployment'],
      resources: [
        stack.formatArn({
          service: 'appconfig',
          resource: 'application',
          resourceName: globalSettings.app.attrApplicationId,
        }),
        stack.formatArn({
          service: 'appconfig',
          resource: `application/${globalSettings.app.attrApplicationId}/configurationprofile`,
          resourceName: globalSettings.configurationProfile.attrConfigurationProfileId,
        }),
      ],
    }),
  );
  lambdaFunction.addToRolePolicy(
    new PolicyStatement({
      actions: ['appconfig:StartDeployment'],
      resources: [
        stack.formatArn({
          service: 'appconfig',
          resource: 'deploymentstrategy',
          resourceName: globalSettings.deploymentStrategy.attrId,
        }),
        stack.formatArn({
          service: 'appconfig',
          resource: `application/${globalSettings.app.attrApplicationId}/environment`,
          resourceName: globalSettings.environment.attrEnvironmentId,
        }),
      ],
    }),
  );
}
