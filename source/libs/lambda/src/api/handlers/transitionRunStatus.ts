// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import {
  eventDao,
  generateResourceId,
  lapDao,
  profileDao,
  rankingDao,
  runDao,
  submissionDao,
  type ResourceId,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  ConflictError,
  getTransitionRunStatusHandler,
  JobStatus,
  NotAuthorizedError,
  RaceType,
  RunStatus,
  RunTransitionAction,
  TrackDirection,
  TrackId,
  TransitionRunStatusServerInput,
  TransitionRunStatusServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { computeRunScore } from '../utils/computeRunScore.js';
import { computeRunStats } from '../utils/computeRunStats.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toRunResponse } from '../utils/toRunResponse.js';

/**
 * Placeholder values for SubmissionsEntity fields that only apply to virtual
 * (simulator) racing and have no physical-race equivalent. Physical Runs are
 * raced on a real track with a real car, not a SageMaker simulation job, so
 * these fields are populated with fixed sentinel values rather than left
 * unset — this keeps GetSubmission/ListSubmissions and the SageMaker workflow
 * union type (JobItem) working without branching on a "is this physical"
 * flag, mirroring the established pattern in importPhysicalModel.ts for
 * physical Model imports (see its trainingDao.create() call).
 */
const PHYSICAL_SUBMISSION_PLACEHOLDER_FIELDS = {
  modelName: '',
  raceType: RaceType.TIME_TRIAL,
  status: JobStatus.COMPLETED,
  terminationConditions: { maxTimeInMinutes: 0, maxLaps: 0 },
  trackConfig: { trackId: TrackId.A_TO_Z_SPEEDWAY, trackDirection: TrackDirection.CLOCKWISE },
  resettingBehaviorConfig: { continuousLap: false },
};

/**
 * Valid state machine transitions: action → [allowed current statuses, resulting status].
 * FINISH is the only action reachable from two different current statuses (IN_PROGRESS or PAUSED).
 * DISCARD is reachable from READY or FINISHED.
 */
const TRANSITIONS: Record<RunTransitionAction, { from: RunStatus[]; to: RunStatus }> = {
  [RunTransitionAction.START]: { from: [RunStatus.READY], to: RunStatus.IN_PROGRESS },
  [RunTransitionAction.PAUSE]: { from: [RunStatus.IN_PROGRESS], to: RunStatus.PAUSED },
  [RunTransitionAction.RESUME]: { from: [RunStatus.PAUSED], to: RunStatus.IN_PROGRESS },
  [RunTransitionAction.FINISH]: { from: [RunStatus.IN_PROGRESS, RunStatus.PAUSED], to: RunStatus.FINISHED },
  [RunTransitionAction.RESUME_FROM_FINISHED]: { from: [RunStatus.FINISHED], to: RunStatus.IN_PROGRESS },
  [RunTransitionAction.SUBMIT]: { from: [RunStatus.FINISHED], to: RunStatus.SUBMITTED },
  [RunTransitionAction.DISCARD]: { from: [RunStatus.READY, RunStatus.FINISHED], to: RunStatus.DISCARDED },
};

/** True if `err` is (or wraps) a DynamoDB ConditionalCheckFailedException. */
const isConditionalCheckFailure = (err: unknown): boolean => {
  const error = err as { name?: string; cause?: { name?: string } };
  return error.name === 'ConditionalCheckFailedException' || error.cause?.name === 'ConditionalCheckFailedException';
};

/** This is the implementation of business logic of the TransitionRunStatus operation. */
export const TransitionRunStatusOperation: Operation<
  TransitionRunStatusServerInput,
  TransitionRunStatusServerOutput,
  HandlerContext
> = async (input, context) => {
  if (!(await isUserAdminOrFacilitator(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators and facilitators can transition run status.' });
  }

  const eventId = input.eventId as ResourceId;
  const leaderboardId = input.leaderboardId as ResourceId;
  const runId = input.runId as ResourceId;
  const { action } = input;

  const existing = await runDao.load({ leaderboardId, runId });
  const transition = TRANSITIONS[action];

  if (!transition.from.includes(existing.runStatus)) {
    throw new BadRequestError({
      message: `Cannot apply action ${action} to a run in ${existing.runStatus} status.`,
    });
  }

  // ── SUBMIT scoring and persistence pipeline ────────
  // Score validation occurs before any write. recordSubmission then atomically
  // changes FINISHED → SUBMITTED, creates the Submission, and writes the
  // Ranking with stats derived from the run's valid laps and a userProfile
  // snapshot, so no failure can leave a terminal Run without its Submission.
  if (action === RunTransitionAction.SUBMIT) {
    const [eventItem, { data: laps }, profileItem] = await Promise.all([
      eventDao.load({ eventId }),
      lapDao.listAllLapsByRun({ leaderboardId, runId }),
      profileDao.load({ profileId: existing.profileId }),
    ]);
    const rankingScore = computeRunScore(eventItem.raceFormat, laps);
    const stats = computeRunStats(laps);
    const { data: previousSubmissions } = await submissionDao.listByCreatedAt({
      profileId: existing.profileId,
      leaderboardId,
      maxResults: 1,
    });
    const submissionId = generateResourceId() as ResourceId;
    const submissionNumber = (previousSubmissions[0]?.submissionNumber ?? 0) + 1;

    await rankingDao.recordSubmission({
      runId,
      stats,
      userProfile: { alias: profileItem.alias, avatar: profileItem.avatar, countryCode: profileItem.countryCode },
      submission: {
        ...PHYSICAL_SUBMISSION_PLACEHOLDER_FIELDS,
        leaderboardId,
        profileId: existing.profileId,
        modelId: generateResourceId() as ResourceId,
        submissionId,
        rankingScore,
        submissionNumber,
        racedByProxy: existing.racedByProxy,
      },
    });

    metricsLogger.logRunsCompleted();

    return {
      run: toRunResponse({ ...existing, runStatus: RunStatus.SUBMITTED, submissionId }),
      rankingScore,
    } satisfies TransitionRunStatusServerOutput;
  }

  let runItem;
  try {
    runItem = await runDao.transitionStatus({
      leaderboardId,
      runId,
      status: transition.to,
      expectedStatus: existing.runStatus,
    });
  } catch (err) {
    if (isConditionalCheckFailure(err)) {
      throw new ConflictError({ message: 'Concurrent transition detected; please retry.' });
    }
    throw err;
  }

  return { run: toRunResponse(runItem) } satisfies TransitionRunStatusServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getTransitionRunStatusHandler(instrumentOperation(TransitionRunStatusOperation)),
);
