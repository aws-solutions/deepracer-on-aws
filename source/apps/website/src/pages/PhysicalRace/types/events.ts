// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * IoT event payload types for physical race broadcasting.
 * These mirror the Smithy contract in race-realtime.smithy and are published
 * by the BroadcastHandler to the race/{eventId}/{trackId} topic tree.
 */

export interface RaceStartedEvent {
  eventType: 'RUN_STARTED';
  eventId: string;
  trackId: string;
  racerId: string;
  modelName: string;
  carName: string;
}

export interface RaceFinishedLap {
  lapNumber: number;
  lapTimeMilliseconds: number;
  isValid: boolean;
  resets: number;
}

export interface RaceFinishedEvent {
  eventType: 'RUN_FINISHED';
  eventId: string;
  trackId: string;
  racerId: string;
  laps: RaceFinishedLap[];
  bestLapTimeMilliseconds: number;
}

export interface LeaderboardRankingEntry {
  rank: number;
  participantName: string;
  bestLapTimeMilliseconds: number;
  modelName?: string;
  country?: string;
}

export interface PhysicalLeaderboardUpdatedEvent {
  eventType: 'LEADERBOARD_UPDATED';
  eventId: string;
  trackId: string;
  rankings: LeaderboardRankingEntry[];
}

export interface PhysicalRaceStatusChangedEvent {
  eventType: 'RACE_STATUS_CHANGED';
  eventId: string;
  trackId: string;
  status: string;
}

export interface LapCapturedEvent {
  eventType: 'LAP_CAPTURED';
  eventId: string;
  trackId: string;
  lapNumber: number;
  lapTimeMilliseconds: number;
  isValid: boolean;
  resets: number;
}

export interface OverlayLap {
  lapNumber: number;
  lapTimeMilliseconds: number;
  isValid: boolean;
}

export type RaceStatus =
  'NO_RACER_SELECTED' | 'READY_TO_START' | 'RACE_IN_PROGRESS' | 'RACE_PAUSED' | 'RACE_FINISHED' | 'RACE_SUBMITTED';

export interface OverlayUpdateEvent {
  eventType: 'OVERLAY_UPDATE';
  eventId: string;
  trackId: string;
  racerName: string;
  laps: OverlayLap[];
  timeLeftMilliseconds: number;
  currentLapTimeMilliseconds: number;
  raceStatus: RaceStatus;
}

export type PhysicalRaceEvent =
  | RaceStartedEvent
  | RaceFinishedEvent
  | PhysicalLeaderboardUpdatedEvent
  | PhysicalRaceStatusChangedEvent
  | LapCapturedEvent
  | OverlayUpdateEvent;
