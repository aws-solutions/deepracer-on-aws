// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RunStatus } from '@deepracer-indy/typescript-server-client';

import type { ResourceId } from '../../types/resource.js';
import { runDao } from '../RunDao.js';

// Mock the ElectroDB entity so no DynamoDB connection is needed.
vi.mock('#entities/RunsEntity.js', async () => {
  const actual = await vi.importActual<typeof import('../../entities/RunsEntity.js')>('../../entities/RunsEntity.js');
  const queryGoMock = vi.fn();
  const whereMock = vi.fn(() => ({ go: queryGoMock, where: () => ({ go: queryGoMock }) }));
  const queryMock = vi.fn(() => ({ go: queryGoMock, where: whereMock }));
  const patchWhereMock = vi.fn(() => ({ go: queryGoMock }));
  const patchSetMock = vi.fn(() => ({ where: patchWhereMock }));
  const patchMock = vi.fn(() => ({ set: patchSetMock }));
  return {
    ...actual,
    RunsEntity: {
      ...actual.RunsEntity,
      query: {
        byLeaderboardId: queryMock,
        byRacerInEvent: queryMock,
        byEventId: queryMock,
      },
      patch: patchMock,
    },
    __queryGoMock: queryGoMock,
    __queryMock: queryMock,
    __whereMock: whereMock,
    __patchMock: patchMock,
    __patchSetMock: patchSetMock,
    __patchWhereMock: patchWhereMock,
  };
});

const getQueryMocks = async () => {
  const mod = await import('../../entities/RunsEntity.js');
  const m = mod as typeof mod & {
    __queryGoMock: ReturnType<typeof vi.fn>;
    __queryMock: ReturnType<typeof vi.fn>;
    __whereMock: ReturnType<typeof vi.fn>;
    __patchMock: ReturnType<typeof vi.fn>;
    __patchSetMock: ReturnType<typeof vi.fn>;
    __patchWhereMock: ReturnType<typeof vi.fn>;
  };
  return {
    queryGoMock: m.__queryGoMock,
    queryMock: m.__queryMock,
    whereMock: m.__whereMock,
    patchMock: m.__patchMock,
    patchSetMock: m.__patchSetMock,
    patchWhereMock: m.__patchWhereMock,
  };
};

const MOCK_LEADERBOARD_ID = 'leaderboard-123' as ResourceId;
const MOCK_EVENT_ID = 'event-456' as ResourceId;
const MOCK_PROFILE_ID = 'profile-789' as ResourceId;
const MOCK_RUN = {
  runId: 'run-001',
  leaderboardId: MOCK_LEADERBOARD_ID,
  eventId: MOCK_EVENT_ID,
  profileId: MOCK_PROFILE_ID,
  runStatus: RunStatus.READY,
  racedByProxy: false,
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};

describe('RunDao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list()', () => {
    it('should query by leaderboardId and return data', async () => {
      const { queryGoMock, queryMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ cursor: null, data: [MOCK_RUN] });

      const result = await runDao.list({ leaderboardId: MOCK_LEADERBOARD_ID, eventId: MOCK_EVENT_ID });

      expect(queryMock).toHaveBeenCalledWith({ leaderboardId: MOCK_LEADERBOARD_ID });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].runId).toBe('run-001');
    });

    it('applies an eventId where filter before pagination', async () => {
      const { queryGoMock, whereMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ cursor: null, data: [MOCK_RUN] });

      await runDao.list({ leaderboardId: MOCK_LEADERBOARD_ID, eventId: MOCK_EVENT_ID });

      expect(whereMock).toHaveBeenCalled();
      expect(queryGoMock).toHaveBeenCalledWith(expect.objectContaining({ limit: expect.any(Number) }));
    });

    it('should apply a where filter when status is provided', async () => {
      const { queryGoMock, queryMock, whereMock } = await getQueryMocks();
      const filteredRun = { ...MOCK_RUN, runStatus: RunStatus.FINISHED };
      queryGoMock.mockResolvedValue({ cursor: null, data: [filteredRun] });

      const result = await runDao.list({
        leaderboardId: MOCK_LEADERBOARD_ID,
        eventId: MOCK_EVENT_ID,
        status: RunStatus.FINISHED,
      });

      expect(queryMock).toHaveBeenCalledWith({ leaderboardId: MOCK_LEADERBOARD_ID });
      expect(whereMock).toHaveBeenCalled();
      expect(result.data[0].runStatus).toBe(RunStatus.FINISHED);
    });

    it('should apply a where filter when eventId is provided', async () => {
      const { queryGoMock, queryMock, whereMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ cursor: null, data: [MOCK_RUN] });

      const result = await runDao.list({ leaderboardId: MOCK_LEADERBOARD_ID, eventId: MOCK_EVENT_ID });

      expect(queryMock).toHaveBeenCalledWith({ leaderboardId: MOCK_LEADERBOARD_ID });
      expect(whereMock).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('should apply a single combined where filter when both status and eventId are provided', async () => {
      const { queryGoMock, whereMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ cursor: null, data: [MOCK_RUN] });

      await runDao.list({ leaderboardId: MOCK_LEADERBOARD_ID, status: RunStatus.SUBMITTED, eventId: MOCK_EVENT_ID });

      expect(whereMock).toHaveBeenCalledTimes(1);
      const whereCallback = whereMock.mock.calls[0][0];
      const eqMock = vi.fn((_attr: unknown, value: unknown) => `eq(${value})`);
      const conditionString = whereCallback({}, { eq: eqMock });

      expect(eqMock).toHaveBeenCalledTimes(2);
      expect(conditionString).toBe(`eq(${RunStatus.SUBMITTED}) AND eq(${MOCK_EVENT_ID})`);
    });

    it('should forward cursor and maxResults on the filtered branch', async () => {
      const { queryGoMock, whereMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ cursor: 'next', data: [] });

      await runDao.list({
        leaderboardId: MOCK_LEADERBOARD_ID,
        eventId: MOCK_EVENT_ID,
        status: RunStatus.IN_PROGRESS,
        cursor: 'prev-token',
        maxResults: 3,
      });

      expect(whereMock).toHaveBeenCalled();
      expect(queryGoMock).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'prev-token', limit: 3 }));
    });

    it('should apply the event where filter when no status is provided', async () => {
      const { queryGoMock, queryMock, whereMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ cursor: null, data: [MOCK_RUN] });

      await runDao.list({ leaderboardId: MOCK_LEADERBOARD_ID, eventId: MOCK_EVENT_ID });

      expect(whereMock).toHaveBeenCalled();
      expect(queryMock).toHaveBeenCalledWith({ leaderboardId: MOCK_LEADERBOARD_ID });
    });

    it('should forward cursor and maxResults', async () => {
      const { queryGoMock, queryMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ cursor: 'next-token', data: [MOCK_RUN] });

      const result = await runDao.list({
        leaderboardId: MOCK_LEADERBOARD_ID,
        eventId: MOCK_EVENT_ID,
        cursor: 'prev-token',
        maxResults: 5,
      });

      expect(queryMock).toHaveBeenCalledWith({ leaderboardId: MOCK_LEADERBOARD_ID });
      expect(queryGoMock).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'prev-token', limit: 5 }));
      expect(result.cursor).toBe('next-token');
    });
  });

  describe('listByRacerInEvent()', () => {
    it('should query by eventId and profileId', async () => {
      const { queryGoMock, queryMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ cursor: null, data: [MOCK_RUN] });

      const result = await runDao.listByRacerInEvent({ eventId: MOCK_EVENT_ID, profileId: MOCK_PROFILE_ID });

      expect(queryMock).toHaveBeenCalledWith({ eventId: MOCK_EVENT_ID, profileId: MOCK_PROFILE_ID });
      expect(result.data).toHaveLength(1);
    });

    it('should return empty data when no runs found', async () => {
      const { queryGoMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ cursor: null, data: [] });

      const result = await runDao.listByRacerInEvent({ eventId: MOCK_EVENT_ID, profileId: MOCK_PROFILE_ID });

      expect(result.data).toHaveLength(0);
    });
  });

  describe('listAllByEvent()', () => {
    it('should query byEventId with pages: all and return the full data set', async () => {
      const { queryGoMock, queryMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ cursor: null, data: [MOCK_RUN] });

      const result = await runDao.listAllByEvent({ eventId: MOCK_EVENT_ID });

      expect(queryMock).toHaveBeenCalledWith({ eventId: MOCK_EVENT_ID });
      expect(queryGoMock).toHaveBeenCalledWith({ pages: 'all' });
      expect(result).toHaveLength(1);
      expect(result[0].runId).toBe('run-001');
    });

    it('should query byEventId with a caller-provided limit', async () => {
      const { queryGoMock, queryMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ cursor: 'next-token', data: [MOCK_RUN] });

      const result = await runDao.listAllByEvent({ eventId: MOCK_EVENT_ID, maxResults: 301 });

      expect(queryMock).toHaveBeenCalledWith({ eventId: MOCK_EVENT_ID });
      expect(queryGoMock).toHaveBeenCalledWith({ limit: 301 });
      expect(result).toHaveLength(1);
    });
    it('should return an empty array when no runs exist for the event', async () => {
      const { queryGoMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ cursor: null, data: [] });

      const result = await runDao.listAllByEvent({ eventId: MOCK_EVENT_ID });

      expect(result).toHaveLength(0);
    });
  });

  describe('transitionStatus()', () => {
    it('should patch the run status using a conditional write on the expected status', async () => {
      const { queryGoMock, patchMock, patchSetMock, patchWhereMock } = await getQueryMocks();
      queryGoMock.mockResolvedValue({ data: { ...MOCK_RUN, runStatus: RunStatus.IN_PROGRESS } });

      const result = await runDao.transitionStatus({
        leaderboardId: MOCK_LEADERBOARD_ID,
        runId: MOCK_RUN.runId as ResourceId,
        status: RunStatus.IN_PROGRESS,
        expectedStatus: RunStatus.READY,
      });

      expect(patchMock).toHaveBeenCalledWith({ leaderboardId: MOCK_LEADERBOARD_ID, runId: MOCK_RUN.runId });
      expect(patchSetMock).toHaveBeenCalledWith({ runStatus: RunStatus.IN_PROGRESS });
      expect(patchWhereMock).toHaveBeenCalled();
      expect(queryGoMock).toHaveBeenCalledWith({ response: 'all_new' });
      expect(result.runStatus).toBe(RunStatus.IN_PROGRESS);
    });

    it('should propagate a conditional check failure', async () => {
      const { queryGoMock } = await getQueryMocks();
      const conditionalError = { name: 'ConditionalCheckFailedException' };
      queryGoMock.mockRejectedValueOnce(conditionalError);

      await expect(
        runDao.transitionStatus({
          leaderboardId: MOCK_LEADERBOARD_ID,
          runId: MOCK_RUN.runId as ResourceId,
          status: RunStatus.IN_PROGRESS,
          expectedStatus: RunStatus.READY,
        }),
      ).rejects.toStrictEqual(conditionalError);
    });
  });
});
