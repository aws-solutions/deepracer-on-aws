// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InternalFailureError, UserGroups } from '@deepracer-indy/typescript-server-client';

import { cognitoClient } from '../../../utils/clients/cognitoClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { UpdateGroupMembershipOperation } from '../updateGroupMembership.js';

interface TestInput {
  profileId: string;
  targetUserPoolGroup: UserGroups;
}

describe('UpdateGroupMembership', () => {
  beforeEach(() => {
    process.env.USER_POOL_ID = 'us-east-1_testpool';
  });

  afterEach(() => {
    delete process.env.USER_POOL_ID;
    vi.restoreAllMocks();
  });

  it('should update group membership successfully', async () => {
    let callCount = 0;
    vi.spyOn(cognitoClient, 'send').mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ Groups: [{ GroupName: 'dr-racers' }] });
      return Promise.resolve({});
    });

    const input: TestInput = { profileId: 'test-user', targetUserPoolGroup: UserGroups.ADMIN };
    const result = await UpdateGroupMembershipOperation(input, TEST_OPERATION_CONTEXT);

    expect(result).toEqual({});
    expect(cognitoClient.send).toHaveBeenCalledTimes(3);
  });

  it('should handle user with no current groups', async () => {
    let callCount = 0;
    vi.spyOn(cognitoClient, 'send').mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ Groups: [] });
      return Promise.resolve({});
    });

    const input: TestInput = { profileId: 'test-user', targetUserPoolGroup: UserGroups.ADMIN };
    const result = await UpdateGroupMembershipOperation(input, TEST_OPERATION_CONTEXT);

    expect(result).toEqual({});
    expect(cognitoClient.send).toHaveBeenCalledTimes(2);
  });

  it('should throw InternalFailureError when USER_POOL_ID is missing', async () => {
    delete process.env.USER_POOL_ID;

    const input: TestInput = { profileId: 'test-user', targetUserPoolGroup: UserGroups.ADMIN };

    await expect(UpdateGroupMembershipOperation(input, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new InternalFailureError({ message: 'Service configuration error.' }),
    );
  });

  it('should throw InternalFailureError if list groups fails', async () => {
    vi.spyOn(cognitoClient, 'send').mockRejectedValue(new Error('List failed'));

    const input: TestInput = { profileId: 'test-user', targetUserPoolGroup: UserGroups.ADMIN };

    await expect(UpdateGroupMembershipOperation(input, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new InternalFailureError({ message: 'Failed to remove user from groups.' }),
    );
  });

  it('should restore original groups when add to new group fails', async () => {
    let callCount = 0;
    vi.spyOn(cognitoClient, 'send').mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ Groups: [{ GroupName: 'dr-racers' }] });
      if (callCount === 2) return Promise.resolve({});
      if (callCount === 3) return Promise.reject(new Error('Add failed'));
      return Promise.resolve({});
    });

    const input: TestInput = { profileId: 'test-user', targetUserPoolGroup: UserGroups.ADMIN };

    await expect(UpdateGroupMembershipOperation(input, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new InternalFailureError({ message: 'Failed to add user to new group.' }),
    );

    expect(cognitoClient.send).toHaveBeenCalledTimes(4);
  });

  it('should throw error with failed group names when restoration fails', async () => {
    let callCount = 0;
    vi.spyOn(cognitoClient, 'send').mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return Promise.resolve({ Groups: [{ GroupName: 'dr-racers' }, { GroupName: 'dr-race-facilitators' }] });
      if (callCount === 2) return Promise.resolve({});
      if (callCount === 3) return Promise.resolve({});
      if (callCount === 4) return Promise.reject(new Error('Add failed'));
      if (callCount === 5) return Promise.reject(new Error('Restore first failed'));
      return Promise.resolve({});
    });

    const input: TestInput = { profileId: 'test-user', targetUserPoolGroup: UserGroups.ADMIN };

    await expect(UpdateGroupMembershipOperation(input, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new InternalFailureError({ message: 'Failed to restore membership in one or more groups.' }),
    );

    expect(cognitoClient.send).toHaveBeenCalledTimes(6);
  });
});
