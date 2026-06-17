// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';

import { applyEvent, initialState } from '../liveRaceState';
import type {
  EvaluationStartedEvent,
  StreamReadyEvent,
  EvaluationCompleteEvent,
  LeaderboardUpdatedEvent,
  RaceStatusChangedEvent,
  WinnerDeclaredEvent,
  LiveRaceEvent,
} from '../types/events';

const baseEvent = { leaderboardId: 'lb-123', timestamp: '2026-01-01T00:00:00Z' };

describe('applyEvent', () => {
  it('handles EVALUATION_STARTED', () => {
    const event: EvaluationStartedEvent = {
      ...baseEvent,
      eventType: 'EVALUATION_STARTED',
      participantName: 'Alice',
      modelName: 'SpeedDemon',
      submissionId: 'sub-1',
      queuePosition: 1,
      totalModels: 5,
      completedModels: 0,
    };

    const result = applyEvent(initialState, event);

    expect(result.participantName).toBe('Alice');
    expect(result.modelName).toBe('SpeedDemon');
    expect(result.queuePosition).toBe(1);
    expect(result.totalModels).toBe(5);
    expect(result.streamUrl).toBeNull();
    expect(result.isExecutionRunning).toBe(true);
  });

  it('handles STREAM_READY', () => {
    const state = { ...initialState, participantName: 'Alice', isExecutionRunning: true };
    const event: StreamReadyEvent = {
      ...baseEvent,
      eventType: 'STREAM_READY',
      streamUrl: 'https://kvs.example.com/stream.m3u8',
      participantName: 'Alice',
      modelName: 'SpeedDemon',
    };

    const result = applyEvent(state, event);

    expect(result.streamUrl).toBe('https://kvs.example.com/stream.m3u8');
  });

  it('handles EVALUATION_COMPLETE', () => {
    const state = { ...initialState, completedModels: 2, streamUrl: 'https://stream.m3u8', isExecutionRunning: true };
    const event: EvaluationCompleteEvent = {
      ...baseEvent,
      eventType: 'EVALUATION_COMPLETE',
      participantName: 'Alice',
      modelName: 'SpeedDemon',
      submissionId: 'sub-1',
      results: { bestLapTime: 12450, totalLapTime: 62250, completedLapCount: 5, resetCount: 2, offTrackCount: 1 },
    };

    const result = applyEvent(state, event);

    expect(result.completedModels).toBe(3);
    expect(result.streamUrl).toBeNull();
    expect(result.isExecutionRunning).toBe(false);
  });

  it('handles LEADERBOARD_UPDATED', () => {
    const rankings = [
      {
        rank: 1,
        participantName: 'Alice',
        modelName: 'SpeedDemon',
        bestLapTime: 12450,
        submissionId: 'sub-1',
        avatar: {},
      },
    ];
    const event: LeaderboardUpdatedEvent = { ...baseEvent, eventType: 'LEADERBOARD_UPDATED', rankings };

    const result = applyEvent(initialState, event);

    expect(result.rankings).toEqual(rankings);
  });

  it('handles RACE_STATUS_CHANGED', () => {
    const event: RaceStatusChangedEvent = { ...baseEvent, eventType: 'RACE_STATUS_CHANGED', status: 'IN_PROGRESS' };

    const result = applyEvent(initialState, event);

    expect(result.raceStatus).toBe('IN_PROGRESS');
  });

  it('handles WINNER_DECLARED', () => {
    const winner = { participantName: 'Alice', modelName: 'SpeedDemon', bestLapTime: 12450, rank: 1, avatar: {} };
    const event: WinnerDeclaredEvent = {
      ...baseEvent,
      eventType: 'WINNER_DECLARED',
      winnerId: 'sub-1',
      winner,
    };

    const result = applyEvent(initialState, event);

    expect(result.winner).toEqual(winner);
    expect(result.raceStatus).toBe('COMPLETED');
    expect(result.isExecutionRunning).toBe(false);
  });

  it('ignores unknown event types', () => {
    const event = { ...baseEvent, eventType: 'UNKNOWN_EVENT' } as unknown as LiveRaceEvent;

    const result = applyEvent(initialState, event);

    expect(result).toEqual(initialState);
  });

  describe('full race sequence', () => {
    it('processes a complete race flow correctly', () => {
      let state = initialState;

      // Race starts
      state = applyEvent(state, { ...baseEvent, eventType: 'RACE_STATUS_CHANGED', status: 'IN_PROGRESS' });
      expect(state.raceStatus).toBe('IN_PROGRESS');

      // Model A starts
      state = applyEvent(state, {
        ...baseEvent,
        eventType: 'EVALUATION_STARTED',
        participantName: 'Alice',
        modelName: 'SpeedDemon',
        submissionId: 'sub-1',
        queuePosition: 1,
        totalModels: 3,
        completedModels: 0,
      });
      expect(state.participantName).toBe('Alice');
      expect(state.streamUrl).toBeNull();
      expect(state.isExecutionRunning).toBe(true);

      // Stream becomes available
      state = applyEvent(state, {
        ...baseEvent,
        eventType: 'STREAM_READY',
        streamUrl: 'https://stream-a.m3u8',
        participantName: 'Alice',
        modelName: 'SpeedDemon',
      });
      expect(state.streamUrl).toBe('https://stream-a.m3u8');

      // Model A completes
      state = applyEvent(state, {
        ...baseEvent,
        eventType: 'EVALUATION_COMPLETE',
        participantName: 'Alice',
        modelName: 'SpeedDemon',
        submissionId: 'sub-1',
        results: { bestLapTime: 12450, totalLapTime: 62250, completedLapCount: 5, resetCount: 0, offTrackCount: 0 },
      });
      expect(state.completedModels).toBe(1);
      expect(state.streamUrl).toBeNull();
      expect(state.isExecutionRunning).toBe(false);

      // Leaderboard updates
      state = applyEvent(state, {
        ...baseEvent,
        eventType: 'LEADERBOARD_UPDATED',
        rankings: [
          {
            rank: 1,
            participantName: 'Alice',
            modelName: 'SpeedDemon',
            bestLapTime: 12450,
            submissionId: 'sub-1',
            avatar: {},
          },
        ],
      });
      expect(state.rankings).toHaveLength(1);

      // Model B starts
      state = applyEvent(state, {
        ...baseEvent,
        eventType: 'EVALUATION_STARTED',
        participantName: 'Bob',
        modelName: 'TurboBot',
        submissionId: 'sub-2',
        queuePosition: 2,
        totalModels: 3,
        completedModels: 1,
      });
      expect(state.participantName).toBe('Bob');

      // Model B completes with better time
      state = applyEvent(state, {
        ...baseEvent,
        eventType: 'EVALUATION_COMPLETE',
        participantName: 'Bob',
        modelName: 'TurboBot',
        submissionId: 'sub-2',
        results: { bestLapTime: 11200, totalLapTime: 56000, completedLapCount: 5, resetCount: 0, offTrackCount: 0 },
      });
      expect(state.completedModels).toBe(2);

      // Leaderboard updates with Bob in first
      state = applyEvent(state, {
        ...baseEvent,
        eventType: 'LEADERBOARD_UPDATED',
        rankings: [
          {
            rank: 1,
            participantName: 'Bob',
            modelName: 'TurboBot',
            bestLapTime: 11200,
            submissionId: 'sub-2',
            avatar: {},
          },
          {
            rank: 2,
            participantName: 'Alice',
            modelName: 'SpeedDemon',
            bestLapTime: 12450,
            submissionId: 'sub-1',
            avatar: {},
          },
        ],
      });
      expect(state.rankings[0].participantName).toBe('Bob');

      // Winner declared
      state = applyEvent(state, {
        ...baseEvent,
        eventType: 'WINNER_DECLARED',
        winnerId: 'sub-bob',
        winner: { participantName: 'Bob', modelName: 'TurboBot', bestLapTime: 11200, rank: 1, avatar: {} },
      });
      expect(state.winner?.participantName).toBe('Bob');
      expect(state.raceStatus).toBe('COMPLETED');
      expect(state.isExecutionRunning).toBe(false);
    });
  });

  describe('QUEUE_CHANGED', () => {
    const seededState = {
      ...initialState,
      queueItems: [
        {
          submissionId: 'sub-1',
          participantName: 'Alice',
          modelName: 'M1',
          queuePosition: 'a',
          status: 'PENDING' as const,
          submittedAt: '2026-01-01T00:00:00Z',
        },
        {
          submissionId: 'sub-2',
          participantName: 'Bob',
          modelName: 'M2',
          queuePosition: 'b',
          status: 'PENDING' as const,
          submittedAt: '2026-01-01T00:00:01Z',
        },
      ],
    };

    it('updates existing queue item status on QUEUE_CHANGED', () => {
      const state = applyEvent(seededState, {
        ...baseEvent,
        eventType: 'QUEUE_CHANGED',
        action: 'SKIP',
        submissionId: 'sub-1',
        newStatus: 'IN_PROGRESS',
      });
      expect(state.queueItems[0].status).toBe('IN_PROGRESS');
      expect(state.queueItems[1].status).toBe('PENDING');
    });

    it('updates status on RESET action', () => {
      const inProgressState = {
        ...seededState,
        queueItems: [{ ...seededState.queueItems[0], status: 'IN_PROGRESS' as const }, seededState.queueItems[1]],
      };
      const state = applyEvent(inProgressState, {
        ...baseEvent,
        eventType: 'QUEUE_CHANGED',
        action: 'RESET',
        submissionId: 'sub-1',
        newStatus: 'PENDING',
      });
      expect(state.queueItems[0].status).toBe('PENDING');
    });

    it('updates status on RETRY action', () => {
      const failedState = {
        ...seededState,
        queueItems: [{ ...seededState.queueItems[0], status: 'FAILED' as const }, seededState.queueItems[1]],
      };
      const state = applyEvent(failedState, {
        ...baseEvent,
        eventType: 'QUEUE_CHANGED',
        action: 'RETRY',
        submissionId: 'sub-1',
        newStatus: 'PENDING',
      });
      expect(state.queueItems[0].status).toBe('PENDING');
    });

    it('updates queue position on REORDER', () => {
      const state = applyEvent(seededState, {
        ...baseEvent,
        eventType: 'QUEUE_CHANGED',
        action: 'REORDER',
        submissionId: 'sub-2',
        newQueuePosition: 'Zz',
      });
      expect(state.queueItems[1].queuePosition).toBe('Zz');
    });

    it('removes item on REMOVE action', () => {
      const state = applyEvent(seededState, {
        ...baseEvent,
        eventType: 'QUEUE_CHANGED',
        action: 'REMOVE',
        submissionId: 'sub-1',
      });
      expect(state.queueItems).toHaveLength(1);
      expect(state.queueItems[0].submissionId).toBe('sub-2');
    });

    it('leaves state unchanged on SUBMISSION_ADDED (waits for REST refetch)', () => {
      const state = applyEvent(seededState, {
        ...baseEvent,
        eventType: 'QUEUE_CHANGED',
        action: 'SUBMISSION_ADDED',
        submissionId: 'sub-3',
      });
      expect(state.queueItems).toEqual(seededState.queueItems);
    });

    it('clears racer state and sets next pending on FAILED', () => {
      const inProgressState = {
        ...seededState,
        participantName: 'Alice',
        modelName: 'M1',
        streamUrl: 'https://stream.m3u8',
        isExecutionRunning: true,
        queueItems: [{ ...seededState.queueItems[0], status: 'IN_PROGRESS' as const }, seededState.queueItems[1]],
      };
      const state = applyEvent(inProgressState, {
        ...baseEvent,
        eventType: 'QUEUE_CHANGED',
        action: 'SKIP',
        submissionId: 'sub-1',
        newStatus: 'FAILED',
      });
      expect(state.queueItems[0].status).toBe('FAILED');
      expect(state.participantName).toBe('Bob');
      expect(state.modelName).toBe('M2');
      expect(state.streamUrl).toBeNull();
      expect(state.isExecutionRunning).toBe(false);
    });

    it('sets participantName to null on FAILED when no pending items remain', () => {
      const allInProgressState = {
        ...seededState,
        participantName: 'Alice',
        modelName: 'M1',
        streamUrl: 'https://stream.m3u8',
        isExecutionRunning: true,
        queueItems: [
          { ...seededState.queueItems[0], status: 'IN_PROGRESS' as const },
          { ...seededState.queueItems[1], status: 'COMPLETED' as const },
        ],
      };
      const state = applyEvent(allInProgressState, {
        ...baseEvent,
        eventType: 'QUEUE_CHANGED',
        action: 'SKIP',
        submissionId: 'sub-1',
        newStatus: 'FAILED',
      });
      expect(state.participantName).toBeNull();
      expect(state.modelName).toBeNull();
      expect(state.isExecutionRunning).toBe(false);
    });
  });
});
