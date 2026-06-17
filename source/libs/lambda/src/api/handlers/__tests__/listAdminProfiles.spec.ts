// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_PROFILE_ID_1, TEST_PROFILE_ID_2, profileDao } from '@deepracer-indy/database';
import { NotAuthorizedError, UserGroups } from '@deepracer-indy/typescript-server-client';
import { vi } from 'vitest';

import { cognitoClient } from '../../../utils/clients/cognitoClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListAdminProfilesOperation } from '../listAdminProfiles.js';

vi.mock('@deepracer-indy/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepracer-indy/database')>();
  return {
    ...actual,
    profileDao: {
      listProjected: vi.fn(),
    },
  };
});

const mockProfileDao = vi.mocked(profileDao);

type MockListProjectedReturn = Awaited<ReturnType<typeof profileDao.listProjected>>;

const MOCK_PROFILES: MockListProjectedReturn = [
  { profileId: TEST_PROFILE_ID_1, alias: 'Alice', emailAddress: 'alice@example.com', totalModelCount: 3 },
  { profileId: TEST_PROFILE_ID_2, alias: 'Bob', emailAddress: 'bob@example.com', totalModelCount: 1 },
] as MockListProjectedReturn;

describe('ListAdminProfiles operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USER_POOL_ID = 'test-user-pool-id';
  });

  it('should return profiles when caller is admin', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockProfileDao.listProjected.mockResolvedValue(MOCK_PROFILES);

    const result = await ListAdminProfilesOperation({}, TEST_OPERATION_CONTEXT);

    expect(result).toEqual({ profiles: MOCK_PROFILES });
    expect(mockProfileDao.listProjected).toHaveBeenCalledTimes(1);
  });

  it('should return profiles when caller is race facilitator', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACE_FACILITATORS }] }),
    );
    mockProfileDao.listProjected.mockResolvedValue(MOCK_PROFILES);

    const result = await ListAdminProfilesOperation({}, TEST_OPERATION_CONTEXT);

    expect(result).toEqual({ profiles: MOCK_PROFILES });
  });

  it('should throw NotAuthorizedError when caller is not admin or facilitator', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACERS }] }),
    );

    await expect(ListAdminProfilesOperation({}, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new NotAuthorizedError({ message: 'Not authorized.' }),
    );
    expect(mockProfileDao.listProjected).not.toHaveBeenCalled();
  });

  it('should return empty array when no profiles exist', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockProfileDao.listProjected.mockResolvedValue([]);

    const result = await ListAdminProfilesOperation({}, TEST_OPERATION_CONTEXT);

    expect(result).toEqual({ profiles: [] });
  });

  it('should propagate InternalFailureError from DAO', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockProfileDao.listProjected.mockRejectedValue(new Error('Failed to list profiles.'));

    await expect(ListAdminProfilesOperation({}, TEST_OPERATION_CONTEXT)).rejects.toThrow('Failed to list profiles.');
  });
});
