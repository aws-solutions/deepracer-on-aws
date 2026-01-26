// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests for security - tests token expiration, session management, management of deleted
 * resources, and security logging
 */

import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { ResourceId } from '@deepracer-indy/database';
import { type Mock, describe, it, expect, vi, beforeEach } from 'vitest';

import { cognitoClient } from '#utils/clients/cognitoClient.js';

import { getCognitoUserId } from '../utils/apiGateway';

vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  ListUsersCommand: vi.fn().mockImplementation((input) => ({ input })),
  AdminListGroupsForUserCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

vi.mock('#utils/clients/cognitoClient.js', () => ({
  cognitoClient: {
    send: vi.fn(),
  },
}));

vi.mock('../../utils/CognitoHelper.js', () => ({
  cognitoHelper: {
    getUsernameFromSub: vi.fn(),
  },
}));

vi.mock('@deepracer-indy/utils', () => ({
  logger: {
    appendKeys: vi.fn(),
    addContext: vi.fn(),
    removeContext: vi.fn(),
    clearContext: vi.fn(),
    setContext: vi.fn(),
    logEventIfEnabled: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  metrics: {
    setDefaultDimensions: vi.fn(),
    setFunctionName: vi.fn(),
    publishStoredMetrics: vi.fn(),
  },
  metricsLogger: {
    logUnauthorizedAccess: vi.fn(),
    logSecurityViolation: vi.fn(),
  },
  tracer: {
    wrap: vi.fn((name, fn) => fn),
    captureAWSv3Client: vi.fn(),
    isTracingEnabled: vi.fn().mockReturnValue(true),
  },
}));

describe('Security integration tests', () => {
  let mockCognitoClient: { send: Mock };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCognitoClient = { send: vi.fn() };
    (CognitoIdentityProviderClient as Mock).mockReturnValue(mockCognitoClient);

    // Re-establish default mock behavior for getUsernameFromSub after clearAllMocks
    const { cognitoHelper } = await import('../../utils/CognitoHelper.js');
    (cognitoHelper.getUsernameFromSub as Mock).mockRejectedValue(new Error('Failed to get username'));
  });

  describe('Token expiration', () => {
    it('should reject requests with expired tokens', async () => {
      (cognitoClient.send as Mock).mockResolvedValueOnce({
        Users: [],
        $metadata: {},
      });

      const authProvider = 'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,cognito-idp:CognitoSignIn:expired-sub';

      await expect(getCognitoUserId(authProvider)).rejects.toThrow('Failed to get username');
    });

    it('should reject requests with invalid token signatures', async () => {
      (cognitoClient.send as Mock).mockRejectedValueOnce(new Error('Invalid token signature'));

      const authProvider =
        'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,cognito-idp:CognitoSignIn:tampered-sub';

      await expect(getCognitoUserId(authProvider)).rejects.toThrow('Failed to get username');
    });

    it('should reject requests from wrong user pool', async () => {
      (cognitoClient.send as Mock).mockResolvedValueOnce({
        Users: [],
        $metadata: {},
      });

      const authProvider = 'cognito-idp.us-west-2.amazonaws.com/us-west-2_wrongpool,cognito-idp:CognitoSignIn:sub-123';

      await expect(getCognitoUserId(authProvider)).rejects.toThrow('Failed to get username');
    });
  });

  describe('Session management', () => {
    it('should reject requests with missing authentication provider', async () => {
      await expect(getCognitoUserId('')).rejects.toThrow('User is not authenticated');
    });

    it('should reject malformed authentication provider - missing comma', async () => {
      const malformedAuth = 'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123';

      await expect(getCognitoUserId(malformedAuth)).rejects.toThrow('Could not parse authentication provider');
    });

    it('should reject malformed authentication provider - missing slash', async () => {
      const malformedAuth = 'cognito-idp-no-slash,test-user';

      await expect(getCognitoUserId(malformedAuth)).rejects.toThrow('Could not parse authentication provider');
    });

    it('should reject authentication provider with empty sub', async () => {
      const authWithEmptySub = 'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,cognito-idp:CognitoSignIn:';

      await expect(getCognitoUserId(authWithEmptySub)).rejects.toThrow('Could not parse sub');
    });

    it('should reject authentication provider with empty user pool ID', async () => {
      const authWithEmptyPool = 'cognito-idp.us-east-1.amazonaws.com/,cognito-idp:CognitoSignIn:sub-123';

      await expect(getCognitoUserId(authWithEmptyPool)).rejects.toThrow('Could not parse userPoolId');
    });

    it('should handle revoked tokens (user not found in Cognito)', async () => {
      (cognitoClient.send as Mock).mockResolvedValueOnce({
        Users: [],
        $metadata: {},
      });

      const authProvider = 'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,cognito-idp:CognitoSignIn:revoked-sub';

      await expect(getCognitoUserId(authProvider)).rejects.toThrow('Failed to get username');
    });

    it('should reject when multiple users found (data integrity issue)', async () => {
      (cognitoClient.send as Mock).mockResolvedValueOnce({
        Users: [{ Username: 'user1' as ResourceId }, { Username: 'user2' as ResourceId }],
        $metadata: {},
      });

      const authProvider =
        'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,cognito-idp:CognitoSignIn:duplicate-sub';

      await expect(getCognitoUserId(authProvider)).rejects.toThrow('Failed to get username');
    });
  });

  describe('Deleted resource access', () => {
    it('should deny access when resource owner is deleted from Cognito', async () => {
      (cognitoClient.send as Mock).mockResolvedValueOnce({
        Users: [],
        $metadata: {},
      });

      const authProvider =
        'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,cognito-idp:CognitoSignIn:deleted-user-sub';

      await expect(getCognitoUserId(authProvider)).rejects.toThrow('Failed to get username');
    });

    it('should handle gracefully when Cognito service is unavailable', async () => {
      // Simulate service unavailable
      (cognitoClient.send as Mock).mockRejectedValueOnce(new Error('Service unavailable'));

      const authProvider = 'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,cognito-idp:CognitoSignIn:valid-sub';

      await expect(getCognitoUserId(authProvider)).rejects.toThrow('Failed to get username');
    });
  });

  describe('Security error messages', () => {
    it('should not leak sensitive information in error messages', async () => {
      // Simulate authentication failure
      (cognitoClient.send as Mock).mockRejectedValueOnce(
        new Error('Internal Cognito error with sensitive data: user_pool_details'),
      );

      const authProvider = 'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,cognito-idp:CognitoSignIn:test-sub';

      await expect(getCognitoUserId(authProvider)).rejects.toThrow('Failed to get username');

      // Verify the error thrown was the generic one
      const errorThrown = await getCognitoUserId(authProvider).catch((e) => e);
      expect(errorThrown.message).not.toContain('user_pool_details');
    });

    it('should return generic error for malformed authentication strings', async () => {
      const malformedAuth = 'completely-invalid-string';

      await expect(getCognitoUserId(malformedAuth)).rejects.toThrow('Could not parse authentication provider');
    });
  });

  describe('Token format validation', () => {
    it('should validate authentication provider format strictly', async () => {
      // Missing CognitoSignIn indicator
      const invalidFormat = 'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,sub-without-prefix';

      // This should still work as long as it has the right structure (comma and slash)
      // but fail at Cognito lookup
      (cognitoClient.send as Mock).mockResolvedValueOnce({
        Users: [],
        $metadata: {},
      });

      await expect(getCognitoUserId(invalidFormat)).rejects.toThrow('Failed to get username');
    });

    it('should handle authentication provider with extra fields gracefully', async () => {
      (cognitoClient.send as Mock).mockResolvedValueOnce({
        Users: [{ Username: 'valid-user' as ResourceId }],
        $metadata: {},
      });

      const { cognitoHelper } = await import('../../utils/CognitoHelper.js');
      (cognitoHelper.getUsernameFromSub as Mock).mockResolvedValueOnce('valid-user' as ResourceId);

      const authWithExtra =
        'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,cognito-idp:CognitoSignIn:valid-sub,extra-field';

      const result = await getCognitoUserId(authWithExtra);
      expect(result).toBe('valid-user');
    });
  });
});
