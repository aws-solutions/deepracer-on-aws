// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AvatarConfig } from '@deepracer-indy/typescript-client';

/**
 * Event types published by the LiveBroadcastHandler via IoT Core.
 * These are the contract between the backend stream consumer and the frontend.
 */

export interface BaseLiveRaceEvent {
  eventType: string;
  leaderboardId: string;
  timestamp: string;
}

export interface EvaluationStartedEvent extends BaseLiveRaceEvent {
  eventType: 'EVALUATION_STARTED';
  participantName: string;
  modelName: string;
  submissionId: string;
  queuePosition: number;
  totalModels: number;
  completedModels: number;
}

export interface StreamReadyEvent extends BaseLiveRaceEvent {
  eventType: 'STREAM_READY';
  streamUrl: string;
  participantName: string;
  modelName: string;
}

export interface EvaluationCompleteEvent extends BaseLiveRaceEvent {
  eventType: 'EVALUATION_COMPLETE';
  participantName: string;
  modelName: string;
  submissionId: string;
  results: {
    bestLapTime: number;
    totalLapTime: number;
    completedLapCount: number;
    resetCount: number;
    offTrackCount: number;
  };
}

export interface LeaderboardUpdatedEvent extends BaseLiveRaceEvent {
  eventType: 'LEADERBOARD_UPDATED';
  rankings: Array<{
    rank: number;
    participantName: string;
    modelName: string;
    bestLapTime: number;
    submissionId: string;
    avatar: AvatarConfig;
  }>;
}

export interface QueueChangedEvent extends BaseLiveRaceEvent {
  eventType: 'QUEUE_CHANGED';
  action: 'REORDER' | 'SKIP' | 'REMOVE' | 'RESET' | 'RETRY' | 'SUBMISSION_ADDED';
  submissionId: string;
  participantName?: string;
  newStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  newQueuePosition?: string;
}

export interface RaceStatusChangedEvent extends BaseLiveRaceEvent {
  eventType: 'RACE_STATUS_CHANGED';
  status: 'SUBMISSIONS_OPEN' | 'SUBMISSIONS_CLOSED' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface WinnerDeclaredEvent extends BaseLiveRaceEvent {
  eventType: 'WINNER_DECLARED';
  winnerId: string;
  winner: {
    participantName: string;
    modelName: string;
    bestLapTime: number;
    rank: number;
    avatar: AvatarConfig;
  };
}

export interface ParticipantNotificationEvent extends BaseLiveRaceEvent {
  eventType: 'PARTICIPANT_NOTIFICATION';
  profileId: string;
  notificationType: 'EVALUATION_STARTED' | 'EVALUATION_COMPLETE' | 'TOP_3' | 'FASTEST_TIME';
  participantName: string;
  modelName: string;
  message: string;
  results?: { bestLapTime: number };
  ranking?: number;
}

export type LiveRaceEvent =
  | EvaluationStartedEvent
  | StreamReadyEvent
  | EvaluationCompleteEvent
  | LeaderboardUpdatedEvent
  | QueueChangedEvent
  | RaceStatusChangedEvent
  | WinnerDeclaredEvent
  | ParticipantNotificationEvent;
