// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AppConfigClient,
  CreateHostedConfigurationVersionCommand,
  CreateHostedConfigurationVersionCommandOutput,
  StartDeploymentCommand,
  StartDeploymentCommandOutput,
} from '@aws-sdk/client-appconfig';
import {
  AppConfigDataClient,
  GetLatestConfigurationCommand,
  GetLatestConfigurationCommandOutput,
  StartConfigurationSessionCommand,
  StartConfigurationSessionCommandOutput,
} from '@aws-sdk/client-appconfigdata';
import { InternalFailureError } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { BlobPayloadInputTypes } from '@smithy/types';

type AppConfigServiceConfiguration = {
  applicationId: string;
  environmentId: string;
  configurationProfileId: string;
  deploymentStrategy: string;
  region: string;
};

export class AppConfigServiceHelper {
  private appConfigClient: AppConfigClient = new AppConfigClient({ region: process.env.AWS_REGION });
  private appConfigDataClient: AppConfigDataClient = new AppConfigDataClient({ region: process.env.AWS_REGION });

  /**
   * Sets up the service configuration object using environment variables.
   * @returns - An object containing the service configuration.
   */
  getServiceConfiguration(): AppConfigServiceConfiguration {
    // If an environment variable is undefined, it will default to an empty string
    const appConfigServiceConfiguration: AppConfigServiceConfiguration = {
      applicationId: process.env.AWS_APPCONFIG_APPLICATION_ID ?? '',
      environmentId: process.env.AWS_APPCONFIG_ENVIRONMENT_ID ?? '',
      configurationProfileId: process.env.AWS_APPCONFIG_CONFIGURATION_PROFILE_ID ?? '',
      deploymentStrategy: process.env.AWS_APPCONFIG_DEPLOYMENT_STRATEGY ?? '',
      region: process.env.AWS_REGION ?? '',
    };

    // Validate that all required environment variables are defined
    // If an environment variable is an empty string, it will throw an error
    for (const [key, value] of Object.entries(appConfigServiceConfiguration)) {
      if (value === '') {
        logger.error(`AppConfigServiceConfiguration: Environment variable "${key}" is undefined`);
        throw new InternalFailureError({
          message: 'One or more required environment variables is undefined',
        });
      }
    }

    return appConfigServiceConfiguration;
  }

  /**
   * Get the latest configuration from AWS AppConfig.
   * @returns - A promise that resolves to the latest configuration object.
   */
  async getConfiguration(): Promise<GetLatestConfigurationCommandOutput['Configuration']> {
    const serviceConfig = this.getServiceConfiguration();

    // Call StartConfigurationSessionCommand first to get the InitialConfigurationToken
    const configurationSessionReq = new StartConfigurationSessionCommand({
      ApplicationIdentifier: serviceConfig.applicationId,
      EnvironmentIdentifier: serviceConfig.environmentId,
      ConfigurationProfileIdentifier: serviceConfig.configurationProfileId,
    });

    let configurationSessionRes: StartConfigurationSessionCommandOutput;
    try {
      configurationSessionRes = await this.appConfigDataClient.send(configurationSessionReq);
    } catch (err) {
      logger.error('Error starting configuration session:' + err);
      throw new InternalFailureError({
        message: 'Error starting configuration session',
      });
    }

    // Make sure InitialConfigurationToken is defined
    if (!configurationSessionRes.InitialConfigurationToken) {
      logger.error('InitialConfigurationToken is undefined');
      throw new InternalFailureError({
        message: 'Error starting configuration session',
      });
    }

    // Then, call GetLatestConfigurationCommand
    const latestConfigurationReq = new GetLatestConfigurationCommand({
      ConfigurationToken: configurationSessionRes.InitialConfigurationToken,
    });

    let latestConfigurationRes: GetLatestConfigurationCommandOutput;
    try {
      latestConfigurationRes = await this.appConfigDataClient.send(latestConfigurationReq);
    } catch (err) {
      console.error('Error fetching latest configuration:', err);
      throw new InternalFailureError({
        message: 'Error fetching latest configuration',
      });
    }

    // Make sure Connfiguration is defined
    if (!latestConfigurationRes.Configuration) {
      logger.error('Configuration is undefined');
      throw new InternalFailureError({
        message: 'Error fetching latest configuration',
      });
    }

    // Return the configuration object
    return latestConfigurationRes.Configuration;
  }

  /**
   * Update a configuration in AWS AppConfig.
   * @param content - The content of the configuration to be updated.
   * @returns - A promise that resolves to the deployment response.
   */
  async updateConfiguration(content: BlobPayloadInputTypes): Promise<StartDeploymentCommandOutput> {
    const serviceConfig = this.getServiceConfiguration();

    // First, create a new hosted configuration version
    const versionCommand = new CreateHostedConfigurationVersionCommand({
      ApplicationId: serviceConfig.applicationId,
      ConfigurationProfileId: serviceConfig.configurationProfileId,
      Content: content,
      ContentType: 'application/json',
    });

    let versionResponse: CreateHostedConfigurationVersionCommandOutput;
    try {
      versionResponse = await this.appConfigClient.send(versionCommand);
    } catch (err) {
      logger.error('Error creating hosted configuration version:' + err);
      throw new InternalFailureError({
        message: 'Error creating hosted configuration version',
      });
    }

    if (!versionResponse.VersionNumber) {
      logger.error('VersionNumber is undefined');
      throw new InternalFailureError({
        message: 'Error creating hosted configuration version',
      });
    }

    // Then, deploy the new configuration version
    const deploymentCommand = new StartDeploymentCommand({
      ApplicationId: serviceConfig.applicationId,
      EnvironmentId: serviceConfig.environmentId,
      ConfigurationProfileId: serviceConfig.configurationProfileId,
      DeploymentStrategyId: serviceConfig.deploymentStrategy,
      ConfigurationVersion: versionResponse.VersionNumber.toString(),
    });

    let deploymentResponse;
    try {
      deploymentResponse = await this.appConfigClient.send(deploymentCommand);
    } catch (err) {
      logger.error('Error starting deployment:' + err);
      throw new InternalFailureError({
        message: 'Error starting deployment',
      });
    }

    return deploymentResponse;
  }
}

export const appConfigServiceHelper = new AppConfigServiceHelper();
