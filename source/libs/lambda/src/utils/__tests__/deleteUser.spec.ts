// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourceId } from '@deepracer-indy/database';
import { logger } from '@deepracer-indy/utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { deleteModelsForProfile } from '../deleteModelsForProfile.js';
import { deleteUser } from '../deleteUser.js';
import { deleteUserFromCognito } from '../deleteUserFromCognito.js';
import { deleteUserFromDatabase } from '../deleteUserFromDatabase.js';

vi.mock('@deepracer-indy/utils');
vi.mock('../deleteModelsForProfile.js');
vi.mock('../deleteUserFromCognito.js');
vi.mock('../deleteUserFromDatabase.js');

describe('deleteUser', () => {
  const mockProfileId = 'test-profile-id' as ResourceId;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteUserFromCognito).mockResolvedValue();
    vi.mocked(deleteUserFromDatabase).mockResolvedValue();
    vi.mocked(deleteModelsForProfile).mockResolvedValue();
    vi.mocked(logger.info).mockImplementation(vi.fn());
    vi.mocked(logger.error).mockImplementation(vi.fn());
  });

  it('should delete user completely in correct order', async () => {
    await deleteUser(mockProfileId);

    expect(deleteUserFromCognito).toHaveBeenCalledWith(mockProfileId);
    expect(deleteUserFromDatabase).toHaveBeenCalledWith(mockProfileId);
    expect(deleteModelsForProfile).toHaveBeenCalledWith(mockProfileId);
    expect(logger.info).toHaveBeenCalledWith('Starting complete user deletion', { profileId: mockProfileId });
    expect(logger.info).toHaveBeenCalledWith('Completed user deletion', { profileId: mockProfileId });
  });

  it('should call deletion functions in correct order', async () => {
    const callOrder: string[] = [];
    vi.mocked(deleteUserFromCognito).mockImplementation(async () => {
      callOrder.push('cognito');
    });
    vi.mocked(deleteUserFromDatabase).mockImplementation(async () => {
      callOrder.push('database');
    });
    vi.mocked(deleteModelsForProfile).mockImplementation(async () => {
      callOrder.push('models');
    });

    await deleteUser(mockProfileId);

    expect(callOrder).toEqual(['cognito', 'database', 'models']);
  });

  it('should handle errors and rethrow', async () => {
    const mockError = new Error('Deletion failed');
    vi.mocked(deleteUserFromCognito).mockRejectedValue(mockError);

    await expect(deleteUser(mockProfileId)).rejects.toThrow('Deletion failed');
    expect(logger.error).toHaveBeenCalledWith('Failed to delete user', {
      profileId: mockProfileId,
      error: mockError,
    });
    expect(deleteUserFromDatabase).not.toHaveBeenCalled();
    expect(deleteModelsForProfile).not.toHaveBeenCalled();
  });
});
