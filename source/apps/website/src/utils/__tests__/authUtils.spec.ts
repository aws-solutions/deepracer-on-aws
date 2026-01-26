// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';

import { checkUserGroupMembership, configureAuth } from '../authUtils.js';

const mockEnvironmentConfig = vi.hoisted(() => ({
  userPoolId: 'test-user-pool-id',
  userPoolClientId: 'test-user-pool-client-id',
  identityPoolId: 'test-identity-pool-id',
}));

vi.mock('#utils/envUtils', () => ({
  environmentConfig: mockEnvironmentConfig,
}));

vi.mock('aws-amplify/auth');

describe('authUtils', () => {
  const mockFetchAuthSession = vi.mocked(fetchAuthSession);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configureAuth()', () => {
    it('should correctly configure Amplify auth', () => {
      vi.spyOn(Amplify, 'configure').mockReturnValueOnce();

      configureAuth();

      expect(Amplify.configure).toHaveBeenCalledWith({
        Auth: {
          Cognito: {
            userPoolClientId: mockEnvironmentConfig.userPoolClientId,
            userPoolId: mockEnvironmentConfig.userPoolId,
            identityPoolId: mockEnvironmentConfig.identityPoolId,
          },
        },
      });
    });
  });

  describe('checkUserGroupMembership()', () => {
    describe('when user has groups', () => {
      it('should return true when user is in the required group', async () => {
        mockFetchAuthSession.mockResolvedValue({
          tokens: {
            accessToken: {
              payload: {
                'cognito:groups': [UserGroups.ADMIN],
              },
            },
          },
        });

        const result = await checkUserGroupMembership([UserGroups.ADMIN]);

        expect(result).toBe(true);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
      });

      it('should return true when user is in any of the required groups', async () => {
        mockFetchAuthSession.mockResolvedValue({
          tokens: {
            accessToken: {
              payload: {
                'cognito:groups': [UserGroups.RACE_FACILITATORS],
              },
            },
          },
        });

        const result = await checkUserGroupMembership([UserGroups.ADMIN, UserGroups.RACE_FACILITATORS]);

        expect(result).toBe(true);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
      });

      it('should return false when user is not in any required groups', async () => {
        mockFetchAuthSession.mockResolvedValue({
          tokens: {
            accessToken: {
              payload: {
                'cognito:groups': [UserGroups.RACERS],
              },
            },
          },
        });

        const result = await checkUserGroupMembership([UserGroups.ADMIN]);

        expect(result).toBe(false);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
      });

      it('should return false when user has empty groups array', async () => {
        mockFetchAuthSession.mockResolvedValue({
          tokens: {
            accessToken: {
              payload: {
                'cognito:groups': [],
              },
            },
          },
        });

        const result = await checkUserGroupMembership([UserGroups.ADMIN]);

        expect(result).toBe(false);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
      });
    });

    describe('when user has no groups or missing tokens', () => {
      it('should return false when cognito:groups is missing from payload', async () => {
        mockFetchAuthSession.mockResolvedValue({
          tokens: {
            accessToken: {
              payload: {
                sub: 'user-id',
                email: 'test@example.com',
              },
            },
          },
        });

        const result = await checkUserGroupMembership([UserGroups.ADMIN]);

        expect(result).toBe(false);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
      });

      it('should return false when tokens are missing', async () => {
        mockFetchAuthSession.mockResolvedValue({
          tokens: undefined,
        });

        const result = await checkUserGroupMembership([UserGroups.ADMIN]);

        expect(result).toBe(false);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
      });

      it('should return false when auth session is empty', async () => {
        mockFetchAuthSession.mockResolvedValue({});

        const result = await checkUserGroupMembership([UserGroups.ADMIN]);

        expect(result).toBe(false);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
      });
    });

    describe('error handling', () => {
      it('should return false when fetchAuthSession throws an error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const error = new Error('Auth session failed');
        mockFetchAuthSession.mockRejectedValue(error);

        const result = await checkUserGroupMembership([UserGroups.ADMIN]);

        expect(result).toBe(false);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('Error determining user group memebership');

        consoleSpy.mockRestore();
      });

      it('should return false when fetchAuthSession throws a network error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const networkError = new Error('Network error');
        mockFetchAuthSession.mockRejectedValue(networkError);

        const result = await checkUserGroupMembership([UserGroups.RACERS]);

        expect(result).toBe(false);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('Error determining user group memebership');

        consoleSpy.mockRestore();
      });

      it('should return false when fetchAuthSession throws an authentication error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const authError = new Error('User not authenticated');
        mockFetchAuthSession.mockRejectedValue(authError);

        const result = await checkUserGroupMembership([UserGroups.RACE_FACILITATORS]);

        expect(result).toBe(false);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('Error determining user group memebership');

        consoleSpy.mockRestore();
      });
    });

    describe('edge cases', () => {
      it('should handle multiple groups correctly with Array.some() logic', async () => {
        mockFetchAuthSession.mockResolvedValue({
          tokens: {
            accessToken: {
              payload: {
                'cognito:groups': [UserGroups.RACE_FACILITATORS],
              },
            },
          },
        });

        const result = await checkUserGroupMembership([UserGroups.ADMIN, UserGroups.RACE_FACILITATORS]);

        expect(result).toBe(true);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
      });

      it('should handle single group in array', async () => {
        mockFetchAuthSession.mockResolvedValue({
          tokens: {
            accessToken: {
              payload: {
                'cognito:groups': [UserGroups.ADMIN],
              },
            },
          },
        });

        const result = await checkUserGroupMembership([UserGroups.ADMIN]);

        expect(result).toBe(true);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
      });

      it('should handle cognito:groups as non-array value gracefully', async () => {
        mockFetchAuthSession.mockResolvedValue({
          tokens: {
            accessToken: {
              payload: {
                'cognito:groups': 'not-an-array',
              },
            },
          },
        });

        const result = await checkUserGroupMembership([UserGroups.ADMIN]);

        expect(result).toBe(false);
        expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);
      });
    });
  });
});
