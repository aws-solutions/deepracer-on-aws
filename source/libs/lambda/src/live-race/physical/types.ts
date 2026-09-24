// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * IoT event payload types for physical race broadcasting.
 * These types mirror the Smithy contract in types/race-realtime.smithy.
 */

// EventStatus is defined in the Smithy model (event.smithy) and generated into
// the typescript-client. Re-export it here so callers in the physical/ module
// import from a single location.
// EventStatus is defined in event.smithy and generated into the typescript-client.
// A value re-export makes the enum available at runtime AND exports the type.
import { EventStatus } from '@deepracer-indy/typescript-client';

export { EventStatus } from '@deepracer-indy/typescript-client';

export type RaceStatus =
  'NO_RACER_SELECTED' | 'READY_TO_START' | 'RACE_IN_PROGRESS' | 'RACE_PAUSED' | 'RACE_FINISHED' | 'RACE_SUBMITTED';

export interface RunStartedEvent {
  readonly eventType: 'RUN_STARTED';
  readonly eventId: string;
  readonly trackId: string;
  readonly racerId: string;
  readonly modelName: string;
  readonly carName: string;
}

export interface RaceFinishedLap {
  readonly lapNumber: number;
  readonly lapTimeMilliseconds: number;
  readonly isValid: boolean;
  readonly resets: number;
}

export interface RunFinishedEvent {
  readonly eventType: 'RUN_FINISHED';
  readonly eventId: string;
  readonly trackId: string;
  readonly racerId: string;
  readonly laps: readonly RaceFinishedLap[];
  readonly bestLapTimeMilliseconds: number;
}

export interface LeaderboardRankingEntry {
  readonly rank: number;
  readonly participantName: string;
  readonly bestLapTimeMilliseconds: number;
  readonly modelName?: string;
  readonly country?: string;
}

export interface LeaderboardUpdatedEvent {
  readonly eventType: 'LEADERBOARD_UPDATED';
  readonly eventId: string;
  readonly trackId: string;
  readonly rankings: readonly LeaderboardRankingEntry[];
}

export interface RaceStatusChangedEvent {
  readonly eventType: 'RACE_STATUS_CHANGED';
  readonly eventId: string;
  readonly trackId: string;
  readonly status: EventStatus;
}

export interface LapCapturedEvent {
  readonly eventType: 'LAP_CAPTURED';
  readonly eventId: string;
  readonly trackId: string;
  readonly lapNumber: number;
  readonly lapTimeMilliseconds: number;
  readonly isValid: boolean;
  readonly resets: number;
}

export interface OverlayLap {
  readonly lapNumber: number;
  readonly lapTimeMilliseconds: number;
  readonly isValid: boolean;
}

export interface OverlayUpdateEvent {
  readonly eventType: 'OVERLAY_UPDATE';
  readonly eventId: string;
  readonly trackId: string;
  readonly racerName: string;
  readonly laps: readonly OverlayLap[];
  readonly timeLeftMilliseconds: number;
  readonly currentLapTimeMilliseconds: number;
  readonly raceStatus: RaceStatus;
}

export type PhysicalRaceEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | LeaderboardUpdatedEvent
  | RaceStatusChangedEvent
  | LapCapturedEvent
  | OverlayUpdateEvent;
