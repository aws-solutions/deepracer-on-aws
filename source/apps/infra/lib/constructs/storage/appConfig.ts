// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Stack } from 'aws-cdk-lib';
import * as appconfig from 'aws-cdk-lib/aws-appconfig';
import { Construct } from 'constructs';

interface GlobalSettingsProps {
  namespace: string;
}

export class GlobalSettings extends Construct {
  readonly app: appconfig.CfnApplication;
  readonly environment: appconfig.CfnEnvironment;
  readonly configurationProfile: appconfig.CfnConfigurationProfile;
  readonly deploymentStrategy: appconfig.CfnDeploymentStrategy;
  readonly deployment: appconfig.CfnDeployment;
  readonly hostedConfigurationVersion: appconfig.CfnHostedConfigurationVersion;

  constructor(scope: Construct, id: string, { namespace }: GlobalSettingsProps) {
    super(scope, id);
    const stackName = Stack.of(this).stackName;
    this.app = new appconfig.CfnApplication(this, 'Application', {
      name: `${namespace}-${stackName}-app`,
      description: 'DeepRacer on AWS AppConfig application',
    });

    this.environment = new appconfig.CfnEnvironment(this, 'Environment', {
      name: `${namespace}-${stackName}-env`,
      applicationId: this.app.ref,
      description: 'DeepRacer on AWS AppConfig environment',
    });

    this.configurationProfile = new appconfig.CfnConfigurationProfile(this, 'ConfigurationProfile', {
      name: `${namespace}-${stackName}-config-prof`,
      applicationId: this.app.ref,
      locationUri: 'hosted',
      description: 'DeepRacer on AWS AppConfig configuration profile',
    });

    this.deploymentStrategy = new appconfig.CfnDeploymentStrategy(this, 'DeploymentStrategy', {
      name: `${namespace}-${stackName}-deployment`,
      deploymentDurationInMinutes: 0,
      finalBakeTimeInMinutes: 0,
      growthFactor: 100,
      growthType: appconfig.GrowthType.LINEAR,
      replicateTo: 'NONE',
      description: 'DeepRacer on AWS AppConfig deployment strategy',
    });

    this.hostedConfigurationVersion = new appconfig.CfnHostedConfigurationVersion(this, 'HostedConfigurationVersion', {
      applicationId: this.app.ref,
      configurationProfileId: this.configurationProfile.ref,
      contentType: 'application/json',
      content: JSON.stringify({
        usageQuotas: {
          // for all values, -1 means unlimited, 0 or greater means quota in place
          global: {
            globalComputeMinutesLimit: -1,
            globalModelCountLimit: -1,
          },
          newUser: {
            newUserComputeMinutesLimit: -1,
            newUserModelCountLimit: -1,
          },
        },
        registration: {
          type: 'invite-only', // 'invite-only' or 'self-service'
        },
      }),
      description: 'DeepRacer on AWS AppConfig hosted configuration version',
    });

    this.deployment = new appconfig.CfnDeployment(this, 'Deployment', {
      applicationId: this.app.ref,
      configurationProfileId: this.configurationProfile.ref,
      configurationVersion: this.hostedConfigurationVersion.ref,
      deploymentStrategyId: this.deploymentStrategy.ref,
      environmentId: this.environment.ref,
      description: 'DeepRacer on Aws AppConfig deployment',
    });
  }
}
