// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { runDao, TEST_LEADERBOARD_ID, TEST_RUN_ITEM } from '@deepracer-indy/database';
import { NotAuthorizedError, RunStatus } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListRunsOperation } from '../listRuns.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserMemberOf: (...args: unknown[]) => mockIsUserMemberOf(...args) };
});

const mockIsUserMemberOf = vi.fn().mockResolvedValue(true);

describe('ListRuns operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserMemberOf.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError when caller is not a member of any allowed group', async () => {
    const listSpy = vi.spyOn(runDao, 'list');
    mockIsUserMemberOf.mockResolvedValueOnce(false);

    await expect(
      ListRunsOperation({ eventId: TEST_RUN_ITEM.eventId, leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotAuthorizedError);
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('should return a list of runs without inline laps', async () => {
    vi.spyOn(runDao, 'list').mockResolvedValue({ cursor: null, data: [TEST_RUN_ITEM] });

    const output = await ListRunsOperation(
      { eventId: TEST_RUN_ITEM.eventId, leaderboardId: TEST_LEADERBOARD_ID },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.runs).toHaveLength(1);
    expect(output.runs[0].runId).toEqual(TEST_RUN_ITEM.runId);
    expect(output.runs[0]).not.toHaveProperty('laps');
  });

  it('should forward the status filter to the DAO', async () => {
    const listSpy = vi.spyOn(runDao, 'list').mockResolvedValue({ cursor: null, data: [] });

    await ListRunsOperation(
      { eventId: TEST_RUN_ITEM.eventId, leaderboardId: TEST_LEADERBOARD_ID, status: RunStatus.SUBMITTED },
      TEST_OPERATION_CONTEXT,
    );

    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ leaderboardId: TEST_LEADERBOARD_ID, status: RunStatus.SUBMITTED }),
    );
  });

  it('should forward the eventId filter to the DAO so pagination stays consistent', async () => {
    const listSpy = vi.spyOn(runDao, 'list').mockResolvedValue({ cursor: null, data: [TEST_RUN_ITEM] });

    await ListRunsOperation(
      { eventId: TEST_RUN_ITEM.eventId, leaderboardId: TEST_LEADERBOARD_ID },
      TEST_OPERATION_CONTEXT,
    );

    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ leaderboardId: TEST_LEADERBOARD_ID, eventId: TEST_RUN_ITEM.eventId }),
    );
  });

  it('should forward pagination token', async () => {
    const listSpy = vi.spyOn(runDao, 'list').mockResolvedValue({ cursor: 'next-token', data: [TEST_RUN_ITEM] });

    const output = await ListRunsOperation(
      { eventId: TEST_RUN_ITEM.eventId, leaderboardId: TEST_LEADERBOARD_ID, token: 'some-token' },
      TEST_OPERATION_CONTEXT,
    );

    expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'some-token' }));
    expect(output.token).toEqual('next-token');
  });

  it('should return undefined token when no next page', async () => {
    vi.spyOn(runDao, 'list').mockResolvedValue({ cursor: null, data: [] });

    const output = await ListRunsOperation(
      { eventId: TEST_RUN_ITEM.eventId, leaderboardId: TEST_LEADERBOARD_ID },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.token).toBeUndefined();
  });
});
