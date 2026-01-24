// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { profileDao, TEST_PROFILE_ITEM } from '@deepracer-indy/database';
import { BadRequestError, InternalFailureError, UpdateProfileInput } from '@deepracer-indy/typescript-server-client';
import { Mock } from 'vitest';

import { cognitoClient } from '../../../utils/clients/cognitoClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { UpdateProfileOperation } from '../updateProfile.js';

vi.mock('../../../utils/clients/cognitoClient.js', () => ({
  cognitoClient: {
    send: vi.fn(),
  },
}));

const mockCognitoSend = vi.mocked(cognitoClient.send) as Mock;

const mockEnv = vi.hoisted(() => ({
  USER_POOL_ID: 'test-user-pool-id',
}));

vi.stubEnv('USER_POOL_ID', mockEnv.USER_POOL_ID);

describe('UpdateProfile operation', () => {
  const TEST_INPUT: UpdateProfileInput = {
    alias: TEST_PROFILE_ITEM.alias,
    avatar: TEST_PROFILE_ITEM.avatar,
    maxTotalComputeMinutes: TEST_PROFILE_ITEM.maxTotalComputeMinutes,
    maxModelCount: TEST_PROFILE_ITEM.maxModelCount,
  };

  const mockAdminGroups: unknown = {
    Groups: [{ GroupName: 'dr-admins' }],
    $metadata: {},
  };

  const mockNonAdminGroups: unknown = {
    Groups: [{ GroupName: 'dr-users' }],
    $metadata: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow regular user to update alias and avatar only', async () => {
    mockCognitoSend.mockResolvedValue(mockNonAdminGroups);
    vi.spyOn(profileDao, 'update').mockResolvedValue(TEST_PROFILE_ITEM);

    const input = { alias: 'New Alias', avatar: { skinColor: 'light' } };
    await UpdateProfileOperation(input, TEST_OPERATION_CONTEXT);

    expect(profileDao.update).toHaveBeenCalledWith(
      { profileId: TEST_OPERATION_CONTEXT.profileId },
      { alias: 'New Alias', avatar: { skinColor: 'light' } },
    );
  });

  it('should reject regular user attempting to modify maxTotalComputeMinutes', async () => {
    mockCognitoSend.mockResolvedValue(mockNonAdminGroups);
    const updateSpy = vi.spyOn(profileDao, 'update');

    const input = { maxTotalComputeMinutes: 7200 };

    await expect(UpdateProfileOperation(input, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Non-admin user requesting to change one or more admin-only properties.',
      }),
    );

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should reject regular user attempting to modify maxModelCount', async () => {
    mockCognitoSend.mockResolvedValue(mockNonAdminGroups);
    const updateSpy = vi.spyOn(profileDao, 'update');

    const input = { maxModelCount: 15 };

    await expect(UpdateProfileOperation(input, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Non-admin user requesting to change one or more admin-only properties.',
      }),
    );

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should reject regular user attempting to modify both admin fields', async () => {
    mockCognitoSend.mockResolvedValue(mockNonAdminGroups);
    const updateSpy = vi.spyOn(profileDao, 'update');

    const input = { maxTotalComputeMinutes: 7200, maxModelCount: 15 };

    await expect(UpdateProfileOperation(input, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Non-admin user requesting to change one or more admin-only properties.',
      }),
    );

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should allow admin to update admin fields for another user', async () => {
    mockCognitoSend.mockResolvedValue(mockAdminGroups);
    vi.spyOn(profileDao, 'update').mockResolvedValue(TEST_PROFILE_ITEM);

    const targetProfileId = 'target-user-profile-id';
    const input = { profileId: targetProfileId, maxTotalComputeMinutes: 3600 };
    await UpdateProfileOperation(input, TEST_OPERATION_CONTEXT);

    expect(profileDao.update).toHaveBeenCalledWith({ profileId: targetProfileId }, { maxTotalComputeMinutes: 3600 });
  });

  it('should reject non-admin user attempting to update another users profile', async () => {
    mockCognitoSend.mockResolvedValue(mockNonAdminGroups);
    const updateSpy = vi.spyOn(profileDao, 'update');

    const targetProfileId = 'target-user-profile-id';
    const input = { profileId: targetProfileId, alias: 'New Alias' };

    await expect(UpdateProfileOperation(input, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Admin permission required to make this change.',
      }),
    );

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should allow admin to update admin fields with special values', async () => {
    mockCognitoSend.mockResolvedValue(mockAdminGroups);
    vi.spyOn(profileDao, 'update').mockResolvedValue(TEST_PROFILE_ITEM);

    const input = { maxTotalComputeMinutes: -1, maxModelCount: 0 };
    await UpdateProfileOperation(input, TEST_OPERATION_CONTEXT);

    expect(profileDao.update).toHaveBeenCalledWith(
      { profileId: TEST_OPERATION_CONTEXT.profileId },
      { maxTotalComputeMinutes: -1, maxModelCount: 0 },
    );
  });

  it('should not update alias if empty string is provided', async () => {
    mockCognitoSend.mockResolvedValue(mockNonAdminGroups);
    vi.spyOn(profileDao, 'update').mockResolvedValue(TEST_PROFILE_ITEM);

    const input = { alias: '', avatar: { skinColor: 'light' } };
    await UpdateProfileOperation(input, TEST_OPERATION_CONTEXT);

    expect(profileDao.update).toHaveBeenCalledWith(
      { profileId: TEST_OPERATION_CONTEXT.profileId },
      { avatar: { skinColor: 'light' } },
    );
  });

  it('should not update avatar if empty object is provided', async () => {
    mockCognitoSend.mockResolvedValue(mockNonAdminGroups);
    vi.spyOn(profileDao, 'update').mockResolvedValue(TEST_PROFILE_ITEM);

    const input = { alias: 'New Alias', avatar: {} };
    await UpdateProfileOperation(input, TEST_OPERATION_CONTEXT);

    expect(profileDao.update).toHaveBeenCalledWith(
      { profileId: TEST_OPERATION_CONTEXT.profileId },
      { alias: 'New Alias' },
    );
  });

  it('should throw error if no valid fields are provided', async () => {
    mockCognitoSend.mockResolvedValue(mockNonAdminGroups);

    await expect(UpdateProfileOperation({}, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new BadRequestError({
        message:
          'At least one valid field (alias, avatar, maxTotalComputeMinutes, or maxModelCount) needs to be provided.',
      }),
    );
  });

  it('should throw error if only empty/undefined fields are provided', async () => {
    mockCognitoSend.mockResolvedValue(mockNonAdminGroups);

    const input = { alias: '', avatar: {} };
    await expect(UpdateProfileOperation(input, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new BadRequestError({
        message:
          'At least one valid field (alias, avatar, maxTotalComputeMinutes, or maxModelCount) needs to be provided.',
      }),
    );
  });

  it('should throw error when Cognito call fails', async () => {
    mockCognitoSend.mockRejectedValue(new Error('Cognito error'));

    const input = { alias: 'New Alias' };
    await expect(UpdateProfileOperation(input, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      'Failed to verify user permissions.',
    );
  });

  it('should throw error when USER_POOL_ID is not configured', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('USER_POOL_ID', '');

    const input = { alias: 'New Alias' };
    await expect(UpdateProfileOperation(input, TEST_OPERATION_CONTEXT)).rejects.toThrow('Service configuration error.');

    vi.stubEnv('USER_POOL_ID', mockEnv.USER_POOL_ID);
  });

  it('should throw error if profile update fails', async () => {
    mockCognitoSend.mockResolvedValue(mockAdminGroups);
    vi.spyOn(profileDao, 'update').mockRejectedValue(new InternalFailureError({ message: 'Internal failure.' }));

    await expect(UpdateProfileOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new InternalFailureError({ message: 'Internal failure.' }),
    );
  });
});
