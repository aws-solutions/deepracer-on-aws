// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ConflictError, InternalFailureError } from '@deepracer-indy/typescript-server-client';

import { TEST_LAP_ITEM, TEST_LEADERBOARD_ID, TEST_RUN_ID } from '../../constants/testConstants.js';
import type { ResourceId } from '../../types/resource.js';

const DEVICE_ID = 'mi-0123456789abcdef0' as ResourceId;
const mockRunsEntity = vi.hoisted(() => ({
  patch: vi.fn(),
}));

const mockLapsEntity = vi.hoisted(() => ({
  query: {
    byRunId: vi.fn(),
  },
  create: vi.fn(),
  parse: vi.fn(),
}));

const mockLapTokensEntity = vi.hoisted(() => ({
  create: vi.fn(),
}));

const mockTransactionGo = vi.hoisted(() => vi.fn());
const mockTransactionParams = vi.hoisted(() => vi.fn());
const mockTransactionWrite = vi.hoisted(() =>
  vi.fn(
    (
      callback: (entities: {
        runs: typeof mockRunsEntity;
        laps: typeof mockLapsEntity;
        lapTokens: typeof mockLapTokensEntity;
      }) => unknown,
    ) => {
      callback({ runs: mockRunsEntity, laps: mockLapsEntity, lapTokens: mockLapTokensEntity });
      return {
        go: mockTransactionGo,
        params: mockTransactionParams,
      };
    },
  ),
);

vi.mock('electrodb', async () => ({
  ...(await vi.importActual('electrodb')),
  Service: vi.fn(function () {
    return {
      entities: {
        runs: mockRunsEntity,
        laps: mockLapsEntity,
        lapTokens: mockLapTokensEntity,
      },
      transaction: {
        write: mockTransactionWrite,
      },
    };
  }),
}));

vi.mock('#entities/RunsEntity.js', async () => {
  const actual = await vi.importActual<typeof import('../../entities/RunsEntity.js')>('../../entities/RunsEntity.js');
  return { ...actual, RunsEntity: mockRunsEntity };
});

vi.mock('#entities/LapsEntity.js', async () => {
  const actual = await vi.importActual<typeof import('../../entities/LapsEntity.js')>('../../entities/LapsEntity.js');
  return { ...actual, LapsEntity: mockLapsEntity };
});

vi.mock('#entities/LapTokenEntity.js', async () => {
  const actual = await vi.importActual<typeof import('../../entities/LapTokenEntity.js')>(
    '../../entities/LapTokenEntity.js',
  );
  return { ...actual, LapTokenEntity: mockLapTokensEntity };
});

const { lapDao } = await import('../LapDao.js');

const MOCK_LEADERBOARD_ID = TEST_LEADERBOARD_ID;
const MOCK_RUN_ID = TEST_RUN_ID;
const MOCK_LAP = {
  leaderboardId: MOCK_LEADERBOARD_ID,
  runId: MOCK_RUN_ID,
  lapNumber: 1,
  lapTimeMs: 12500,
  isValid: true,
  resets: 0,
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};

describe('LapDao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listByRun()', () => {
    it('should query one page by leaderboardId and runId', async () => {
      const queryGoMock = vi.fn().mockResolvedValue({ cursor: 'next-page', data: [MOCK_LAP] });
      mockLapsEntity.query.byRunId.mockReturnValue({ go: queryGoMock });

      const result = await lapDao.listByRun({ leaderboardId: MOCK_LEADERBOARD_ID, runId: MOCK_RUN_ID });

      expect(mockLapsEntity.query.byRunId).toHaveBeenCalledWith({
        leaderboardId: MOCK_LEADERBOARD_ID,
        runId: MOCK_RUN_ID,
      });
      expect(queryGoMock).toHaveBeenCalledWith();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].lapNumber).toBe(1);
      expect(result.cursor).toBe('next-page');
    });

    it('should sort the returned page by lap number', async () => {
      const queryGoMock = vi.fn();
      mockLapsEntity.query.byRunId.mockReturnValue({ go: queryGoMock });
      const laps = [MOCK_LAP, { ...MOCK_LAP, lapNumber: 2 }, { ...MOCK_LAP, lapNumber: 3 }];
      queryGoMock.mockResolvedValue({ cursor: null, data: laps });

      const result = await lapDao.listByRun({ leaderboardId: MOCK_LEADERBOARD_ID, runId: MOCK_RUN_ID });

      expect(result.data).toHaveLength(3);
      expect(result.data.map((l) => l.lapNumber)).toEqual([1, 2, 3]);
    });

    it('should return empty array when the page has no laps', async () => {
      const queryGoMock = vi.fn().mockResolvedValue({ cursor: null, data: [] });
      mockLapsEntity.query.byRunId.mockReturnValue({ go: queryGoMock });

      const result = await lapDao.listByRun({ leaderboardId: MOCK_LEADERBOARD_ID, runId: MOCK_RUN_ID });

      expect(result.data).toHaveLength(0);
    });
  });

  describe('listAllLapsByRun()', () => {
    it('should query all pages by leaderboardId and runId', async () => {
      const queryGoMock = vi.fn().mockResolvedValue({ cursor: null, data: [MOCK_LAP] });
      mockLapsEntity.query.byRunId.mockReturnValue({ go: queryGoMock });

      const result = await lapDao.listAllLapsByRun({ leaderboardId: MOCK_LEADERBOARD_ID, runId: MOCK_RUN_ID });

      expect(mockLapsEntity.query.byRunId).toHaveBeenCalledWith({
        leaderboardId: MOCK_LEADERBOARD_ID,
        runId: MOCK_RUN_ID,
      });
      expect(queryGoMock).toHaveBeenCalledWith({ pages: 'all' });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('createNextLap()', () => {
    const INPUT = {
      leaderboardId: MOCK_LEADERBOARD_ID,
      runId: MOCK_RUN_ID,
      expectedLapCount: 0,
      lapTimeMs: 12500,
      resets: 0,
    };

    it('should atomically increment lapCount and create the lap in one transaction', async () => {
      type WhereCallback = (attr: { lapCount: string }, ops: { eq: (...args: unknown[]) => unknown }) => unknown;

      const runPatchWhereMock = vi.fn<(callback: WhereCallback) => { commit: () => string }>(() => ({
        commit: vi.fn(() => 'run-commit'),
      }));
      const runPatchAddMock = vi.fn(() => ({ where: runPatchWhereMock }));
      mockRunsEntity.patch.mockReturnValue({ add: runPatchAddMock });

      const lapCreateCommitMock = vi.fn(() => 'lap-commit');
      mockLapsEntity.create.mockReturnValue({ commit: lapCreateCommitMock });

      mockTransactionGo.mockResolvedValue({ canceled: false });
      mockTransactionParams.mockReturnValue({
        TransactItems: [{ Update: {} }, { Put: { mock: 'put-params' } }],
      });
      mockLapsEntity.parse.mockReturnValue({ data: { ...TEST_LAP_ITEM, lapNumber: 1 } });

      const result = await lapDao.createNextLap(INPUT);

      expect(mockRunsEntity.patch).toHaveBeenCalledWith({
        leaderboardId: MOCK_LEADERBOARD_ID,
        runId: MOCK_RUN_ID,
      });
      expect(runPatchAddMock).toHaveBeenCalledWith({ lapCount: 1 });

      // Assert the optimistic-concurrency guard was actually applied to the Run patch — without
      // this, a regression that drops the `.where(eq(lapCount, expectedLapCount))` condition
      // would still pass every other assertion in this test.
      expect(runPatchWhereMock).toHaveBeenCalledTimes(1);
      const whereCallback = runPatchWhereMock.mock.calls[0][0];
      const eqMock = vi.fn();
      whereCallback({ lapCount: 'lapCount' }, { eq: eqMock });
      expect(eqMock).toHaveBeenCalledWith('lapCount', INPUT.expectedLapCount);

      expect(mockLapsEntity.create).toHaveBeenCalledWith({
        leaderboardId: MOCK_LEADERBOARD_ID,
        runId: MOCK_RUN_ID,
        lapNumber: 1,
        lapTimeMs: 12500,
        resets: 0,
      });
      expect(mockTransactionWrite).toHaveBeenCalledWith(expect.any(Function));
      expect(mockLapsEntity.parse).toHaveBeenCalledWith({ mock: 'put-params' });
      expect(result.lapNumber).toBe(1);
    });

    it('should persist an optional deviceId on the created lap', async () => {
      const runPatchWhereMock = vi.fn(() => ({ commit: vi.fn(() => 'run-commit') }));
      const runPatchAddMock = vi.fn(() => ({ where: runPatchWhereMock }));
      mockRunsEntity.patch.mockReturnValue({ add: runPatchAddMock });

      mockLapsEntity.create.mockReturnValue({ commit: vi.fn(() => 'lap-commit') });
      mockTransactionGo.mockResolvedValue({ canceled: false });
      mockTransactionParams.mockReturnValue({
        TransactItems: [{ Update: {} }, { Put: { mock: 'put-params' } }],
      });
      mockLapsEntity.parse.mockReturnValue({ data: { ...TEST_LAP_ITEM, deviceId: DEVICE_ID } });

      await lapDao.createNextLap({ ...INPUT, deviceId: DEVICE_ID });

      expect(mockLapsEntity.create).toHaveBeenCalledWith({
        leaderboardId: MOCK_LEADERBOARD_ID,
        runId: MOCK_RUN_ID,
        lapNumber: 1,
        lapTimeMs: 12500,
        resets: 0,
        deviceId: DEVICE_ID,
      });
    });

    it('should not create a token guard item when no clientToken is provided', async () => {
      const runPatchWhereMock = vi.fn(() => ({ commit: vi.fn(() => 'run-commit') }));
      mockRunsEntity.patch.mockReturnValue({ add: vi.fn(() => ({ where: runPatchWhereMock })) });
      mockLapsEntity.create.mockReturnValue({ commit: vi.fn(() => 'lap-commit') });
      mockTransactionGo.mockResolvedValue({ canceled: false });
      mockTransactionParams.mockReturnValue({
        TransactItems: [{ Update: {} }, { Put: { mock: 'put-params' } }],
      });
      mockLapsEntity.parse.mockReturnValue({ data: { ...TEST_LAP_ITEM, lapNumber: 1 } });

      await lapDao.createNextLap(INPUT);

      expect(mockLapTokensEntity.create).not.toHaveBeenCalled();
    });

    it('should add a conditional token guard item when a clientToken is provided', async () => {
      const runPatchWhereMock = vi.fn(() => ({ commit: vi.fn(() => 'run-commit') }));
      mockRunsEntity.patch.mockReturnValue({ add: vi.fn(() => ({ where: runPatchWhereMock })) });
      mockLapsEntity.create.mockReturnValue({ commit: vi.fn(() => 'lap-commit') });
      const tokenCreateCommitMock = vi.fn(() => 'token-commit');
      mockLapTokensEntity.create.mockReturnValue({ commit: tokenCreateCommitMock });
      mockTransactionGo.mockResolvedValue({ canceled: false });
      // Lap Put stays at index 1; the token Put is index 2.
      mockTransactionParams.mockReturnValue({
        TransactItems: [{ Update: {} }, { Put: { mock: 'put-params' } }, { Put: { mock: 'token-params' } }],
      });
      mockLapsEntity.parse.mockReturnValue({ data: { ...TEST_LAP_ITEM, lapNumber: 1 } });

      const nowSeconds = Math.floor(Date.now() / 1000);
      const result = await lapDao.createNextLap({ ...INPUT, clientToken: 'token-abc' });

      expect(mockLapTokensEntity.create).toHaveBeenCalledTimes(1);
      const tokenArgs = mockLapTokensEntity.create.mock.calls[0][0] as {
        leaderboardId: string;
        runId: string;
        clientToken: string;
        lapNumber: number;
        ttl: number;
      };
      expect(tokenArgs).toMatchObject({
        leaderboardId: MOCK_LEADERBOARD_ID,
        runId: MOCK_RUN_ID,
        clientToken: 'token-abc',
        lapNumber: 1,
      });
      // TTL is ~24h in the future (allow a small window for execution time).
      expect(tokenArgs.ttl).toBeGreaterThanOrEqual(nowSeconds + 24 * 60 * 60 - 5);
      expect(tokenArgs.ttl).toBeLessThanOrEqual(nowSeconds + 24 * 60 * 60 + 5);
      // The lap is still parsed from TransactItems[1], not the token at index 2.
      expect(mockLapsEntity.parse).toHaveBeenCalledWith({ mock: 'put-params' });
      expect(result.lapNumber).toBe(1);
    });

    it('should throw ConflictError when a replayed clientToken cancels the transaction', async () => {
      const runPatchWhereMock = vi.fn(() => ({ commit: vi.fn() }));
      mockRunsEntity.patch.mockReturnValue({ add: vi.fn(() => ({ where: runPatchWhereMock })) });
      mockLapsEntity.create.mockReturnValue({ commit: vi.fn() });
      mockLapTokensEntity.create.mockReturnValue({ commit: vi.fn() });
      mockTransactionGo.mockResolvedValue({ canceled: true });

      await expect(lapDao.createNextLap({ ...INPUT, clientToken: 'token-abc' })).rejects.toBeInstanceOf(ConflictError);
    });
    it('should throw ConflictError when the transaction is canceled', async () => {
      const runPatchWhereMock = vi.fn(() => ({ commit: vi.fn() }));
      mockRunsEntity.patch.mockReturnValue({ add: vi.fn(() => ({ where: runPatchWhereMock })) });
      mockLapsEntity.create.mockReturnValue({ commit: vi.fn() });

      mockTransactionGo.mockResolvedValue({ canceled: true });

      await expect(lapDao.createNextLap(INPUT)).rejects.toBeInstanceOf(ConflictError);
    });

    it('should throw InternalFailureError when the created lap cannot be parsed', async () => {
      const runPatchWhereMock = vi.fn(() => ({ commit: vi.fn() }));
      mockRunsEntity.patch.mockReturnValue({ add: vi.fn(() => ({ where: runPatchWhereMock })) });
      mockLapsEntity.create.mockReturnValue({ commit: vi.fn() });

      mockTransactionGo.mockResolvedValue({ canceled: false });
      mockTransactionParams.mockReturnValue({ TransactItems: [{ Update: {} }, { Put: {} }] });
      mockLapsEntity.parse.mockReturnValue({ data: undefined });

      await expect(lapDao.createNextLap(INPUT)).rejects.toBeInstanceOf(InternalFailureError);
    });
  });
});
