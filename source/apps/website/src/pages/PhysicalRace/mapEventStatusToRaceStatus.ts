// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EventStatus } from '@deepracer-indy/typescript-client';

import type { RaceStatus } from './types/events.js';

/**
 * Maps a RACE_STATUS_CHANGED event's status (the real EventStatus enum) to the RaceStatus
 * vocabulary that CommentatorView, PublicLeaderboard, and StreamingOverlay check against —
 * these are different Smithy types, and RaceStatus is otherwise only populated by OVERLAY_UPDATE.
 */
const EVENT_STATUS_TO_RACE_STATUS: Record<EventStatus, RaceStatus> = {
  [EventStatus.DRAFT]: 'NO_RACER_SELECTED',
  [EventStatus.OPEN]: 'READY_TO_START',
  [EventStatus.IN_PROGRESS]: 'RACE_IN_PROGRESS',
  [EventStatus.COMPLETED]: 'RACE_FINISHED',
  [EventStatus.ARCHIVED]: 'RACE_FINISHED',
  [EventStatus.DELETING]: 'RACE_FINISHED',
};

export const mapEventStatusToRaceStatus = (status: EventStatus): RaceStatus => EVENT_STATUS_TO_RACE_STATUS[status];
