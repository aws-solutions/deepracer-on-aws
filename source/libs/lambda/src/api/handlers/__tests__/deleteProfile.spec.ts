// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourceId } from '@deepracer-indy/database';
import { BadRequestError, UserGroups } from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import { cognitoClient } from '../../../utils/clients/cognitoClient.js';
import { deleteUser } from '../../../utils/deleteUser.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { DeleteProfileOperation } from '../deleteProfile.js';

vi.mock('../../../utils/deleteUser.js');

describe('DeleteProfile operation', () => {
  const mockDeleteUser = vi.mocked(deleteUser);

  beforeEach(() => {
    mockDeleteUser.mockResolvedValue();
    vi.spyOn(logger, 'info').mockImplementation(vi.fn());
    vi.spyOn(metricsLogger, 'logDeleteProfile').mockImplementation(() => undefined);
    process.env.USER_POOL_ID = 'test-user-pool-id';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delete profile when user is admin', async () => {
    const profileId = 'admin-user-id' as ResourceId;
    const targetProfileId = 'target-user-id' as ResourceId;
    const input = { profileId: targetProfileId };
    const context = { ...TEST_OPERATION_CONTEXT, profileId };

    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );

    const result = await DeleteProfileOperation(input, context);

    expect(mockDeleteUser).toHaveBeenCalledWith(targetProfileId);
    expect(metricsLogger.logDeleteProfile).toHaveBeenCalledWith();
    expect(logger.info).toHaveBeenCalledWith('Deleting user profile');
    expect(logger.info).toHaveBeenCalledWith('Deleted user profile');
    expect(result).toEqual({});
  });

  it('should throw error when user is not admin', async () => {
    const profileId = 'regular-user-id' as ResourceId;
    const targetProfileId = 'target-user-id' as ResourceId;
    const input = { profileId: targetProfileId };
    const context = { ...TEST_OPERATION_CONTEXT, profileId };

    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACERS }] }),
    );

    await expect(DeleteProfileOperation(input, context)).rejects.toStrictEqual(
      new BadRequestError({ message: 'Only administrators can delete user profiles' }),
    );
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should throw error when cognito call fails', async () => {
    const profileId = 'user-id' as ResourceId;
    const targetProfileId = 'target-user-id' as ResourceId;
    const input = { profileId: targetProfileId };
    const context = { ...TEST_OPERATION_CONTEXT, profileId };

    vi.spyOn(cognitoClient, 'send').mockRejectedValue(new Error('Cognito error'));

    await expect(DeleteProfileOperation(input, context)).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Failed to verify user permissions.',
      }),
    );
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
