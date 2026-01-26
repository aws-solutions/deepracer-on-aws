// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  profileDao,
  ResourceId,
  TEST_GLOBAL_CONFIG_NEW_USER,
  TEST_PROFILE_ITEM,
  DynamoDBItemAttribute,
} from '@deepracer-indy/database';
import { metricsLogger } from '@deepracer-indy/utils';
import type * as lambda from 'aws-lambda';

import { globalSettingsHelper } from '../../../utils/GlobalSettingsHelper.js';
import { PreSignUp } from '../preSignUp.js';

vi.mock('#utils/GlobalSettingsHelper.js');

describe('PreSignUp lambda', () => {
  const callback = vi.fn();
  const context = {} as lambda.Context;

  const event: lambda.PreSignUpTriggerEvent = {
    version: '1',
    region: 'us-east-1',
    userPoolId: 'us-east-1_Example',
    userName: 'UkJND3rvVbcLZ5-',
    callerContext: {
      awsSdkVersion: 'aws-sdk-unknown-unknown',
      clientId: '66325uf36q7q1s8gvo4sop5e8r',
    },
    triggerSource: 'PreSignUp_SignUp',
    request: {
      userAttributes: {},
    },
    response: {
      autoConfirmUser: false,
      autoVerifyEmail: false,
      autoVerifyPhone: false,
    },
  };

  const mockGlobalSettingsHelper = vi.mocked(globalSettingsHelper);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGlobalSettingsHelper.getGlobalSetting.mockImplementation((key: string) => {
      if (key === 'usageQuotas.newUser') {
        return Promise.resolve({ ...TEST_GLOBAL_CONFIG_NEW_USER });
      }
      return Promise.resolve(null);
    });
    vi.spyOn(metricsLogger, 'logCreateUser').mockImplementation(() => undefined);
    vi.spyOn(profileDao, 'create').mockResolvedValue({
      ...TEST_PROFILE_ITEM,
      profileId: 'UkJND3rvVbcLZ5-' as ResourceId,
    });
  });

  describe('successful execution', () => {
    it('should successfully process valid input and return the event', async () => {
      const response = await PreSignUp(event, context, callback);

      expect(response).toEqual(event);
      expect(response.userName).toEqual(event.userName);
      expect(mockGlobalSettingsHelper.getGlobalSetting).toHaveBeenCalledWith('usageQuotas.newUser');
      expect(profileDao.create).toHaveBeenCalledWith({
        profileId: event.userName,
        alias: 'RacerAlias',
        maxTotalComputeMinutes: TEST_GLOBAL_CONFIG_NEW_USER.newUserComputeMinutesLimit,
        maxModelCount: TEST_GLOBAL_CONFIG_NEW_USER.newUserModelCountLimit,
        createdAt: expect.any(String),
      });
      expect(metricsLogger.logCreateUser).toHaveBeenCalledWith();
    });

    it('should handle different valid username formats', async () => {
      const validUsernames = ['UkJND3rvVbcLZ5-', 'A1B2C3D4E5F6G7H', 'ABC123DEF456GHI', 'X-Y-Z-123456789'];

      for (const userName of validUsernames) {
        const event1: lambda.PreSignUpTriggerEvent = {
          ...event,
          userName,
        };

        vi.spyOn(profileDao, 'create').mockResolvedValue({ ...TEST_PROFILE_ITEM, profileId: userName as ResourceId });

        const response = await PreSignUp(event1, context, callback);
        expect(response.userName).toEqual(userName);
      }
    });

    it('should handle string values from global settings and convert to numbers', async () => {
      mockGlobalSettingsHelper.getGlobalSetting.mockImplementation((key: string) => {
        if (key === 'usageQuotas.newUser') {
          return Promise.resolve({
            newUserComputeMinutesLimit: '240',
            newUserModelCountLimit: '10',
          });
        }
        return Promise.resolve(null);
      });

      await PreSignUp(event, context, callback);

      expect(profileDao.create).toHaveBeenCalledWith({
        profileId: event.userName,
        alias: 'RacerAlias',
        maxTotalComputeMinutes: 240,
        maxModelCount: 10,
        createdAt: expect.any(String),
      });
    });
  });

  describe('username validation', () => {
    it('should fail with invalid username - simple string', async () => {
      const event1: lambda.PreSignUpTriggerEvent = {
        ...event,
        userName: 'testUser',
      };

      await expect(PreSignUp(event1, context, callback)).rejects.toEqual(new Error('Username is invalid'));
    });

    it('should fail with invalid username - contains special characters', async () => {
      const invalidUsernames = [
        'user@domain.com',
        'user name',
        'user+123',
        'user#123',
        'user$123',
        'user%123',
        'user&123',
        'user*123',
        'user(123)',
        'user[123]',
        'user{123}',
        'user|123',
        'user\\123',
        'user/123',
        'user?123',
        'user<123>',
        'user,123',
        'user.123',
        'user;123',
        'user:123',
        'user"123',
        "user'123",
        'user`123',
        'user~123',
        'user!123',
      ];

      for (const userName of invalidUsernames) {
        const event1: lambda.PreSignUpTriggerEvent = {
          ...event,
          userName,
        };

        await expect(PreSignUp(event1, context, callback)).rejects.toEqual(new Error('Username is invalid'));
      }
    });

    it('should fail with empty username', async () => {
      const event1: lambda.PreSignUpTriggerEvent = {
        ...event,
        userName: '',
      };

      await expect(PreSignUp(event1, context, callback)).rejects.toEqual(new Error('Username is invalid'));
    });
  });

  describe('error handling', () => {
    it('should throw error when global settings return undefined for compute minutes', async () => {
      mockGlobalSettingsHelper.getGlobalSetting.mockImplementation((key: string) => {
        if (key === 'usageQuotas.newUser') {
          return Promise.resolve({
            newUserModelCountLimit: 10,
          });
        }
        return Promise.resolve(null);
      });

      await expect(PreSignUp(event, context, callback)).rejects.toEqual(new Error('Failed to create profile'));
    });

    it('should throw error when global settings return null for model count', async () => {
      mockGlobalSettingsHelper.getGlobalSetting.mockImplementation((key: string) => {
        if (key === 'usageQuotas.newUser') {
          return Promise.resolve({
            newUserComputeMinutesLimit: 240,
          });
        }
        return Promise.resolve(null);
      });

      await expect(PreSignUp(event, context, callback)).rejects.toEqual(new Error('Failed to create profile'));
    });

    it('should throw error when global settings retrieval fails', async () => {
      mockGlobalSettingsHelper.getGlobalSetting.mockImplementation((key: string) => {
        if (key === 'usageQuotas.newUser') {
          return Promise.reject(new Error('Failed to get new user quota'));
        }
        return Promise.resolve(5);
      });

      await expect(PreSignUp(event, context, callback)).rejects.toEqual(new Error('Failed to get new user quota'));
    });

    it('should throw error when profile creation fails', async () => {
      vi.spyOn(profileDao, 'create').mockRejectedValue(new Error('Database connection failed'));

      await expect(PreSignUp(event, context, callback)).rejects.toEqual(new Error('Database connection failed'));
    });

    it('should continue execution even if metrics sending fails', async () => {
      vi.spyOn(metricsLogger, 'logCreateUser').mockImplementation(() => undefined);

      const response = await PreSignUp(event, context, callback);
      expect(response).toEqual(event);
      expect(metricsLogger.logCreateUser).toHaveBeenCalledWith();
    });
  });

  describe('edge cases', () => {
    it('should handle zero values from global settings', async () => {
      mockGlobalSettingsHelper.getGlobalSetting.mockImplementation((key: string) => {
        if (key === 'usageQuotas.newUser') {
          return Promise.resolve({
            newUserComputeMinutesLimit: 0,
            newUserModelCountLimit: 0,
          });
        }
        return Promise.resolve(null);
      });

      await PreSignUp(event, context, callback);

      expect(profileDao.create).toHaveBeenCalledWith({
        profileId: event.userName,
        alias: 'RacerAlias',
        maxTotalComputeMinutes: 0,
        maxModelCount: 0,
        createdAt: expect.any(String),
      });
    });

    it('should handle negative values from global settings', async () => {
      mockGlobalSettingsHelper.getGlobalSetting.mockImplementation((key: string) => {
        if (key === 'usageQuotas.newUser') {
          return Promise.resolve({
            newUserComputeMinutesLimit: -1,
            newUserModelCountLimit: -5,
          });
        }
        return Promise.resolve(null);
      });

      await PreSignUp(event, context, callback);

      expect(profileDao.create).toHaveBeenCalledWith({
        profileId: event.userName,
        alias: 'RacerAlias',
        maxTotalComputeMinutes: -1,
        maxModelCount: -5,
        createdAt: expect.any(String),
      });
    });

    it('should handle very large values from global settings', async () => {
      mockGlobalSettingsHelper.getGlobalSetting.mockImplementation((key: string) => {
        if (key === 'usageQuotas.newUser') {
          return Promise.resolve({
            newUserComputeMinutesLimit: Number.MAX_SAFE_INTEGER,
            newUserModelCountLimit: 999999999,
          });
        }
        return Promise.resolve(null);
      });

      await PreSignUp(event, context, callback);

      expect(profileDao.create).toHaveBeenCalledWith({
        profileId: event.userName,
        alias: 'RacerAlias',
        maxTotalComputeMinutes: Number.MAX_SAFE_INTEGER,
        maxModelCount: 999999999,
        createdAt: expect.any(String),
      });
    });
  });

  describe('racer alias functionality', () => {
    it('should use provided racer alias from clientMetadata', async () => {
      const eventWithAlias: lambda.PreSignUpTriggerEvent = {
        ...event,
        request: {
          ...event.request,
          clientMetadata: {
            racerAlias: 'CustomRacer123',
          },
        },
      };

      await PreSignUp(eventWithAlias, context, callback);

      expect(profileDao.create).toHaveBeenCalledWith({
        profileId: event.userName,
        alias: 'CustomRacer123',
        maxTotalComputeMinutes: TEST_GLOBAL_CONFIG_NEW_USER.newUserComputeMinutesLimit,
        maxModelCount: TEST_GLOBAL_CONFIG_NEW_USER.newUserModelCountLimit,
        [DynamoDBItemAttribute.CREATED_AT]: expect.any(String),
        [DynamoDBItemAttribute.EMAIL_ADDRESS]: undefined,
      });
    });

    it('should fallback to default alias when no clientMetadata provided', async () => {
      const eventWithoutMetadata: lambda.PreSignUpTriggerEvent = {
        ...event,
        request: {
          ...event.request,
          clientMetadata: undefined,
        },
      };

      await PreSignUp(eventWithoutMetadata, context, callback);

      expect(profileDao.create).toHaveBeenCalledWith({
        profileId: event.userName,
        alias: 'RacerAlias',
        maxTotalComputeMinutes: TEST_GLOBAL_CONFIG_NEW_USER.newUserComputeMinutesLimit,
        maxModelCount: TEST_GLOBAL_CONFIG_NEW_USER.newUserModelCountLimit,
        [DynamoDBItemAttribute.CREATED_AT]: expect.any(String),
        [DynamoDBItemAttribute.EMAIL_ADDRESS]: undefined,
      });
    });

    it('should reject invalid alias - too short', async () => {
      const eventWithShortAlias: lambda.PreSignUpTriggerEvent = {
        ...event,
        request: {
          ...event.request,
          clientMetadata: {
            racerAlias: 'ab',
          },
        },
      };

      await expect(PreSignUp(eventWithShortAlias, context, callback)).rejects.toEqual(
        new Error('Invalid racer alias format'),
      );
    });

    it('should reject invalid alias - too long', async () => {
      const eventWithLongAlias: lambda.PreSignUpTriggerEvent = {
        ...event,
        request: {
          ...event.request,
          clientMetadata: {
            racerAlias: 'ThisAliasIsTooLongForTheValidation',
          },
        },
      };

      await expect(PreSignUp(eventWithLongAlias, context, callback)).rejects.toEqual(
        new Error('Invalid racer alias format'),
      );
    });

    it('should reject invalid alias - invalid characters', async () => {
      const invalidAliases = ['racer@123', 'racer 123', 'racer#123', 'racer.123'];

      for (const alias of invalidAliases) {
        const eventWithInvalidAlias: lambda.PreSignUpTriggerEvent = {
          ...event,
          request: {
            ...event.request,
            clientMetadata: {
              racerAlias: alias,
            },
          },
        };

        await expect(PreSignUp(eventWithInvalidAlias, context, callback)).rejects.toEqual(
          new Error('Invalid racer alias format'),
        );
      }
    });

    it('should accept valid alias formats', async () => {
      const validAliases = ['Racer123', 'racer_123', 'racer-123', 'ABC', 'test_user-123'];

      for (const alias of validAliases) {
        const eventWithValidAlias: lambda.PreSignUpTriggerEvent = {
          ...event,
          request: {
            ...event.request,
            clientMetadata: {
              racerAlias: alias,
            },
          },
        };

        await PreSignUp(eventWithValidAlias, context, callback);

        expect(profileDao.create).toHaveBeenCalledWith({
          profileId: event.userName,
          alias: alias,
          maxTotalComputeMinutes: TEST_GLOBAL_CONFIG_NEW_USER.newUserComputeMinutesLimit,
          maxModelCount: TEST_GLOBAL_CONFIG_NEW_USER.newUserModelCountLimit,
          [DynamoDBItemAttribute.CREATED_AT]: expect.any(String),
          [DynamoDBItemAttribute.EMAIL_ADDRESS]: undefined,
        });
      }
    });
  });
});
