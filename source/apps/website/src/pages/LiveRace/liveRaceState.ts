// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { AvatarConfig } from '@deepracer-indy/typescript-client';

import type { RankingEntry } from './components/LeaderboardPanel';
import type { QueueItem } from './components/QueueManagementPanel';
import type { Winner } from './components/WinnerOverlay';
import type { LiveRaceEvent, RaceStatus } from './types';

export interface LiveRaceState {
  streamUrl: string | null;
  participantName: string | null;
  modelName: string | null;
  currentAvatar: AvatarConfig | null;
  queuePosition: number | null;
  totalModels: number;
  completedModels: number;
  rankings: RankingEntry[];
  raceStatus: RaceStatus | null;
  winner: Winner | null;
  autolaunchEnabled: boolean;
  submissionPeriodOpen: boolean;
  isExecutionRunning: boolean;
  queueItems: QueueItem[];
}

export const initialState: LiveRaceState = {
  streamUrl: null,
  participantName: null,
  modelName: null,
  currentAvatar: null,
  queuePosition: null,
  totalModels: 0,
  completedModels: 0,
  rankings: [],
  raceStatus: null,
  winner: null,
  autolaunchEnabled: false,
  submissionPeriodOpen: false,
  isExecutionRunning: false,
  queueItems: [],
};

/**
 * Reduces a live race event into state updates.
 * Each event type maps to specific state changes via discriminated union.
 */
export const applyEvent = (state: LiveRaceState, event: LiveRaceEvent): LiveRaceState => {
  switch (event.eventType) {
    case 'EVALUATION_STARTED':
      return {
        ...state,
        participantName: event.participantName,
        modelName: event.modelName,
        currentAvatar: state.queueItems.find((i) => i.submissionId === event.submissionId)?.avatar ?? null,
        queuePosition: event.queuePosition,
        totalModels: event.totalModels,
        completedModels: event.completedModels,
        streamUrl: null,
        isExecutionRunning: true,
        queueItems: state.queueItems.map((item) =>
          item.submissionId === event.submissionId ? { ...item, status: 'IN_PROGRESS' as const } : item,
        ),
      };
    case 'STREAM_READY':
      return {
        ...state,
        streamUrl: event.streamUrl,
      };
    case 'EVALUATION_COMPLETE': {
      const updatedItems = state.queueItems.map((item) =>
        item.submissionId === event.submissionId ? { ...item, status: 'COMPLETED' as const } : item,
      );
      const nextPending = updatedItems.find((i) => i.status === 'PENDING');
      return {
        ...state,
        completedModels: state.completedModels + 1,
        streamUrl: null,
        participantName: nextPending?.participantName ?? null,
        modelName: nextPending?.modelName ?? null,
        currentAvatar: nextPending?.avatar ?? null,
        queuePosition: null,
        isExecutionRunning: false,
        queueItems: updatedItems,
      };
    }
    case 'LEADERBOARD_UPDATED':
      return {
        ...state,
        rankings: event.rankings,
      };
    case 'RACE_STATUS_CHANGED':
      return {
        ...state,
        raceStatus: event.status,
      };
    case 'WINNER_DECLARED':
      return {
        ...state,
        winner: event.winner,
        raceStatus: 'COMPLETED',
        isExecutionRunning: false,
      };
    case 'QUEUE_CHANGED': {
      if (event.action === 'SUBMISSION_ADDED') return state; // new item; wait for REST refetch
      if (event.action === 'REMOVE') {
        return { ...state, queueItems: state.queueItems.filter((i) => i.submissionId !== event.submissionId) };
      }
      const updatedQueue = state.queueItems.map((item) =>
        item.submissionId === event.submissionId
          ? {
              ...item,
              status: event.newStatus ?? item.status,
              queuePosition: event.newQueuePosition ?? item.queuePosition,
            }
          : item,
      );
      const isFailed = event.newStatus === 'FAILED';
      if (isFailed) {
        const nextPending = updatedQueue.find((i) => i.status === 'PENDING');
        return {
          ...state,
          queueItems: updatedQueue,
          participantName: nextPending?.participantName ?? null,
          modelName: nextPending?.modelName ?? null,
          currentAvatar: nextPending?.avatar ?? null,
          streamUrl: null,
          isExecutionRunning: false,
        };
      }
      return { ...state, queueItems: updatedQueue };
    }
    default:
      return state;
  }
};
