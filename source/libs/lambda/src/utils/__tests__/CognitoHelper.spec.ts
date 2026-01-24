// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

import { cognitoClient } from '../clients/cognitoClient';
import { cognitoHelper } from '../CognitoHelper';

vi.mock('../clients/cognitoClient', () => ({
  cognitoClient: {
    send: vi.fn(),
  },
}));

describe('CognitoHelper', () => {
  const mockUserPoolId = 'test-user-pool-id';
  const mockSub = 'test-sub-id';
  const mockUsername = 'test-username';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsernameFromSub', () => {
    it('should return username when a single user is found', async () => {
      const mockResponse = {
        Users: [
          {
            Username: mockUsername,
            Attributes: [
              {
                Name: 'sub',
                Value: mockSub,
              },
            ],
          },
        ],
      };
      (cognitoClient.send as Mock).mockResolvedValueOnce(mockResponse);
      const result = await cognitoHelper.getUsernameFromSub(mockUserPoolId, mockSub);

      expect(cognitoClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            UserPoolId: mockUserPoolId,
            Filter: `sub = "${mockSub}"`,
          },
        }),
      );

      expect(result).toBe(mockUsername);
    });

    it('should throw an error when no user is found', async () => {
      const mockResponse = {
        Users: [],
      };
      (cognitoClient.send as Mock).mockResolvedValueOnce(mockResponse);

      await expect(cognitoHelper.getUsernameFromSub(mockUserPoolId, mockSub)).rejects.toThrow('Failed to get username');
    });

    it('should throw an error when multiple users are found', async () => {
      const mockResponse = {
        Users: [
          {
            Username: mockUsername,
            Attributes: [
              {
                Name: 'sub',
                Value: mockSub,
              },
            ],
          },
          {
            Username: 'another-username',
            Attributes: [
              {
                Name: 'sub',
                Value: mockSub,
              },
            ],
          },
        ],
      };
      (cognitoClient.send as Mock).mockResolvedValueOnce(mockResponse);

      await expect(cognitoHelper.getUsernameFromSub(mockUserPoolId, mockSub)).rejects.toThrow('Failed to get username');
    });

    it('should throw an error when the AWS SDK throws an error', async () => {
      (cognitoClient.send as Mock).mockRejectedValueOnce(new Error('AWS SDK error'));

      await expect(cognitoHelper.getUsernameFromSub(mockUserPoolId, mockSub)).rejects.toThrow('Failed to get username');
    });

    it('should correctly construct the ListUsersCommand with the provided parameters', async () => {
      const mockResponse = {
        Users: [
          {
            Username: mockUsername,
            Attributes: [
              {
                Name: 'sub',
                Value: mockSub,
              },
            ],
          },
        ],
      };

      (cognitoClient.send as Mock).mockResolvedValueOnce(mockResponse);
      await cognitoHelper.getUsernameFromSub(mockUserPoolId, mockSub);

      expect(cognitoClient.send).toHaveBeenCalledWith(expect.any(ListUsersCommand));

      const commandArg = (cognitoClient.send as Mock).mock.calls[0][0];

      expect(commandArg.input).toEqual({
        UserPoolId: mockUserPoolId,
        Filter: `sub = "${mockSub}"`,
      });
    });

    it('should handle undefined Users in the response', async () => {
      const mockResponse = {
        // Users property missing
      };
      (cognitoClient.send as Mock).mockResolvedValueOnce(mockResponse);

      await expect(cognitoHelper.getUsernameFromSub(mockUserPoolId, mockSub)).rejects.toThrow('Failed to get username');
    });

    it('should handle undefined Username in the user object', async () => {
      const mockResponse = {
        Users: [
          {
            Attributes: [
              {
                Name: 'sub',
                Value: mockSub,
              },
            ],
          },
        ],
      };
      (cognitoClient.send as Mock).mockResolvedValueOnce(mockResponse);
      const result = await cognitoHelper.getUsernameFromSub(mockUserPoolId, mockSub);

      expect(result).toBeUndefined();
    });
  });
});
