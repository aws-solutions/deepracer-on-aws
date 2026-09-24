// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TransactWriteItem } from '@aws-sdk/client-dynamodb';
import { ConflictError, InternalFailureError, RunStatus } from '@deepracer-indy/typescript-server-client';

import { DEFAULT_MAX_QUERY_RESULTS } from '../../constants/defaults.js';
import { ELECTRO_DB_MAX_CONCURRENCY } from '../../constants/electroDB.js';
import { DynamoDBItemAttribute } from '../../constants/itemAttributes.js';
import {
  TEST_CURSOR,
  TEST_LEADERBOARD_ID,
  TEST_PROFILE_ID_1,
  TEST_RANKING_ITEM,
  TEST_RANKING_ITEMS,
  TEST_RUN_ID,
  TEST_SUBMISSION_ITEM,
} from '../../constants/testConstants.js';
import { SubmissionsEntity } from '../../entities/SubmissionsEntity.js';
import { electroDBEventLogger } from '../../utils/electroDBEventLogger.js';
import { marshallTransactWriteItem, rankingDao } from '../RankingDao.js';

const mockRankingsEntity = vi.hoisted(() => ({
  query: { sortedByRank: vi.fn(), byLeaderboardId: vi.fn() },
  get: vi.fn(),
  delete: vi.fn(),
  create: vi.fn(),
  patch: vi.fn(),
  parse: vi.fn(),
}));
const mockRunsEntity = vi.hoisted(() => ({ patch: vi.fn() }));
const mockSubmissionsEntity = vi.hoisted(() => ({ create: vi.fn(), parse: vi.fn() }));
const mockDynamoSend = vi.hoisted(() => vi.fn());

vi.mock('#utils/dynamoDBClient.js', () => ({ dynamoDBClient: { send: mockDynamoSend } }));
vi.mock('#entities/RankingsEntity.js', () => ({ RankingsEntity: mockRankingsEntity }));
vi.mock('#entities/RunsEntity.js', () => ({ RunsEntity: mockRunsEntity }));
vi.mock('#entities/SubmissionsEntity.js', () => ({ SubmissionsEntity: mockSubmissionsEntity }));

const SUBMISSION_INPUT: Parameters<(typeof rankingDao)['recordSubmission']>[0]['submission'] = {
  ...TEST_SUBMISSION_ITEM,
  rankingScore: 10000,
};
const BETTER_SUBMISSION_INPUT: Parameters<(typeof rankingDao)['recordSubmission']>[0]['submission'] = {
  ...SUBMISSION_INPUT,
  rankingScore: 1000,
};
const recordInput = (submission: typeof SUBMISSION_INPUT) => ({
  runId: TEST_RUN_ID,
  submission,
  stats: TEST_RANKING_ITEM.stats,
  userProfile: TEST_RANKING_ITEM.userProfile,
});
const rankingConditionFailure = {
  name: 'TransactionCanceledException',
  CancellationReasons: [{ Code: 'None' }, { Code: 'None' }, { Code: 'ConditionalCheckFailed' }],
};

describe('RankingDao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listByRank()', () => {
    const mockSortedByRankGo = vi.fn();

    beforeEach(() => {
      vi.mocked(mockRankingsEntity.query.sortedByRank).mockReturnValue({ go: mockSortedByRankGo } as never);
    });

    it('queries the sortedByRank index with the default cursor and page size', async () => {
      mockSortedByRankGo.mockResolvedValue({ cursor: null, data: TEST_RANKING_ITEMS });

      const result = await rankingDao.listByRank({ leaderboardId: TEST_LEADERBOARD_ID });

      expect(mockRankingsEntity.query.sortedByRank).toHaveBeenCalledWith({ leaderboardId: TEST_LEADERBOARD_ID });
      expect(mockSortedByRankGo).toHaveBeenCalledWith({
        cursor: null,
        limit: DEFAULT_MAX_QUERY_RESULTS,
        order: 'asc',
      });
      expect(result.data).toEqual(TEST_RANKING_ITEMS);
    });

    it('forwards a caller-provided cursor and maxResults', async () => {
      mockSortedByRankGo.mockResolvedValue({ cursor: 'next-token', data: [] });

      const result = await rankingDao.listByRank({
        leaderboardId: TEST_LEADERBOARD_ID,
        cursor: TEST_CURSOR,
        maxResults: 5,
      });

      expect(mockSortedByRankGo).toHaveBeenCalledWith({ cursor: TEST_CURSOR, limit: 5, order: 'asc' });
      expect(result.cursor).toBe('next-token');
    });
  });

  describe('getWithRank()', () => {
    const rankArgs = { leaderboardId: TEST_LEADERBOARD_ID, profileId: TEST_PROFILE_ID_1 };
    const mockRankingGo = vi.fn();
    const mockBetterRankingsGo = vi.fn();

    beforeEach(() => {
      vi.mocked(mockRankingsEntity.get).mockReturnValue({ go: mockRankingGo } as never);
      vi.mocked(mockRankingsEntity.query.sortedByRank).mockReturnValue({
        lt: vi.fn().mockReturnValue({ go: mockBetterRankingsGo }),
      } as never);
    });

    it('returns null when the profile has no Ranking', async () => {
      mockRankingGo.mockResolvedValue({ data: null });

      await expect(rankingDao.getWithRank(rankArgs)).resolves.toBeNull();
      expect(mockRankingsEntity.get).toHaveBeenCalledWith(rankArgs);
    });

    it('returns the Ranking with a 1-based rank ahead of it', async () => {
      mockRankingGo.mockResolvedValue({ data: TEST_RANKING_ITEM });
      mockBetterRankingsGo.mockResolvedValue({ data: TEST_RANKING_ITEMS.slice(1) });

      const result = await rankingDao.getWithRank(rankArgs);

      expect(mockRankingsEntity.query.sortedByRank).toHaveBeenCalledWith({ leaderboardId: TEST_LEADERBOARD_ID });
      expect(mockBetterRankingsGo).toHaveBeenCalledWith({ order: 'asc', pages: 'all' });
      expect(result).toEqual({ ...TEST_RANKING_ITEM, rank: TEST_RANKING_ITEMS.length });
    });
  });

  describe('recordSubmission()', () => {
    const mockRankingRead = (...rankings: (typeof TEST_RANKING_ITEM | null)[]) => {
      const go = vi.fn();
      rankings.forEach((ranking) => go.mockResolvedValueOnce({ data: ranking }));
      vi.mocked(mockRankingsEntity.get).mockReturnValue({ go } as never);
    };

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(SubmissionsEntity.create).mockReturnValue({
        params: vi.fn(() => ({
          Item: { submissionId: TEST_SUBMISSION_ITEM.submissionId },
          TableName: 'test-table',
        })),
      } as never);
      vi.mocked(mockRunsEntity.patch).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            params: vi.fn(() => ({
              ExpressionAttributeValues: { ':status': RunStatus.SUBMITTED },
              Key: { runId: TEST_RUN_ID },
              TableName: 'test-table',
              UpdateExpression: 'SET #status = :status',
            })),
          })),
        })),
      } as never);
      vi.mocked(mockRankingsEntity.create).mockReturnValue({
        params: vi.fn(() => ({
          Item: { rankingScore: 1000 },
          TableName: 'test-table',
        })),
      } as never);
      vi.mocked(mockRankingsEntity.patch).mockReturnValue({
        add: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              params: vi.fn(() => ({
                ExpressionAttributeValues: { ':score': 1000 },
                Key: { profileId: TEST_SUBMISSION_ITEM.profileId },
                TableName: 'test-table',
                UpdateExpression: 'SET #score = :score',
              })),
            })),
          })),
        })),
      } as never);
      vi.mocked(SubmissionsEntity.parse).mockReturnValue({ data: TEST_SUBMISSION_ITEM } as never);
    });

    it.each(['rankingScore', 'modelName', 'submissionId', 'submissionNumber'])(
      'throws InternalFailureError when %s is missing from the submission',
      async (field) => {
        const incompleteSubmission = { ...SUBMISSION_INPUT } as Record<string, unknown>;
        delete incompleteSubmission[field];

        await expect(
          rankingDao.recordSubmission(recordInput(incompleteSubmission as typeof SUBMISSION_INPUT)),
        ).rejects.toBeInstanceOf(InternalFailureError);
        expect(mockDynamoSend).not.toHaveBeenCalled();
      },
    );

    it('atomically advances the Run, creates the Submission, and creates a Ranking when none exists', async () => {
      mockRankingRead(null);
      mockDynamoSend.mockResolvedValue({});

      const result = await rankingDao.recordSubmission(recordInput(SUBMISSION_INPUT));

      expect(mockDynamoSend).toHaveBeenCalledTimes(1);
      const command = mockDynamoSend.mock.calls[0][0] as {
        input: {
          TransactItems: {
            Put?: { Item?: Record<string, { S?: string }> };
            Update?: {
              ExpressionAttributeValues?: Record<string, { S?: string }>;
              Key?: Record<string, { S?: string }>;
            };
          }[];
        };
      };
      expect(command.input.TransactItems[0].Update?.Key?.runId).toEqual({ S: TEST_RUN_ID });
      expect(command.input.TransactItems[0].Update?.ExpressionAttributeValues?.[':status']).toEqual({
        S: RunStatus.SUBMITTED,
      });
      expect(command.input.TransactItems[1].Put?.Item?.submissionId).toEqual({
        S: TEST_SUBMISSION_ITEM.submissionId,
      });
      expect(mockRunsEntity.patch).toHaveBeenCalledWith({
        leaderboardId: SUBMISSION_INPUT.leaderboardId,
        runId: TEST_RUN_ID,
      });
      const runPatch = vi.mocked(mockRunsEntity.patch).mock.results[0].value as { set: ReturnType<typeof vi.fn> };
      expect(runPatch.set).toHaveBeenCalledWith({
        [DynamoDBItemAttribute.RUN_STATUS]: RunStatus.SUBMITTED,
        [DynamoDBItemAttribute.SUBMISSION_ID]: SUBMISSION_INPUT.submissionId,
      });
      expect(SubmissionsEntity.create).toHaveBeenCalledWith(SUBMISSION_INPUT);
      expect(mockRankingsEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          leaderboardId: SUBMISSION_INPUT.leaderboardId,
          profileId: SUBMISSION_INPUT.profileId,
          rankingScore: SUBMISSION_INPUT.rankingScore,
          submissionVideoS3Location: '',
          stats: TEST_RANKING_ITEM.stats,
          userProfile: TEST_RANKING_ITEM.userProfile,
        }),
      );
      expect(result).toEqual(TEST_SUBMISSION_ITEM);
    });

    it('patches score/submission fields plus stats and userProfile, incrementing the application item version', async () => {
      mockRankingRead(TEST_RANKING_ITEM);
      mockDynamoSend.mockResolvedValue({});

      await rankingDao.recordSubmission(recordInput(BETTER_SUBMISSION_INPUT));

      expect(mockRankingsEntity.create).not.toHaveBeenCalled();
      const rankingPatch = vi.mocked(mockRankingsEntity.patch).mock.results[0].value as {
        add: ReturnType<typeof vi.fn>;
      };
      expect(rankingPatch.add).toHaveBeenCalledWith({ [DynamoDBItemAttribute.VERSION]: 1 });
      const addResult = rankingPatch.add.mock.results[0].value as { set: ReturnType<typeof vi.fn> };
      expect(addResult.set).toHaveBeenCalledWith({
        rankingScore: BETTER_SUBMISSION_INPUT.rankingScore,
        modelId: BETTER_SUBMISSION_INPUT.modelId,
        modelName: BETTER_SUBMISSION_INPUT.modelName,
        submissionId: BETTER_SUBMISSION_INPUT.submissionId,
        submissionNumber: BETTER_SUBMISSION_INPUT.submissionNumber,
        stats: TEST_RANKING_ITEM.stats,
        userProfile: TEST_RANKING_ITEM.userProfile,
      });
      expect(addResult.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ submissionVideoS3Location: expect.anything() }),
      );
    });

    it('conditions the Ranking patch on the stored score being worse than the candidate score', async () => {
      mockRankingRead(TEST_RANKING_ITEM);
      mockDynamoSend.mockResolvedValue({});

      await rankingDao.recordSubmission(recordInput(BETTER_SUBMISSION_INPUT));

      const rankingPatch = vi.mocked(mockRankingsEntity.patch).mock.results[0].value as {
        add: ReturnType<typeof vi.fn>;
      };
      const addResult = rankingPatch.add.mock.results[0].value as { set: ReturnType<typeof vi.fn> };
      const setResult = addResult.set.mock.results[0].value as { where: ReturnType<typeof vi.fn> };
      const whereCallback = setResult.where.mock.calls[0][0] as (
        attr: { rankingScore: string },
        ops: { gt: (attr: unknown, value: unknown) => string },
      ) => string;
      expect(whereCallback({ rankingScore: 'rankingScore' }, { gt: (attr, value) => `${attr} > ${value}` })).toEqual(
        `rankingScore > ${BETTER_SUBMISSION_INPUT.rankingScore}`,
      );
    });

    it('records only the Run transition and Submission when the score is not better than the current Ranking', async () => {
      mockRankingRead(TEST_RANKING_ITEM);
      mockDynamoSend.mockResolvedValue({});

      await rankingDao.recordSubmission(recordInput(SUBMISSION_INPUT));

      expect(mockRunsEntity.patch).toHaveBeenCalledTimes(1);
      expect(SubmissionsEntity.create).toHaveBeenCalledWith(SUBMISSION_INPUT);
      expect(mockRankingsEntity.create).not.toHaveBeenCalled();
      expect(mockRankingsEntity.patch).not.toHaveBeenCalled();
    });

    it('conditions the Run patch on the stored status being FINISHED', async () => {
      mockRankingRead(null);
      mockDynamoSend.mockResolvedValue({});

      await rankingDao.recordSubmission(recordInput(SUBMISSION_INPUT));

      const runPatch = vi.mocked(mockRunsEntity.patch).mock.results[0].value as { set: ReturnType<typeof vi.fn> };
      const setResult = runPatch.set.mock.results[0].value as { where: ReturnType<typeof vi.fn> };
      const whereCallback = setResult.where.mock.calls[0][0] as (
        attr: { runStatus: string },
        ops: { eq: (attr: unknown, value: unknown) => string },
      ) => string;
      expect(whereCallback({ runStatus: 'runStatus' }, { eq: (attr, value) => `${attr} = ${value}` })).toEqual(
        `runStatus = ${RunStatus.FINISHED}`,
      );
    });

    it('re-reads and retries after a concurrent first-Ranking create, then patches the better score', async () => {
      mockRankingRead(null, TEST_RANKING_ITEM);
      mockDynamoSend.mockRejectedValueOnce(rankingConditionFailure).mockResolvedValueOnce({});

      await rankingDao.recordSubmission(recordInput(BETTER_SUBMISSION_INPUT));

      expect(mockDynamoSend).toHaveBeenCalledTimes(2);
      expect(mockRunsEntity.patch).toHaveBeenCalledTimes(2);
      expect(SubmissionsEntity.create).toHaveBeenCalledTimes(2);
      expect(mockRankingsEntity.create).toHaveBeenCalledTimes(1);
      expect(mockRankingsEntity.patch).toHaveBeenCalledTimes(1);
    });

    it('retries a Ranking conflict by recording only the Submission when a better Ranking now exists', async () => {
      mockRankingRead(TEST_RANKING_ITEM, { ...TEST_RANKING_ITEM, rankingScore: 500 });
      mockDynamoSend.mockRejectedValueOnce(rankingConditionFailure).mockResolvedValueOnce({});

      await rankingDao.recordSubmission(recordInput(BETTER_SUBMISSION_INPUT));

      expect(mockDynamoSend).toHaveBeenCalledTimes(2);
      expect(mockRankingsEntity.patch).toHaveBeenCalledTimes(1);
      expect(mockRankingsEntity.create).not.toHaveBeenCalled();
    });

    it('throws ConflictError after the bounded retry also loses a Ranking condition', async () => {
      mockRankingRead(TEST_RANKING_ITEM, TEST_RANKING_ITEM);
      mockDynamoSend.mockRejectedValue(rankingConditionFailure);

      await expect(rankingDao.recordSubmission(recordInput(BETTER_SUBMISSION_INPUT))).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect(mockDynamoSend).toHaveBeenCalledTimes(2);
    });

    it('throws ConflictError without retrying when the Run is no longer FINISHED', async () => {
      mockRankingRead(null);
      mockDynamoSend.mockRejectedValue({
        name: 'TransactionCanceledException',
        CancellationReasons: [{ Code: 'ConditionalCheckFailed' }, { Code: 'None' }, { Code: 'None' }],
      });

      await expect(rankingDao.recordSubmission(recordInput(SUBMISSION_INPUT))).rejects.toBeInstanceOf(ConflictError);
      expect(mockDynamoSend).toHaveBeenCalledTimes(1);
    });

    it('throws InternalFailureError when the Submission item fails its condition', async () => {
      mockRankingRead(null);
      mockDynamoSend.mockRejectedValue({
        name: 'TransactionCanceledException',
        CancellationReasons: [{ Code: 'None' }, { Code: 'ConditionalCheckFailed' }, { Code: 'None' }],
      });

      await expect(rankingDao.recordSubmission(recordInput(SUBMISSION_INPUT))).rejects.toBeInstanceOf(
        InternalFailureError,
      );
      expect(mockDynamoSend).toHaveBeenCalledTimes(1);
    });

    it('rethrows transaction errors unrelated to cancellation', async () => {
      mockRankingRead(null);
      const unexpectedError = new Error('unexpected DynamoDB failure');
      mockDynamoSend.mockRejectedValue(unexpectedError);

      await expect(rankingDao.recordSubmission(recordInput(SUBMISSION_INPUT))).rejects.toStrictEqual(unexpectedError);
      expect(mockDynamoSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteByLeaderboardId()', () => {
    const mockByLeaderboardIdGo = vi.fn();
    const mockDeleteGo = vi.fn();

    beforeEach(() => {
      vi.mocked(mockRankingsEntity.query.byLeaderboardId).mockReturnValue({ go: mockByLeaderboardIdGo } as never);
      vi.mocked(mockRankingsEntity.delete).mockReturnValue({ go: mockDeleteGo } as never);
    });

    it('deletes every Ranking in the leaderboard and reports the unprocessed count', async () => {
      mockByLeaderboardIdGo.mockResolvedValue({ data: TEST_RANKING_ITEMS });
      mockDeleteGo.mockResolvedValue({ unprocessed: [TEST_RANKING_ITEMS[2]] });

      await rankingDao.deleteByLeaderboardId(TEST_LEADERBOARD_ID);

      expect(mockRankingsEntity.query.byLeaderboardId).toHaveBeenCalledWith({ leaderboardId: TEST_LEADERBOARD_ID });
      expect(mockByLeaderboardIdGo).toHaveBeenCalledWith({ pages: 'all' });
      expect(mockRankingsEntity.delete).toHaveBeenCalledWith(TEST_RANKING_ITEMS);
      expect(mockDeleteGo).toHaveBeenCalledWith({
        concurrency: ELECTRO_DB_MAX_CONCURRENCY,
        logger: electroDBEventLogger,
      });
    });
  });

  describe('marshallTransactWriteItem()', () => {
    it('marshals the Item of a Put transaction item', () => {
      const item = {
        Put: { Item: { submissionId: TEST_SUBMISSION_ITEM.submissionId }, TableName: 'test-table' },
      } as unknown as TransactWriteItem;

      expect(marshallTransactWriteItem(item)).toEqual({
        Put: { Item: { submissionId: { S: TEST_SUBMISSION_ITEM.submissionId } }, TableName: 'test-table' },
      });
    });

    it('marshals the Key and ExpressionAttributeValues of an Update transaction item', () => {
      const item = {
        Update: {
          ExpressionAttributeValues: { ':status': RunStatus.SUBMITTED },
          Key: { runId: TEST_RUN_ID },
          TableName: 'test-table',
          UpdateExpression: 'SET #status = :status',
        },
      } as unknown as TransactWriteItem;

      expect(marshallTransactWriteItem(item)).toEqual({
        Update: {
          ExpressionAttributeValues: { ':status': { S: RunStatus.SUBMITTED } },
          Key: { runId: { S: TEST_RUN_ID } },
          TableName: 'test-table',
          UpdateExpression: 'SET #status = :status',
        },
      });
    });

    it('returns transaction items without Put or Update unchanged', () => {
      const item = { Delete: { Key: { pk: 'pk' }, TableName: 'test-table' } } as unknown as TransactWriteItem;

      expect(marshallTransactWriteItem(item)).toBe(item);
    });
  });
});
