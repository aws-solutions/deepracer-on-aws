// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Set environment variable before importing the module
import { ResourceId } from '@deepracer-indy/database';
import { logger } from '@deepracer-indy/utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { cognitoClient } from '../clients/cognitoClient.js';
import { deleteUserFromCognito } from '../deleteUserFromCognito.js';

process.env.USER_POOL_ID = 'test-user-pool-id';

vi.mock('@deepracer-indy/utils');
vi.mock('#utils/clients/cognitoClient.js', () => ({
  cognitoClient: {
    send: vi.fn(),
  },
}));

describe('deleteUserFromCognito', () => {
  const mockProfileId = 'test-profile-id' as ResourceId;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cognitoClient.send).mockResolvedValue();
    vi.mocked(logger.info).mockImplementation(vi.fn());
    vi.mocked(logger.error).mockImplementation(vi.fn());
  });

  it('should delete user from Cognito successfully', async () => {
    await deleteUserFromCognito(mockProfileId);

    expect(cognitoClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          UserPoolId: 'test-user-pool-id',
          Username: mockProfileId,
        },
      }),
    );
    expect(logger.info).toHaveBeenCalledWith('Deleting user from Cognito', { profileId: mockProfileId });
    expect(logger.info).toHaveBeenCalledWith('Deleted user from Cognito', { profileId: mockProfileId });
  });

  it('should handle Cognito errors and rethrow', async () => {
    const mockError = new Error('Cognito error');
    vi.mocked(cognitoClient.send).mockRejectedValue(mockError);

    await expect(deleteUserFromCognito(mockProfileId)).rejects.toThrow('Cognito error');
    expect(logger.error).toHaveBeenCalledWith('Failed to delete user from Cognito', {
      profileId: mockProfileId,
      error: mockError,
    });
  });
});
