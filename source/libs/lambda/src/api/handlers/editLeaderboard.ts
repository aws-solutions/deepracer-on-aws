// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { isDeepStrictEqual } from 'node:util';

import type { Operation } from '@aws-smithy/server-common';
import { eventDao, leaderboardDao, liveQueueItemDao, ResourceId } from '@deepracer-indy/database';
import {
  getEditLeaderboardHandler,
  EditLeaderboardServerInput,
  EditLeaderboardServerOutput,
  LiveEventStatus,
  LiveQueueItemStatus,
  RaceType,
  BadRequestError,
  ConflictError,
  EventStatus,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toLeaderboardResponse } from '../utils/toLeaderboardResponse.js';
import { validateObjectAvoidanceConfig, validateTrackConfig } from '../utils/validation.js';

type LeaderboardItem = Awaited<ReturnType<typeof leaderboardDao.load>>;

/**
 * Returns true when the leaderboardDefinition changes only fields that an
 * admin is permitted to modify on an already-open community race.
 *
 * Permitted fields (the only ones that may differ from the existing leaderboard):
 * - closeTime: extends or shortens the submission window; no impact on existing rankings
 * - maxSubmissionsPerUser: forward-only, doesn't affect existing rankings
 *
 * All other known fields are explicitly compared and must be unchanged. description is not
 * a persisted attribute on LeaderboardsEntity (there's no existing value to compare against),
 * so any non-empty description is rejected outright rather than silently accepted and dropped.
 * Note: this check and the actual write (partialUpdate with the 2 permitted fields)
 * are both required — the check validates intent; the write enforces the restriction.
 */
const isWithinAdminAllowlist = (
  leaderboardDefinition: NonNullable<EditLeaderboardServerInput['leaderboardDefinition']>,
  existingLeaderboard: LeaderboardItem,
): boolean => {
  // Permitted to differ: closeTime, maxSubmissionsPerUser.
  // Everything else must be unchanged.
  return (
    leaderboardDefinition.raceType === existingLeaderboard.raceType &&
    leaderboardDefinition.openTime.toISOString() === existingLeaderboard.openTime &&
    isDeepStrictEqual(leaderboardDefinition.trackConfig, existingLeaderboard.trackConfig) &&
    isDeepStrictEqual(leaderboardDefinition.resettingBehaviorConfig, existingLeaderboard.resettingBehaviorConfig) &&
    leaderboardDefinition.timingMethod === existingLeaderboard.timingMethod &&
    leaderboardDefinition.submissionTerminationConditions.minimumLaps === existingLeaderboard.minimumLaps &&
    leaderboardDefinition.submissionTerminationConditions.maximumLaps ===
      existingLeaderboard.submissionTerminationConditions.maxLaps &&
    leaderboardDefinition.submissionTerminationConditions.maxTimeInMinutes ===
      existingLeaderboard.submissionTerminationConditions.maxTimeInMinutes &&
    isDeepStrictEqual(leaderboardDefinition.objectAvoidanceConfig, existingLeaderboard.objectAvoidanceConfig) &&
    leaderboardDefinition.name === existingLeaderboard.name &&
    (leaderboardDefinition.leaderBoardFooter ?? null) === (existingLeaderboard.leaderBoardFooter ?? null) &&
    (leaderboardDefinition.maxResets ?? null) === (existingLeaderboard.maxResets ?? null) &&
    (leaderboardDefinition.liveEventTime?.toISOString() ?? null) === (existingLeaderboard.liveEventTime ?? null) &&
    // description isn't a real persisted attribute on LeaderboardsEntity, so there's no
    // existing value to compare against — reject any non-empty value rather than silently
    // accepting and then dropping it at the write step below.
    !leaderboardDefinition.description
  );
};

/**
 * Builds the partial update payload for live-race toggle fields.
 * Returns `null` when no live-toggle fields are present on the input.
 */
const buildLiveUpdates = (
  input: EditLeaderboardServerInput,
  existingLeaderboard: LeaderboardItem,
): Record<string, unknown> | null => {
  const updates: Record<string, unknown> = {};

  if (existingLeaderboard.liveEventStatus === LiveEventStatus.COMPLETED) {
    throw new BadRequestError({ message: 'Cannot modify a completed live race.' });
  }

  if (input.autoLaunchEnabled !== undefined) {
    updates.autoLaunchEnabled = input.autoLaunchEnabled;
  }

  if (input.submissionPeriodOpen !== undefined) {
    updates.submissionPeriodOpen = input.submissionPeriodOpen;
  }

  if (input.liveEventTime !== undefined) {
    if (new Date(input.liveEventTime) <= new Date()) {
      throw new BadRequestError({ message: 'Event time must be in the future.' });
    }
    updates.liveEventTime = input.liveEventTime.toISOString();
  }

  return Object.keys(updates).length > 0 ? updates : null;
};

/**
 * If autolaunch toggled ON with no SF running, touch a PENDING item to trigger stream.
 * Best-effort — stream handler will pick up pending items on its own.
 */
const triggerAutolaunchIfNeeded = async (
  input: EditLeaderboardServerInput,
  existingLeaderboard: LeaderboardItem,
  leaderboardId: ResourceId,
): Promise<void> => {
  const shouldTrigger = input.autoLaunchEnabled === true && !existingLeaderboard.currentExecutionArn;
  if (!shouldTrigger) return;

  try {
    const nextPending = await liveQueueItemDao.getNextPending({ leaderboardId });
    if (nextPending) {
      await liveQueueItemDao.touchItem({ leaderboardId, submissionId: nextPending.submissionId });
    }
  } catch (err) {
    logger.warn('Failed to touch pending queue item after autolaunch toggle', { leaderboardId, err });
  }
};

/** Guards that the leaderboard is in an editable state for a full definition edit. */
const assertLeaderboardEditable = (existingLeaderboard: LeaderboardItem): void => {
  if (existingLeaderboard.isLive) {
    if (existingLeaderboard.liveEventStatus !== LiveEventStatus.SCHEDULED) {
      throw new BadRequestError({ message: 'Can only edit live races before they start.' });
    }
    return;
  }

  const currentTime = new Date();
  const openTime = new Date(existingLeaderboard.openTime);
  const closeTime = new Date(existingLeaderboard.closeTime);

  if (openTime <= currentTime) {
    throw new BadRequestError({ message: 'Can only edit future leaderboards that have not started yet.' });
  }

  if (closeTime <= currentTime) {
    throw new BadRequestError({ message: 'Cannot edit closed leaderboards.' });
  }
};

/** Validates the incoming leaderboard definition payload. */
const validateLeaderboardDefinition = (
  leaderboardDefinition: NonNullable<EditLeaderboardServerInput['leaderboardDefinition']>,
): void => {
  if (leaderboardDefinition.openTime >= leaderboardDefinition.closeTime) {
    throw new BadRequestError({ message: 'Opening time cannot be after close time.' });
  }

  if (
    leaderboardDefinition.submissionTerminationConditions.maximumLaps <
    leaderboardDefinition.submissionTerminationConditions.minimumLaps
  ) {
    throw new BadRequestError({ message: 'Invalid maximum and minimum laps.' });
  }

  if (leaderboardDefinition.raceType === RaceType.OBJECT_AVOIDANCE) {
    validateObjectAvoidanceConfig(leaderboardDefinition.objectAvoidanceConfig);
  }

  validateTrackConfig(leaderboardDefinition.trackConfig);
};

/**
 * Throws ConflictError if a live race edit changes scoring/track/penalty fields while submissions
 * are queued. Only queries the queue when a blocked field actually changed.
 */
const assertNoBlockedChangesWhileQueued = async (
  leaderboardDefinition: NonNullable<EditLeaderboardServerInput['leaderboardDefinition']>,
  existingLeaderboard: LeaderboardItem,
  leaderboardId: ResourceId,
): Promise<void> => {
  if (!existingLeaderboard.isLive) return;

  const hasBlockedFieldChange =
    leaderboardDefinition.timingMethod !== existingLeaderboard.timingMethod ||
    leaderboardDefinition.submissionTerminationConditions.minimumLaps !== existingLeaderboard.minimumLaps ||
    leaderboardDefinition.submissionTerminationConditions.maximumLaps !==
      existingLeaderboard.submissionTerminationConditions.maxLaps ||
    leaderboardDefinition.submissionTerminationConditions.maxTimeInMinutes !==
      existingLeaderboard.submissionTerminationConditions.maxTimeInMinutes ||
    leaderboardDefinition.raceType !== existingLeaderboard.raceType ||
    !isDeepStrictEqual(leaderboardDefinition.trackConfig, existingLeaderboard.trackConfig) ||
    !isDeepStrictEqual(leaderboardDefinition.resettingBehaviorConfig, existingLeaderboard.resettingBehaviorConfig) ||
    !isDeepStrictEqual(leaderboardDefinition.objectAvoidanceConfig, existingLeaderboard.objectAvoidanceConfig);

  if (!hasBlockedFieldChange) return;

  const queue = await liveQueueItemDao.getQueue({ leaderboardId });
  const hasActiveSubmissions = queue.some(
    (item) => item.status === LiveQueueItemStatus.PENDING || item.status === LiveQueueItemStatus.IN_PROGRESS,
  );
  if (hasActiveSubmissions) {
    throw new ConflictError({
      message: 'Cannot change scoring or track settings while submissions are queued.',
    });
  }
};

/**
 * Handles an admin edit of an active community race: enforces the admin-only allowlist gate,
 * validates the new close time, and applies an explicit projection update.
 */
const handleActiveRaceEdit = async (
  leaderboardDefinition: NonNullable<EditLeaderboardServerInput['leaderboardDefinition']>,
  existingLeaderboard: LeaderboardItem,
  leaderboardId: ResourceId,
  profileId: ResourceId,
): Promise<EditLeaderboardServerOutput> => {
  const admin = await isUserAdmin(profileId);
  if (!admin) {
    throw new BadRequestError({ message: 'Can only edit future leaderboards that have not started yet.' });
  }

  if (!isWithinAdminAllowlist(leaderboardDefinition, existingLeaderboard)) {
    throw new BadRequestError({
      message: 'Admins can only edit the end time and submission limits on an active race.',
    });
  }

  // If the end time changed, it must be in the future — an active race cannot be
  // given an end time that has already passed.
  if (
    leaderboardDefinition.closeTime.toISOString() !== existingLeaderboard.closeTime &&
    leaderboardDefinition.closeTime <= new Date()
  ) {
    throw new BadRequestError({ message: 'End time must be in the future.' });
  }

  validateLeaderboardDefinition(leaderboardDefinition);

  // Build the update from an explicit projection of the permitted fields only.
  // Never spread leaderboardDefinition here — the allowlist check is the gate
  // but the update must not write fields beyond the permitted set regardless.
  const activeRaceUpdates: Record<string, unknown> = {
    closeTime: leaderboardDefinition.closeTime.toISOString(),
    maxSubmissionsPerUser: leaderboardDefinition.maxSubmissionsPerUser,
  };
  const updatedLeaderboard = await leaderboardDao.partialUpdate({ leaderboardId }, activeRaceUpdates);

  logger.info('Admin edited active community race', {
    leaderboardId,
    adminProfileId: profileId,
    changedFields: {
      maxSubmissionsPerUser: leaderboardDefinition.maxSubmissionsPerUser,
      closeTime: leaderboardDefinition.closeTime,
    },
  });

  return { leaderboard: toLeaderboardResponse(updatedLeaderboard) } satisfies EditLeaderboardServerOutput;
};

/** Business logic for the EditLeaderboard operation. */
export const EditLeaderboardOperation: Operation<
  EditLeaderboardServerInput,
  EditLeaderboardServerOutput,
  HandlerContext
> = async (input, context) => {
  const leaderboardId = input.leaderboardId as ResourceId;
  const existingLeaderboard = await leaderboardDao.load({ leaderboardId });

  // Path 1: Live race toggle updates (partial update, no full definition required).
  if (existingLeaderboard.isLive) {
    const liveUpdates = buildLiveUpdates(input, existingLeaderboard);
    if (liveUpdates) {
      if (input.leaderboardDefinition) {
        throw new BadRequestError({ message: 'Cannot combine toggle fields with leaderboardDefinition.' });
      }
      const updatedLeaderboard = await leaderboardDao.partialUpdate({ leaderboardId }, liveUpdates);
      await triggerAutolaunchIfNeeded(input, existingLeaderboard, leaderboardId);
      return { leaderboard: toLeaderboardResponse(updatedLeaderboard) } satisfies EditLeaderboardServerOutput;
    }
  }

  // Path 2: Full definition edit (community or scheduled live race).
  const { leaderboardDefinition } = input;
  if (!leaderboardDefinition) {
    throw new BadRequestError({ message: 'leaderboardDefinition is required.' });
  }

  // Event tracks use epoch timestamps as required virtual-race placeholders, so they
  // must not be evaluated by the generic future-leaderboard guard. Their mutable
  // configuration is instead governed by the parent event lifecycle.
  if (existingLeaderboard.eventId) {
    const event = await eventDao.load({ eventId: existingLeaderboard.eventId });
    if (event.eventStatus !== EventStatus.DRAFT) {
      throw new ConflictError({ message: `Cannot edit track: event is ${event.eventStatus}.` });
    }

    const updatedTrack = await leaderboardDao.partialUpdate(
      { leaderboardId },
      {
        name: leaderboardDefinition.name,
        leaderBoardFooter: leaderboardDefinition.leaderBoardFooter,
      },
    );

    return { leaderboard: toLeaderboardResponse(updatedTrack) } satisfies EditLeaderboardServerOutput;
  }

  const isActive =
    !existingLeaderboard.isLive &&
    new Date(existingLeaderboard.openTime) <= new Date() &&
    new Date(existingLeaderboard.closeTime) > new Date();

  if (isActive) {
    // Active community race: only admins may edit, and only within the allowlist.
    return handleActiveRaceEdit(leaderboardDefinition, existingLeaderboard, leaderboardId, context.profileId);
  }

  // Path 3: Standard edit (race not yet started, or scheduled live race).
  assertLeaderboardEditable(existingLeaderboard);
  validateLeaderboardDefinition(leaderboardDefinition);

  // Block scoring/track/penalty edits while queue has submissions (prevents config divergence with snapshotted submission fields).
  await assertNoBlockedChangesWhileQueued(leaderboardDefinition, existingLeaderboard, leaderboardId);

  const updatedLeaderboard = await leaderboardDao.update(
    { leaderboardId },
    {
      ...leaderboardDefinition,
      openTime: leaderboardDefinition.openTime.toISOString(),
      closeTime: leaderboardDefinition.closeTime.toISOString(),
      liveEventTime: leaderboardDefinition.liveEventTime?.toISOString(),
      minimumLaps: leaderboardDefinition.submissionTerminationConditions.minimumLaps,
      submissionTerminationConditions: {
        maxLaps: leaderboardDefinition.submissionTerminationConditions.maximumLaps,
        maxTimeInMinutes: leaderboardDefinition.submissionTerminationConditions.maxTimeInMinutes,
      },
    },
  );

  return { leaderboard: toLeaderboardResponse(updatedLeaderboard) } satisfies EditLeaderboardServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getEditLeaderboardHandler(instrumentOperation(EditLeaderboardOperation)),
);
