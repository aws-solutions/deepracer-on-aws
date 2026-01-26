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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AppConfigServiceHelper } from '../AppConfigServiceHelper';

vi.mock('@aws-sdk/client-appconfig', () => {
  return {
    AppConfigClient: vi.fn(() => ({
      send: vi.fn(),
    })),
    CreateHostedConfigurationVersionCommand: vi.fn(),
    StartDeploymentCommand: vi.fn(),
  };
});

vi.mock('@aws-sdk/client-appconfigdata', () => {
  return {
    AppConfigDataClient: vi.fn(() => ({
      send: vi.fn(),
    })),
    GetLatestConfigurationCommand: vi.fn(),
    StartConfigurationSessionCommand: vi.fn(),
  };
});

vi.mock('@deepracer-indy/utils', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AppConfigServiceHelper', () => {
  let appConfigServiceHelper: AppConfigServiceHelper;
  let mockAppConfigClient: { send: ReturnType<typeof vi.fn> };
  let mockAppConfigDataClient: { send: ReturnType<typeof vi.fn> };
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };

    process.env.AWS_APPCONFIG_APPLICATION_ID = 'test-app-id';
    process.env.AWS_APPCONFIG_ENVIRONMENT_ID = 'test-env-id';
    process.env.AWS_APPCONFIG_CONFIGURATION_PROFILE_ID = 'test-profile-id';
    process.env.AWS_APPCONFIG_DEPLOYMENT_STRATEGY = 'test-strategy';
    process.env.AWS_REGION = 'us-east-1';

    appConfigServiceHelper = new AppConfigServiceHelper();

    mockAppConfigClient = (AppConfigClient as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    mockAppConfigDataClient = (AppConfigDataClient as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;

    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getServiceConfiguration', () => {
    it('should return the service configuration when all environment variables are set', () => {
      const config = appConfigServiceHelper.getServiceConfiguration();

      expect(config).toEqual({
        applicationId: 'test-app-id',
        environmentId: 'test-env-id',
        configurationProfileId: 'test-profile-id',
        deploymentStrategy: 'test-strategy',
        region: 'us-east-1',
      });
    });

    it('should throw an error when applicationId is not set', () => {
      process.env.AWS_APPCONFIG_APPLICATION_ID = '';

      expect(() => appConfigServiceHelper.getServiceConfiguration()).toThrow(InternalFailureError);
      expect(logger.error).toHaveBeenCalledWith(
        'AppConfigServiceConfiguration: Environment variable "applicationId" is undefined',
      );
    });

    it('should throw an error when environmentId is not set', () => {
      process.env.AWS_APPCONFIG_ENVIRONMENT_ID = '';

      expect(() => appConfigServiceHelper.getServiceConfiguration()).toThrow(InternalFailureError);
      expect(logger.error).toHaveBeenCalledWith(
        'AppConfigServiceConfiguration: Environment variable "environmentId" is undefined',
      );
    });

    it('should throw an error when configurationProfileId is not set', () => {
      process.env.AWS_APPCONFIG_CONFIGURATION_PROFILE_ID = '';

      expect(() => appConfigServiceHelper.getServiceConfiguration()).toThrow(InternalFailureError);
      expect(logger.error).toHaveBeenCalledWith(
        'AppConfigServiceConfiguration: Environment variable "configurationProfileId" is undefined',
      );
    });

    it('should throw an error when deploymentStrategy is not set', () => {
      process.env.AWS_APPCONFIG_DEPLOYMENT_STRATEGY = '';

      expect(() => appConfigServiceHelper.getServiceConfiguration()).toThrow(InternalFailureError);
      expect(logger.error).toHaveBeenCalledWith(
        'AppConfigServiceConfiguration: Environment variable "deploymentStrategy" is undefined',
      );
    });

    it('should throw an error when region is not set', () => {
      process.env.AWS_REGION = '';

      expect(() => appConfigServiceHelper.getServiceConfiguration()).toThrow(InternalFailureError);
      expect(logger.error).toHaveBeenCalledWith(
        'AppConfigServiceConfiguration: Environment variable "region" is undefined',
      );
    });
  });

  describe('getConfiguration', () => {
    it('should successfully get the configuration', async () => {
      const mockSessionResponse: Partial<StartConfigurationSessionCommandOutput> = {
        InitialConfigurationToken: 'test-token',
      };
      mockAppConfigDataClient.send.mockResolvedValueOnce(mockSessionResponse);

      const mockConfigResponse: Partial<GetLatestConfigurationCommandOutput> = {
        Configuration: {
          transformToString: () => JSON.stringify({ key: 'value' }),
        } as unknown as GetLatestConfigurationCommandOutput['Configuration'],
      };
      mockAppConfigDataClient.send.mockResolvedValueOnce(mockConfigResponse);

      const result = await appConfigServiceHelper.getConfiguration();

      expect(StartConfigurationSessionCommand).toHaveBeenCalledWith({
        ApplicationIdentifier: 'test-app-id',
        EnvironmentIdentifier: 'test-env-id',
        ConfigurationProfileIdentifier: 'test-profile-id',
      });

      expect(GetLatestConfigurationCommand).toHaveBeenCalledWith({
        ConfigurationToken: 'test-token',
      });

      expect(result).toEqual(mockConfigResponse.Configuration);
    });

    it('should throw an error when StartConfigurationSessionCommand fails', async () => {
      mockAppConfigDataClient.send.mockRejectedValueOnce(new Error('Session error'));

      await expect(appConfigServiceHelper.getConfiguration()).rejects.toThrow(InternalFailureError);
      expect(logger.error).toHaveBeenCalledWith('Error starting configuration session:Error: Session error');
    });

    it('should throw an error when InitialConfigurationToken is undefined', async () => {
      const mockSessionResponse: Partial<StartConfigurationSessionCommandOutput> = {};
      mockAppConfigDataClient.send.mockResolvedValueOnce(mockSessionResponse);

      await expect(appConfigServiceHelper.getConfiguration()).rejects.toThrow(InternalFailureError);
      expect(logger.error).toHaveBeenCalledWith('InitialConfigurationToken is undefined');
    });

    it('should throw an error when GetLatestConfigurationCommand fails', async () => {
      const mockSessionResponse: Partial<StartConfigurationSessionCommandOutput> = {
        InitialConfigurationToken: 'test-token',
      };
      mockAppConfigDataClient.send.mockResolvedValueOnce(mockSessionResponse);

      mockAppConfigDataClient.send.mockRejectedValueOnce(new Error('Config error'));

      await expect(appConfigServiceHelper.getConfiguration()).rejects.toThrow(InternalFailureError);
    });

    it('should throw an error when Configuration is undefined', async () => {
      const mockSessionResponse: Partial<StartConfigurationSessionCommandOutput> = {
        InitialConfigurationToken: 'test-token',
      };
      mockAppConfigDataClient.send.mockResolvedValueOnce(mockSessionResponse);

      const mockConfigResponse: Partial<GetLatestConfigurationCommandOutput> = {};
      mockAppConfigDataClient.send.mockResolvedValueOnce(mockConfigResponse);

      await expect(appConfigServiceHelper.getConfiguration()).rejects.toThrow(InternalFailureError);
      expect(logger.error).toHaveBeenCalledWith('Configuration is undefined');
    });
  });

  describe('updateConfiguration', () => {
    const testContent = JSON.stringify({ key: 'value' });

    it('should successfully update the configuration', async () => {
      const mockVersionResponse: Partial<CreateHostedConfigurationVersionCommandOutput> = {
        VersionNumber: 123,
      };
      mockAppConfigClient.send.mockResolvedValueOnce(mockVersionResponse);

      const mockDeploymentResponse: Partial<StartDeploymentCommandOutput> = {
        DeploymentNumber: 456,
      };
      mockAppConfigClient.send.mockResolvedValueOnce(mockDeploymentResponse);

      const result = await appConfigServiceHelper.updateConfiguration(testContent);

      expect(CreateHostedConfigurationVersionCommand).toHaveBeenCalledWith({
        ApplicationId: 'test-app-id',
        ConfigurationProfileId: 'test-profile-id',
        Content: testContent,
        ContentType: 'application/json',
      });

      expect(StartDeploymentCommand).toHaveBeenCalledWith({
        ApplicationId: 'test-app-id',
        EnvironmentId: 'test-env-id',
        ConfigurationProfileId: 'test-profile-id',
        DeploymentStrategyId: 'test-strategy',
        ConfigurationVersion: '123',
      });

      expect(result).toEqual(mockDeploymentResponse);
    });

    it('should throw an error when CreateHostedConfigurationVersionCommand fails', async () => {
      mockAppConfigClient.send.mockRejectedValueOnce(new Error('Version error'));

      await expect(appConfigServiceHelper.updateConfiguration(testContent)).rejects.toThrow(InternalFailureError);
      expect(logger.error).toHaveBeenCalledWith('Error creating hosted configuration version:Error: Version error');
    });

    it('should throw an error when VersionNumber is undefined', async () => {
      const mockVersionResponse: Partial<CreateHostedConfigurationVersionCommandOutput> = {};
      mockAppConfigClient.send.mockResolvedValueOnce(mockVersionResponse);

      await expect(appConfigServiceHelper.updateConfiguration(testContent)).rejects.toThrow(InternalFailureError);
      expect(logger.error).toHaveBeenCalledWith('VersionNumber is undefined');
    });

    it('should throw an error when StartDeploymentCommand fails', async () => {
      const mockVersionResponse: Partial<CreateHostedConfigurationVersionCommandOutput> = {
        VersionNumber: 123,
      };
      mockAppConfigClient.send.mockResolvedValueOnce(mockVersionResponse);

      mockAppConfigClient.send.mockRejectedValueOnce(new Error('Deployment error'));

      await expect(appConfigServiceHelper.updateConfiguration(testContent)).rejects.toThrow(InternalFailureError);
      expect(logger.error).toHaveBeenCalledWith('Error starting deployment:Error: Deployment error');
    });
  });
});
