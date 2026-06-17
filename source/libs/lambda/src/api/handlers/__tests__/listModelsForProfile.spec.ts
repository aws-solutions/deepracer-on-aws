// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_MODEL_ITEMS, TEST_PROFILE_ID_2, modelDao } from '@deepracer-indy/database';
import { NotAuthorizedError, UserGroups } from '@deepracer-indy/typescript-server-client';
import { vi } from 'vitest';

import { cognitoClient } from '../../../utils/clients/cognitoClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListModelsForProfileOperation } from '../listModelsForProfile.js';

vi.mock('@deepracer-indy/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepracer-indy/database')>();
  return { ...actual, modelDao: { listAll: vi.fn() } };
});

const mockModelDao = vi.mocked(modelDao);
const INPUT = { profileId: TEST_PROFILE_ID_2 };

describe('ListModelsForProfile operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USER_POOL_ID = 'test-user-pool-id';
  });

  it('should throw NotAuthorizedError when caller is not admin or facilitator', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACERS }] }),
    );

    await expect(ListModelsForProfileOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new NotAuthorizedError({ message: 'Not authorized.' }),
    );
    expect(mockModelDao.listAll).not.toHaveBeenCalled();
  });

  it('should return empty list when profile does not exist', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockModelDao.listAll.mockResolvedValue({ data: [], cursor: null });

    const result = await ListModelsForProfileOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(result.models).toEqual([]);
  });

  it('should return all models with correct fields', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockModelDao.listAll.mockResolvedValue({ data: TEST_MODEL_ITEMS, cursor: null });

    const result = await ListModelsForProfileOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(result.models).toHaveLength(TEST_MODEL_ITEMS.length);
    result.models.forEach((model, i) => {
      expect(model).toEqual({
        modelId: TEST_MODEL_ITEMS[i].modelId,
        name: TEST_MODEL_ITEMS[i].name,
        status: TEST_MODEL_ITEMS[i].status,
        createdAt: new Date(TEST_MODEL_ITEMS[i].createdAt),
      });
    });
  });

  it('should work for race facilitator caller', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACE_FACILITATORS }] }),
    );
    mockModelDao.listAll.mockResolvedValue({ data: TEST_MODEL_ITEMS, cursor: null });

    const result = await ListModelsForProfileOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(result.models).toHaveLength(TEST_MODEL_ITEMS.length);
    expect(mockModelDao.listAll).toHaveBeenCalledTimes(1);
  });

  it('should propagate DynamoDB errors from modelDao', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockModelDao.listAll.mockRejectedValue(new Error('DynamoDB error'));

    await expect(ListModelsForProfileOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toThrow('DynamoDB error');
  });
});
