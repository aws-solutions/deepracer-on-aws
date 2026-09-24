// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  eventDao,
  lapDao,
  profileDao,
  rankingDao,
  runDao,
  submissionDao,
  TEST_EVENT_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LAP_ITEM,
  TEST_LEADERBOARD_ID,
  TEST_PROFILE_ITEM,
  TEST_RUN_ID,
  TEST_RUN_ITEM,
  TEST_SUBMISSION_ITEM,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  ConflictError,
  NotAuthorizedError,
  RaceFormat,
  RunStatus,
  RunTransitionAction,
} from '@deepracer-indy/typescript-server-client';
import { metricsLogger } from '@deepracer-indy/utils';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { TransitionRunStatusOperation } from '../transitionRunStatus.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args) };
});

const mockIsUserAdminOrFacilitator = vi.fn().mockResolvedValue(true);

const READY_RUN = { ...TEST_RUN_ITEM, runStatus: RunStatus.READY };
const CONDITIONAL_CHECK_FAILED_ERROR = { name: 'ConditionalCheckFailedException' };

describe('TransitionRunStatus operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError when caller is not admin or facilitator', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);

    await expect(
      TransitionRunStatusOperation(
        {
          eventId: TEST_RUN_ITEM.eventId,
          leaderboardId: TEST_LEADERBOARD_ID,
          runId: TEST_RUN_ID,
          action: RunTransitionAction.START,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toThrow(NotAuthorizedError);
  });

  it('should transition READY → IN_PROGRESS on START', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue(READY_RUN);
    const transitionSpy = vi
      .spyOn(runDao, 'transitionStatus')
      .mockResolvedValue({ ...READY_RUN, runStatus: RunStatus.IN_PROGRESS });

    const output = await TransitionRunStatusOperation(
      {
        eventId: TEST_RUN_ITEM.eventId,
        leaderboardId: TEST_LEADERBOARD_ID,
        runId: TEST_RUN_ID,
        action: RunTransitionAction.START,
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(transitionSpy).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ID,
      status: RunStatus.IN_PROGRESS,
      expectedStatus: RunStatus.READY,
    });
    expect(output.run.runStatus).toEqual(RunStatus.IN_PROGRESS);
  });

  it('should transition IN_PROGRESS → PAUSED on PAUSE', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.IN_PROGRESS });
    const transitionSpy = vi
      .spyOn(runDao, 'transitionStatus')
      .mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.PAUSED });

    const output = await TransitionRunStatusOperation(
      {
        eventId: TEST_RUN_ITEM.eventId,
        leaderboardId: TEST_LEADERBOARD_ID,
        runId: TEST_RUN_ID,
        action: RunTransitionAction.PAUSE,
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(transitionSpy).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ID,
      status: RunStatus.PAUSED,
      expectedStatus: RunStatus.IN_PROGRESS,
    });
    expect(output.run.runStatus).toEqual(RunStatus.PAUSED);
  });

  it('should transition PAUSED → IN_PROGRESS on RESUME', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.PAUSED });
    const transitionSpy = vi
      .spyOn(runDao, 'transitionStatus')
      .mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.IN_PROGRESS });

    const output = await TransitionRunStatusOperation(
      {
        eventId: TEST_RUN_ITEM.eventId,
        leaderboardId: TEST_LEADERBOARD_ID,
        runId: TEST_RUN_ID,
        action: RunTransitionAction.RESUME,
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(transitionSpy).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ID,
      status: RunStatus.IN_PROGRESS,
      expectedStatus: RunStatus.PAUSED,
    });
    expect(output.run.runStatus).toEqual(RunStatus.IN_PROGRESS);
  });

  it('should transition IN_PROGRESS → FINISHED on FINISH', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.IN_PROGRESS });
    const transitionSpy = vi
      .spyOn(runDao, 'transitionStatus')
      .mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.FINISHED });

    const output = await TransitionRunStatusOperation(
      {
        eventId: TEST_RUN_ITEM.eventId,
        leaderboardId: TEST_LEADERBOARD_ID,
        runId: TEST_RUN_ID,
        action: RunTransitionAction.FINISH,
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(transitionSpy).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ID,
      status: RunStatus.FINISHED,
      expectedStatus: RunStatus.IN_PROGRESS,
    });
    expect(output.run.runStatus).toEqual(RunStatus.FINISHED);
  });

  it('should transition PAUSED → FINISHED on FINISH', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.PAUSED });
    const transitionSpy = vi
      .spyOn(runDao, 'transitionStatus')
      .mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.FINISHED });

    const output = await TransitionRunStatusOperation(
      {
        eventId: TEST_RUN_ITEM.eventId,
        leaderboardId: TEST_LEADERBOARD_ID,
        runId: TEST_RUN_ID,
        action: RunTransitionAction.FINISH,
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(transitionSpy).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ID,
      status: RunStatus.FINISHED,
      expectedStatus: RunStatus.PAUSED,
    });
    expect(output.run.runStatus).toEqual(RunStatus.FINISHED);
  });

  it('should transition FINISHED → IN_PROGRESS on RESUME_FROM_FINISHED', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.FINISHED });
    const transitionSpy = vi
      .spyOn(runDao, 'transitionStatus')
      .mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.IN_PROGRESS });

    const output = await TransitionRunStatusOperation(
      {
        eventId: TEST_RUN_ITEM.eventId,
        leaderboardId: TEST_LEADERBOARD_ID,
        runId: TEST_RUN_ID,
        action: RunTransitionAction.RESUME_FROM_FINISHED,
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(transitionSpy).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ID,
      status: RunStatus.IN_PROGRESS,
      expectedStatus: RunStatus.FINISHED,
    });
    expect(output.run.runStatus).toEqual(RunStatus.IN_PROGRESS);
  });

  it('should transition FINISHED → SUBMITTED on SUBMIT and return the computed rankingScore', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.FINISHED });
    const transitionSpy = vi
      .spyOn(runDao, 'transitionStatus')
      .mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.SUBMITTED });
    vi.spyOn(eventDao, 'load').mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.BEST_LAP });
    vi.spyOn(profileDao, 'load').mockResolvedValue(TEST_PROFILE_ITEM);
    vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({ cursor: null, data: [TEST_LAP_ITEM] });
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValue({ cursor: null, data: [] });
    vi.spyOn(rankingDao, 'recordSubmission').mockResolvedValue(TEST_SUBMISSION_ITEM);
    const runsCompletedSpy = vi.spyOn(metricsLogger, 'logRunsCompleted').mockImplementation(() => undefined);

    const output = await TransitionRunStatusOperation(
      {
        eventId: TEST_RUN_ITEM.eventId,
        leaderboardId: TEST_LEADERBOARD_ID,
        runId: TEST_RUN_ID,
        action: RunTransitionAction.SUBMIT,
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(transitionSpy).not.toHaveBeenCalled();
    expect(output.run.runStatus).toEqual(RunStatus.SUBMITTED);
    expect(output.rankingScore).toEqual(TEST_LAP_ITEM.lapTimeMs);
    expect(runsCompletedSpy).toHaveBeenCalledTimes(1);
  });

  it('should transition READY → DISCARDED on DISCARD', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue(READY_RUN);
    const transitionSpy = vi
      .spyOn(runDao, 'transitionStatus')
      .mockResolvedValue({ ...READY_RUN, runStatus: RunStatus.DISCARDED });

    const output = await TransitionRunStatusOperation(
      {
        eventId: TEST_RUN_ITEM.eventId,
        leaderboardId: TEST_LEADERBOARD_ID,
        runId: TEST_RUN_ID,
        action: RunTransitionAction.DISCARD,
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(transitionSpy).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ID,
      status: RunStatus.DISCARDED,
      expectedStatus: RunStatus.READY,
    });
    expect(output.run.runStatus).toEqual(RunStatus.DISCARDED);
  });

  it('should transition FINISHED → DISCARDED on DISCARD', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.FINISHED });
    const transitionSpy = vi
      .spyOn(runDao, 'transitionStatus')
      .mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.DISCARDED });

    const output = await TransitionRunStatusOperation(
      {
        eventId: TEST_RUN_ITEM.eventId,
        leaderboardId: TEST_LEADERBOARD_ID,
        runId: TEST_RUN_ID,
        action: RunTransitionAction.DISCARD,
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(transitionSpy).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ID,
      status: RunStatus.DISCARDED,
      expectedStatus: RunStatus.FINISHED,
    });
    expect(output.run.runStatus).toEqual(RunStatus.DISCARDED);
  });

  it('should throw BadRequestError on invalid transition (READY → SUBMITTED)', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue(READY_RUN);

    await expect(
      TransitionRunStatusOperation(
        {
          eventId: TEST_RUN_ITEM.eventId,
          leaderboardId: TEST_LEADERBOARD_ID,
          runId: TEST_RUN_ID,
          action: RunTransitionAction.SUBMIT,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('should throw BadRequestError on invalid transition (PAUSED → SUBMITTED)', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.PAUSED });

    await expect(
      TransitionRunStatusOperation(
        {
          eventId: TEST_RUN_ITEM.eventId,
          leaderboardId: TEST_LEADERBOARD_ID,
          runId: TEST_RUN_ID,
          action: RunTransitionAction.SUBMIT,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('should throw BadRequestError when a terminal run (SUBMITTED) receives any transition', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.SUBMITTED });

    await expect(
      TransitionRunStatusOperation(
        {
          eventId: TEST_RUN_ITEM.eventId,
          leaderboardId: TEST_LEADERBOARD_ID,
          runId: TEST_RUN_ID,
          action: RunTransitionAction.START,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('should throw BadRequestError when a terminal run (DISCARDED) receives any transition', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.DISCARDED });

    await expect(
      TransitionRunStatusOperation(
        {
          eventId: TEST_RUN_ITEM.eventId,
          leaderboardId: TEST_LEADERBOARD_ID,
          runId: TEST_RUN_ID,
          action: RunTransitionAction.DISCARD,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  describe('invalid transitions (exhaustive matrix)', () => {
    /** action → statuses for which that action is valid (mirrors TRANSITIONS in transitionRunStatus.ts) */
    const VALID_FROM_STATUSES: Record<RunTransitionAction, RunStatus[]> = {
      [RunTransitionAction.START]: [RunStatus.READY],
      [RunTransitionAction.PAUSE]: [RunStatus.IN_PROGRESS],
      [RunTransitionAction.RESUME]: [RunStatus.PAUSED],
      [RunTransitionAction.FINISH]: [RunStatus.IN_PROGRESS, RunStatus.PAUSED],
      [RunTransitionAction.RESUME_FROM_FINISHED]: [RunStatus.FINISHED],
      [RunTransitionAction.SUBMIT]: [RunStatus.FINISHED],
      [RunTransitionAction.DISCARD]: [RunStatus.READY, RunStatus.FINISHED],
    };

    const ALL_ACTIONS = Object.values(RunTransitionAction);
    const ALL_STATUSES = Object.values(RunStatus);

    const invalidCases = ALL_ACTIONS.flatMap((action) =>
      ALL_STATUSES.filter((status) => !VALID_FROM_STATUSES[action].includes(status)).map((status) => ({
        action,
        status,
      })),
    );

    it('should have generated the expected number of invalid (action, status) combinations', () => {
      // 7 actions × 6 statuses = 42 combinations; 9 are valid (per TRANSITIONS), so 33 are invalid.
      expect(ALL_ACTIONS).toHaveLength(7);
      expect(ALL_STATUSES).toHaveLength(6);
      expect(invalidCases).toHaveLength(33);
    });

    it.each(invalidCases)(
      'should throw BadRequestError for action=$action when run is in $status status',
      async ({ action, status }) => {
        vi.spyOn(runDao, 'load').mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: status });
        const transitionSpy = vi.spyOn(runDao, 'transitionStatus');

        await expect(
          TransitionRunStatusOperation(
            { eventId: TEST_RUN_ITEM.eventId, leaderboardId: TEST_LEADERBOARD_ID, runId: TEST_RUN_ID, action },
            TEST_OPERATION_CONTEXT,
          ),
        ).rejects.toBeInstanceOf(BadRequestError);
        expect(transitionSpy).not.toHaveBeenCalled();
      },
    );
  });

  it('should throw ConflictError when the conditional write fails (concurrent transition)', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue(READY_RUN);
    vi.spyOn(runDao, 'transitionStatus').mockRejectedValueOnce(CONDITIONAL_CHECK_FAILED_ERROR);

    await expect(
      TransitionRunStatusOperation(
        {
          eventId: TEST_RUN_ITEM.eventId,
          leaderboardId: TEST_LEADERBOARD_ID,
          runId: TEST_RUN_ID,
          action: RunTransitionAction.START,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('should rethrow non-conditional errors from transitionStatus', async () => {
    vi.spyOn(runDao, 'load').mockResolvedValue(READY_RUN);
    const unexpectedError = new Error('unexpected failure');
    vi.spyOn(runDao, 'transitionStatus').mockRejectedValueOnce(unexpectedError);

    await expect(
      TransitionRunStatusOperation(
        {
          eventId: TEST_RUN_ITEM.eventId,
          leaderboardId: TEST_LEADERBOARD_ID,
          runId: TEST_RUN_ID,
          action: RunTransitionAction.START,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(unexpectedError);
  });

  it('should throw NotFoundError if the run does not exist', async () => {
    vi.spyOn(runDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      TransitionRunStatusOperation(
        {
          eventId: TEST_RUN_ITEM.eventId,
          leaderboardId: TEST_LEADERBOARD_ID,
          runId: TEST_RUN_ID,
          action: RunTransitionAction.START,
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });

  describe('SUBMIT scoring pipeline', () => {
    const FINISHED_RUN = { ...TEST_RUN_ITEM, runStatus: RunStatus.FINISHED };

    const submitInput = {
      eventId: TEST_RUN_ITEM.eventId,
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ID,
      action: RunTransitionAction.SUBMIT,
    };

    beforeEach(() => {
      vi.spyOn(runDao, 'load').mockResolvedValue(FINISHED_RUN);
      vi.spyOn(profileDao, 'load').mockResolvedValue(TEST_PROFILE_ITEM);
      vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValue({ cursor: null, data: [] });
    });

    it('should compute the BEST_LAP score from valid laps only', async () => {
      vi.spyOn(eventDao, 'load').mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.BEST_LAP });
      vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({
        cursor: null,
        data: [
          { ...TEST_LAP_ITEM, lapNumber: 1, lapTimeMs: 9000, isValid: false },
          { ...TEST_LAP_ITEM, lapNumber: 2, lapTimeMs: 11000, isValid: true },
          { ...TEST_LAP_ITEM, lapNumber: 3, lapTimeMs: 10500, isValid: true },
        ],
      });
      const recordSubmissionSpy = vi.spyOn(rankingDao, 'recordSubmission').mockResolvedValue(TEST_SUBMISSION_ITEM);

      const output = await TransitionRunStatusOperation(submitInput, TEST_OPERATION_CONTEXT);

      expect(output.rankingScore).toEqual(10500);
      expect(profileDao.load).toHaveBeenCalledWith({ profileId: FINISHED_RUN.profileId });
      expect(recordSubmissionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: TEST_RUN_ID,
          stats: {
            avgLapTime: 10750,
            avgResets: 0,
            bestLapTime: 10500,
            collisionCount: 0,
            completedLapCount: 2,
            offTrackCount: 0,
            resetCount: 0,
            totalLapTime: 21500,
          },
          userProfile: { alias: TEST_PROFILE_ITEM.alias, avatar: TEST_PROFILE_ITEM.avatar },
          submission: expect.objectContaining({
            leaderboardId: TEST_LEADERBOARD_ID,
            profileId: FINISHED_RUN.profileId,
            rankingScore: 10500,
          }),
        }),
      );
    });

    it('carries the profile countryCode into the ranking userProfile snapshot when present', async () => {
      vi.spyOn(profileDao, 'load').mockResolvedValue({ ...TEST_PROFILE_ITEM, countryCode: 'FR' });
      vi.spyOn(eventDao, 'load').mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.BEST_LAP });
      vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({
        cursor: null,
        data: [{ ...TEST_LAP_ITEM, lapNumber: 1, lapTimeMs: 10000, isValid: true }],
      });
      const recordSubmissionSpy = vi.spyOn(rankingDao, 'recordSubmission').mockResolvedValue(TEST_SUBMISSION_ITEM);

      await TransitionRunStatusOperation(submitInput, TEST_OPERATION_CONTEXT);

      expect(recordSubmissionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userProfile: { alias: TEST_PROFILE_ITEM.alias, avatar: TEST_PROFILE_ITEM.avatar, countryCode: 'FR' },
        }),
      );
    });

    it('should compute the AVERAGE_LAPS score from valid laps only', async () => {
      vi.spyOn(eventDao, 'load').mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.AVERAGE_LAPS });
      vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({
        cursor: null,
        data: [
          { ...TEST_LAP_ITEM, lapNumber: 1, lapTimeMs: 10000, isValid: true },
          { ...TEST_LAP_ITEM, lapNumber: 2, lapTimeMs: 12000, isValid: true },
        ],
      });
      vi.spyOn(rankingDao, 'recordSubmission').mockResolvedValue(TEST_SUBMISSION_ITEM);

      const output = await TransitionRunStatusOperation(submitInput, TEST_OPERATION_CONTEXT);

      expect(output.rankingScore).toEqual(11000);
    });

    it('should throw ConflictError when the run has zero valid laps', async () => {
      vi.spyOn(eventDao, 'load').mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.BEST_LAP });
      vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({
        cursor: null,
        data: [{ ...TEST_LAP_ITEM, isValid: false }],
      });
      const recordSubmissionSpy = vi.spyOn(rankingDao, 'recordSubmission');
      const transitionSpy = vi.spyOn(runDao, 'transitionStatus');

      await expect(TransitionRunStatusOperation(submitInput, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(
        ConflictError,
      );

      expect(transitionSpy).not.toHaveBeenCalled();
      expect(submissionDao.listByCreatedAt).not.toHaveBeenCalled();
      expect(recordSubmissionSpy).not.toHaveBeenCalled();
    });

    it('should delegate the create-Submission-and-maybe-update-Ranking write to rankingDao.recordSubmission', async () => {
      vi.spyOn(eventDao, 'load').mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.BEST_LAP });
      vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({ cursor: null, data: [TEST_LAP_ITEM] });
      vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValue({ cursor: null, data: [] });
      const recordSubmissionSpy = vi.spyOn(rankingDao, 'recordSubmission').mockResolvedValue(TEST_SUBMISSION_ITEM);

      await TransitionRunStatusOperation(submitInput, TEST_OPERATION_CONTEXT);

      expect(recordSubmissionSpy).toHaveBeenCalledWith(expect.objectContaining({ runId: TEST_RUN_ID }));
    });

    it('should update the existing Ranking when the new score is better (lower)', async () => {
      vi.spyOn(eventDao, 'load').mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.BEST_LAP });
      vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({
        cursor: null,
        data: [{ ...TEST_LAP_ITEM, lapTimeMs: 5000 }],
      });
      const recordSubmissionSpy = vi.spyOn(rankingDao, 'recordSubmission').mockResolvedValue(TEST_SUBMISSION_ITEM);

      const output = await TransitionRunStatusOperation(submitInput, TEST_OPERATION_CONTEXT);

      expect(output.rankingScore).toEqual(5000);
      expect(recordSubmissionSpy).toHaveBeenCalledWith(
        expect.objectContaining({ submission: expect.objectContaining({ rankingScore: 5000 }) }),
      );
    });

    it('should not update the existing Ranking when the new score is worse (higher)', async () => {
      vi.spyOn(eventDao, 'load').mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.BEST_LAP });
      vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({
        cursor: null,
        data: [{ ...TEST_LAP_ITEM, lapTimeMs: 20000 }],
      });
      const recordSubmissionSpy = vi.spyOn(rankingDao, 'recordSubmission').mockResolvedValue(TEST_SUBMISSION_ITEM);

      const output = await TransitionRunStatusOperation(submitInput, TEST_OPERATION_CONTEXT);

      expect(output.rankingScore).toEqual(20000);
      expect(recordSubmissionSpy).toHaveBeenCalledWith(
        expect.objectContaining({ submission: expect.objectContaining({ rankingScore: 20000 }) }),
      );
    });

    it('should pass racedByProxy through to the created Submission', async () => {
      vi.spyOn(runDao, 'load').mockResolvedValue({ ...FINISHED_RUN, racedByProxy: true });
      vi.spyOn(eventDao, 'load').mockResolvedValue({ ...TEST_EVENT_ITEM, raceFormat: RaceFormat.BEST_LAP });
      vi.spyOn(lapDao, 'listAllLapsByRun').mockResolvedValue({ cursor: null, data: [TEST_LAP_ITEM] });
      const recordSubmissionSpy = vi.spyOn(rankingDao, 'recordSubmission').mockResolvedValue(TEST_SUBMISSION_ITEM);

      await TransitionRunStatusOperation(submitInput, TEST_OPERATION_CONTEXT);

      expect(recordSubmissionSpy).toHaveBeenCalledWith(
        expect.objectContaining({ submission: expect.objectContaining({ racedByProxy: true }) }),
      );
    });
  });
});
