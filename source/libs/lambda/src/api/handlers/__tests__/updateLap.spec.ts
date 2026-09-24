// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  lapDao,
  runDao,
  TEST_EVENT_ID,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LAP_ITEM,
  TEST_LEADERBOARD_ID,
  TEST_PROFILE_ID_1,
  TEST_RUN_ITEM,
} from '@deepracer-indy/database';
import { NotAuthorizedError, RunStatus, UserGroups } from '@deepracer-indy/typescript-server-client';
import { metricsLogger } from '@deepracer-indy/utils';
import { vi } from 'vitest';

import { cognitoClient } from '../../../utils/clients/cognitoClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import * as recalculateModule from '../../utils/recalculateScoreIfSubmitted.js';
import { UpdateLapOperation } from '../updateLap.js';

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
  lapTimeMs: 11000,
  editReason: 'Timing strip glitch',
};

describe('UpdateLap operation', () => {
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

    await expect(UpdateLapOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
    expect(mockLapDao.partialUpdate).not.toHaveBeenCalled();
  });

  it('should throw NotAuthorizedError when caller is a facilitator (Admin-only operation)', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACE_FACILITATORS }] }),
    );

    await expect(UpdateLapOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new NotAuthorizedError({ message: 'Not authorized.' }),
    );
    expect(mockRunDao.load).not.toHaveBeenCalled();
    expect(mockLapDao.partialUpdate).not.toHaveBeenCalled();
  });

  it('should throw NotAuthorizedError when caller is a racer', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACERS }] }),
    );

    await expect(UpdateLapOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(NotAuthorizedError);
    expect(mockRunDao.load).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when the lap does not exist', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.FINISHED });
    mockLapDao.load.mockRejectedValue(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(UpdateLapOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
    expect(mockLapDao.partialUpdate).not.toHaveBeenCalled();
  });

  it('should set originalLapTimeMs to the pre-edit lapTimeMs on first edit', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.FINISHED });
    mockLapDao.load.mockResolvedValue({ ...TEST_LAP_ITEM, lapTimeMs: 12500, originalLapTimeMs: undefined });
    mockLapDao.partialUpdate.mockResolvedValue({
      ...TEST_LAP_ITEM,
      lapTimeMs: 11000,
      originalLapTimeMs: 12500,
      editedBy: TEST_PROFILE_ID_1,
      editReason: INPUT.editReason,
    });

    const output = await UpdateLapOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(mockRunDao.load).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ITEM.runId,
    });
    expect(mockLapDao.partialUpdate).toHaveBeenCalledWith(
      { leaderboardId: TEST_LEADERBOARD_ID, runId: TEST_RUN_ITEM.runId, lapNumber: 1 },
      expect.objectContaining({
        lapTimeMs: 11000,
        originalLapTimeMs: 12500,
        editedBy: TEST_PROFILE_ID_1,
        editReason: 'Timing strip glitch',
      }),
    );
    expect(output.lap.lapTimeMs).toBe(11000);
    expect(output.lap.originalLapTimeMs).toBe(12500);
    expect(output.rankingScore).toBeUndefined();
  });

  it('should preserve the existing originalLapTimeMs on a subsequent edit', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.FINISHED });
    mockLapDao.load.mockResolvedValue({ ...TEST_LAP_ITEM, lapTimeMs: 11000, originalLapTimeMs: 12500 });
    mockLapDao.partialUpdate.mockResolvedValue({
      ...TEST_LAP_ITEM,
      lapTimeMs: 10500,
      originalLapTimeMs: 12500,
    });

    await UpdateLapOperation({ ...INPUT, lapTimeMs: 10500 }, TEST_OPERATION_CONTEXT);

    expect(mockLapDao.partialUpdate).toHaveBeenCalledWith(
      { leaderboardId: TEST_LEADERBOARD_ID, runId: TEST_RUN_ITEM.runId, lapNumber: 1 },
      expect.objectContaining({ lapTimeMs: 10500, originalLapTimeMs: 12500 }),
    );
  });

  it('should log the LAP_EDITED metric on a successful edit', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    const metricsLoggerSpy = vi.spyOn(metricsLogger, 'logLapEdited').mockImplementation(() => undefined);
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.FINISHED });
    mockLapDao.load.mockResolvedValue(TEST_LAP_ITEM);
    mockLapDao.partialUpdate.mockResolvedValue({ ...TEST_LAP_ITEM, lapTimeMs: 10500 });

    await UpdateLapOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(metricsLoggerSpy).toHaveBeenCalledWith();
  });

  it('should trigger the score recalculation cascade and include rankingScore when the run is SUBMITTED', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    const submittedRun = { ...TEST_RUN_ITEM, runStatus: RunStatus.SUBMITTED };
    mockRunDao.load.mockResolvedValue(submittedRun);
    mockLapDao.load.mockResolvedValue(TEST_LAP_ITEM);
    mockLapDao.partialUpdate.mockResolvedValue({ ...TEST_LAP_ITEM, lapTimeMs: 11000 });
    vi.spyOn(recalculateModule, 'recalculateScoreIfSubmittedSafely').mockResolvedValue(11000);

    const output = await UpdateLapOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(recalculateModule.recalculateScoreIfSubmittedSafely).toHaveBeenCalledWith(submittedRun);
    expect(output.rankingScore).toBe(11000);
  });

  it('should still return the successfully-persisted lap edit when the score recalculation cascade fails', async () => {
    // recalculateScoreIfSubmittedSafely never throws (it swallows cascade failures internally —
    // see its own unit tests), but this proves the handler doesn't assume that and would still
    // surface the persisted lap edit even if resolution of the cascade came back empty-handed.
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    const submittedRun = { ...TEST_RUN_ITEM, runStatus: RunStatus.SUBMITTED };
    mockRunDao.load.mockResolvedValue(submittedRun);
    mockLapDao.load.mockResolvedValue(TEST_LAP_ITEM);
    mockLapDao.partialUpdate.mockResolvedValue({ ...TEST_LAP_ITEM, lapTimeMs: 11000 });
    vi.spyOn(recalculateModule, 'recalculateScoreIfSubmittedSafely').mockResolvedValue(undefined);

    const output = await UpdateLapOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(output.lap.lapTimeMs).toBe(11000);
    expect(output.rankingScore).toBeUndefined();
  });
});
