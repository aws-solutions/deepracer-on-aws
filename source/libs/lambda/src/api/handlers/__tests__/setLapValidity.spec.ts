// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  lapDao,
  runDao,
  TEST_EVENT_ID,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LAP_ITEM,
  TEST_LEADERBOARD_ID,
  TEST_RUN_ITEM,
} from '@deepracer-indy/database';
import { NotAuthorizedError, RunStatus, UserGroups } from '@deepracer-indy/typescript-server-client';
import { vi } from 'vitest';

import { cognitoClient } from '../../../utils/clients/cognitoClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import * as recalculateModule from '../../utils/recalculateScoreIfSubmitted.js';
import { SetLapValidityOperation } from '../setLapValidity.js';

vi.mock('@deepracer-indy/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepracer-indy/database')>();
  return {
    ...actual,
    runDao: { load: vi.fn<(typeof actual.runDao)['load']>() },
    lapDao: {
      load: vi.fn<(typeof actual.lapDao)['load']>(),
      partialUpdate: vi.fn<(typeof actual.lapDao)['partialUpdate']>(),
    },
  };
});

const mockRunDao = vi.mocked(runDao);
const mockLapDao = vi.mocked(lapDao);

const INPUT = {
  eventId: TEST_EVENT_ID,
  leaderboardId: TEST_LEADERBOARD_ID,
  runId: TEST_RUN_ITEM.runId,
  lapNumber: 1,
  isValid: false,
};

describe('SetLapValidity operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USER_POOL_ID = 'test-user-pool-id';
    vi.spyOn(recalculateModule, 'recalculateScoreIfSubmittedSafely').mockResolvedValue(undefined);
  });

  it('should throw NotFoundError when run does not exist', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockRejectedValue(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(SetLapValidityOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      TEST_ITEM_NOT_FOUND_ERROR,
    );
    expect(mockLapDao.partialUpdate).not.toHaveBeenCalled();
  });

  it('should throw NotAuthorizedError when caller is not admin or facilitator', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACERS }] }),
    );

    await expect(SetLapValidityOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new NotAuthorizedError({ message: 'Not authorized.' }),
    );
    expect(mockRunDao.load).not.toHaveBeenCalled();
    expect(mockLapDao.partialUpdate).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when the lap does not exist', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.IN_PROGRESS });
    mockLapDao.load.mockRejectedValue(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(SetLapValidityOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      TEST_ITEM_NOT_FOUND_ERROR,
    );
    expect(mockLapDao.partialUpdate).not.toHaveBeenCalled();
  });

  it('should update lap validity and return the updated lap', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACE_FACILITATORS }] }),
    );
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.IN_PROGRESS });
    mockLapDao.load.mockResolvedValue(TEST_LAP_ITEM);
    mockLapDao.partialUpdate.mockResolvedValue({ ...TEST_LAP_ITEM, isValid: false });

    const output = await SetLapValidityOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(mockRunDao.load).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ITEM.runId,
    });
    expect(mockLapDao.load).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ITEM.runId,
      lapNumber: 1,
    });
    expect(mockLapDao.partialUpdate).toHaveBeenCalledWith(
      { leaderboardId: TEST_LEADERBOARD_ID, runId: TEST_RUN_ITEM.runId, lapNumber: 1 },
      { isValid: false },
    );
    expect(output.lap.isValid).toBe(false);
    expect(output.rankingScore).toBeUndefined();
  });

  it('should trigger the score recalculation cascade and include rankingScore when the run is SUBMITTED', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    const submittedRun = { ...TEST_RUN_ITEM, runStatus: RunStatus.SUBMITTED };
    mockRunDao.load.mockResolvedValue(submittedRun);
    mockLapDao.load.mockResolvedValue(TEST_LAP_ITEM);
    mockLapDao.partialUpdate.mockResolvedValue({ ...TEST_LAP_ITEM, isValid: false });
    vi.spyOn(recalculateModule, 'recalculateScoreIfSubmittedSafely').mockResolvedValue(11000);

    const output = await SetLapValidityOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(recalculateModule.recalculateScoreIfSubmittedSafely).toHaveBeenCalledWith(submittedRun);
    expect(output.rankingScore).toBe(11000);
  });

  it('should still return the successfully-persisted validity change when the score recalculation cascade fails', async () => {
    // recalculateScoreIfSubmittedSafely never throws (it swallows cascade failures internally —
    // see its own unit tests), but this proves the handler doesn't assume that and would still
    // surface the persisted validity change even if resolution of the cascade came back empty.
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    const submittedRun = { ...TEST_RUN_ITEM, runStatus: RunStatus.SUBMITTED };
    mockRunDao.load.mockResolvedValue(submittedRun);
    mockLapDao.load.mockResolvedValue(TEST_LAP_ITEM);
    mockLapDao.partialUpdate.mockResolvedValue({ ...TEST_LAP_ITEM, isValid: false });
    vi.spyOn(recalculateModule, 'recalculateScoreIfSubmittedSafely').mockResolvedValue(undefined);

    const output = await SetLapValidityOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(output.lap.isValid).toBe(false);
    expect(output.rankingScore).toBeUndefined();
  });
});
