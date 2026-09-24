// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  eventDao,
  runDao,
  submissionDao,
  TEST_EVENT_ID,
  TEST_EVENT_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LEADERBOARD_ID,
  TEST_PROFILE_ID_1,
  TEST_RUN_ITEM,
  TEST_SUBMISSION_ITEM,
} from '@deepracer-indy/database';
import { ConflictError, EventStatus, NotAuthorizedError, RunStatus } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { CreateRunOperation } from '../createRun.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args) };
});

const mockIsUserAdminOrFacilitator = vi.fn().mockResolvedValue(true);

const IN_PROGRESS_EVENT = { ...TEST_EVENT_ITEM, eventStatus: EventStatus.IN_PROGRESS };

describe('CreateRun operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError when caller is not admin or facilitator', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);

    await expect(
      CreateRunOperation(
        { eventId: TEST_EVENT_ID, leaderboardId: TEST_LEADERBOARD_ID, profileId: TEST_PROFILE_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toThrow(NotAuthorizedError);
  });

  it('should create a run in READY status and return it', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(IN_PROGRESS_EVENT);
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValue({ data: [], cursor: null });
    vi.spyOn(runDao, 'create').mockResolvedValue(TEST_RUN_ITEM);

    const output = await CreateRunOperation(
      { eventId: TEST_EVENT_ID, leaderboardId: TEST_LEADERBOARD_ID, profileId: TEST_PROFILE_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.run.runId).toEqual(TEST_RUN_ITEM.runId);
    expect(output.run.runStatus).toEqual(RunStatus.READY);
  });

  it('should pass racedByProxy through to the created run, defaulting to false', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(IN_PROGRESS_EVENT);
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValue({ data: [], cursor: null });
    const createSpy = vi.spyOn(runDao, 'create').mockResolvedValue(TEST_RUN_ITEM);

    await CreateRunOperation(
      { eventId: TEST_EVENT_ID, leaderboardId: TEST_LEADERBOARD_ID, profileId: TEST_PROFILE_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ racedByProxy: false }));

    await CreateRunOperation(
      {
        eventId: TEST_EVENT_ID,
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
        racedByProxy: true,
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ racedByProxy: true }));
  });

  it('should throw ConflictError if the event is not IN_PROGRESS', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue({ ...TEST_EVENT_ITEM, eventStatus: EventStatus.OPEN });

    await expect(
      CreateRunOperation(
        { eventId: TEST_EVENT_ID, leaderboardId: TEST_LEADERBOARD_ID, profileId: TEST_PROFILE_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('should throw ConflictError if the racer has exhausted maxRunsPerRacer', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue({ ...IN_PROGRESS_EVENT, maxRunsPerRacer: 2 });
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValue({
      data: [{ ...TEST_SUBMISSION_ITEM, submissionNumber: 2 }],
      cursor: null,
    });

    await expect(
      CreateRunOperation(
        { eventId: TEST_EVENT_ID, leaderboardId: TEST_LEADERBOARD_ID, profileId: TEST_PROFILE_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('should allow run creation when under the maxRunsPerRacer limit', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue({ ...IN_PROGRESS_EVENT, maxRunsPerRacer: 2 });
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValue({
      data: [{ ...TEST_SUBMISSION_ITEM, submissionNumber: 1 }],
      cursor: null,
    });
    vi.spyOn(runDao, 'create').mockResolvedValue(TEST_RUN_ITEM);

    const output = await CreateRunOperation(
      { eventId: TEST_EVENT_ID, leaderboardId: TEST_LEADERBOARD_ID, profileId: TEST_PROFILE_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.run.runId).toEqual(TEST_RUN_ITEM.runId);
  });

  it('should throw ConflictError when maxRunsPerRacer is 0 (racer immediately at the limit)', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue({ ...IN_PROGRESS_EVENT, maxRunsPerRacer: 0 });
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValue({ data: [], cursor: null });

    await expect(
      CreateRunOperation(
        { eventId: TEST_EVENT_ID, leaderboardId: TEST_LEADERBOARD_ID, profileId: TEST_PROFILE_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('should allow run creation when maxRunsPerRacer is undefined (unlimited runs)', async () => {
    const { maxRunsPerRacer: _ignored, ...eventWithoutLimit } = IN_PROGRESS_EVENT;
    vi.spyOn(eventDao, 'load').mockResolvedValue(eventWithoutLimit);
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValue({
      data: [{ ...TEST_SUBMISSION_ITEM, submissionNumber: 500 }],
      cursor: null,
    });
    vi.spyOn(runDao, 'create').mockResolvedValue(TEST_RUN_ITEM);

    const output = await CreateRunOperation(
      { eventId: TEST_EVENT_ID, leaderboardId: TEST_LEADERBOARD_ID, profileId: TEST_PROFILE_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.run.runId).toEqual(TEST_RUN_ITEM.runId);
  });

  it('should throw NotFoundError if the event does not exist', async () => {
    vi.spyOn(eventDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      CreateRunOperation(
        { eventId: TEST_EVENT_ID, leaderboardId: TEST_LEADERBOARD_ID, profileId: TEST_PROFILE_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });
});
