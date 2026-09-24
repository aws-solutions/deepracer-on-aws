// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  generateResourceId,
  lapDao,
  runDao,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LAP_ITEMS,
  TEST_LEADERBOARD_ID,
  TEST_RUN_ID,
  TEST_RUN_ITEM,
} from '@deepracer-indy/database';
import { NotAuthorizedError, NotFoundError } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetRunOperation } from '../getRun.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserMemberOf: (...args: unknown[]) => mockIsUserMemberOf(...args) };
});

const mockIsUserMemberOf = vi.fn().mockResolvedValue(true);

describe('GetRun operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserMemberOf.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError when caller is not a member of any allowed group', async () => {
    const loadSpy = vi.spyOn(runDao, 'load');
    mockIsUserMemberOf.mockResolvedValueOnce(false);

    await expect(
      GetRunOperation(
        { eventId: TEST_RUN_ITEM.eventId, leaderboardId: TEST_LEADERBOARD_ID, runId: TEST_RUN_ID },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toThrow(NotAuthorizedError);
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('should return the run with laps inline', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue(TEST_RUN_ITEM);
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({ data: TEST_LAP_ITEMS, cursor: null });

    const output = await GetRunOperation(
      { eventId: TEST_RUN_ITEM.eventId, leaderboardId: TEST_LEADERBOARD_ID, runId: TEST_RUN_ID },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.run.runId).toEqual(TEST_RUN_ITEM.runId);
    expect(output.laps).toHaveLength(TEST_LAP_ITEMS.length);
    expect(output.laps[0]).toMatchObject({
      lapNumber: TEST_LAP_ITEMS[0].lapNumber,
      lapTimeMs: TEST_LAP_ITEMS[0].lapTimeMs,
    });
  });

  it('should return an empty laps array when the run has no laps yet', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue(TEST_RUN_ITEM);
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({ data: [], cursor: null });

    const output = await GetRunOperation(
      { eventId: TEST_RUN_ITEM.eventId, leaderboardId: TEST_LEADERBOARD_ID, runId: TEST_RUN_ID },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.laps).toEqual([]);
  });

  it('should query laps scoped to the leaderboard and run', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue(TEST_RUN_ITEM);
    const listAllLapsByRunSpy = vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({ data: [], cursor: null });

    await GetRunOperation(
      { eventId: TEST_RUN_ITEM.eventId, leaderboardId: TEST_LEADERBOARD_ID, runId: TEST_RUN_ID },
      TEST_OPERATION_CONTEXT,
    );

    expect(listAllLapsByRunSpy).toHaveBeenCalledWith({ leaderboardId: TEST_LEADERBOARD_ID, runId: TEST_RUN_ID });
  });

  it('should throw NotFoundError if the run does not exist', async () => {
    vi.spyOn(runDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      GetRunOperation(
        { eventId: TEST_RUN_ITEM.eventId, leaderboardId: TEST_LEADERBOARD_ID, runId: TEST_RUN_ID },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });

  it('should throw NotFoundError if the run belongs to a different event than the one in the path', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue(TEST_RUN_ITEM);
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({ data: [], cursor: null });

    await expect(
      GetRunOperation(
        { eventId: generateResourceId(), leaderboardId: TEST_LEADERBOARD_ID, runId: TEST_RUN_ID },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
