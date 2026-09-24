// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { EventItem } from '@deepracer-indy/database';
import type { Event } from '@deepracer-indy/typescript-server-client';

/** Maps an EventItem entity to the Smithy Event response shape. */
export const toEventResponse = (item: EventItem): Event => ({
  eventId: item.eventId,
  createdBy: item.createdBy,
  name: item.name,
  eventType: item.eventType,
  eventStatus: item.eventStatus,
  eventDate: item.eventDate,
  countryCode: item.countryCode,
  raceFormat: item.raceFormat,
  maxLaps: item.maxLaps,
  maxTimeInMinutes: item.maxTimeInMinutes,
  maxResets: item.maxResets,
  createdAt: new Date(item.createdAt),
  updatedAt: new Date(item.updatedAt),
  ...(item.sponsor && { sponsor: item.sponsor }),
  ...(item.maxRunsPerRacer !== undefined && { maxRunsPerRacer: item.maxRunsPerRacer }),
  ...(item.combinedScoringStrategy && { combinedScoringStrategy: item.combinedScoringStrategy }),
  ...(item.combinedLeaderBoardHeader && { combinedLeaderBoardHeader: item.combinedLeaderBoardHeader }),
  ...(item.combinedLeaderBoardFooter && { combinedLeaderBoardFooter: item.combinedLeaderBoardFooter }),
  ...(item.averageLapsWindow !== undefined && { averageLapsWindow: item.averageLapsWindow }),
});
