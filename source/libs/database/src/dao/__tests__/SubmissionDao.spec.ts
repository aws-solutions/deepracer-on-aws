// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  TEST_CURSOR,
  TEST_LEADERBOARD_ID,
  TEST_LEADERBOARD_ITEM,
  TEST_PROFILE_ID_1,
  TEST_SUBMISSION_ID_1,
  TEST_SUBMISSION_ITEM,
  TEST_SUBMISSION_ITEMS,
} from '../../constants/testConstants.js';
import { LeaderboardsEntity } from '../../entities/LeaderboardsEntity.js';
import { SubmissionsEntity } from '../../entities/SubmissionsEntity.js';
import { submissionDao } from '../SubmissionDao.js';

const mockLeaderboardsEntity = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
}));

const mockRankingsEntity = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
}));

const mockSubmissionsEntity = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  query: {
    byProfileId: vi.fn(),
    sortedByCreatedAt: vi.fn(),
  },
  delete: vi.fn(),
  patch: vi.fn(),
}));

const mockTransactionGo = vi.hoisted(() => vi.fn());
const mockTransactionWrite = vi.hoisted(() =>
  vi.fn(
    (
      callback: (entities: {
        submissions: typeof mockSubmissionsEntity;
        leaderboards: typeof mockLeaderboardsEntity;
        rankings: typeof mockRankingsEntity;
      }) => unknown,
    ) => {
      callback({
        submissions: mockSubmissionsEntity,
        leaderboards: mockLeaderboardsEntity,
        rankings: mockRankingsEntity,
      });
      return {
        go: mockTransactionGo,
        params: vi.fn(),
      };
    },
  ),
);

vi.mock('electrodb', async () => ({
  ...(await vi.importActual('electrodb')),
  Service: vi.fn(function () {
    return {
      entities: {
        leaderboards: mockLeaderboardsEntity,
        submissions: mockSubmissionsEntity,
        rankings: mockRankingsEntity,
      },
      transaction: {
        write: mockTransactionWrite,
      },
    };
  }),
}));

vi.mock('#entities/LeaderboardsEntity.js', () => ({
  LeaderboardsEntity: mockLeaderboardsEntity,
}));

vi.mock('#entities/RankingsEntity.js', () => ({
  RankingsEntity: mockRankingsEntity,
}));

vi.mock('#entities/SubmissionsEntity.js', () => ({
  SubmissionsEntity: mockSubmissionsEntity,
}));

describe('SubmissionDao', () => {
  describe('deleteByLeaderboardId()', () => {
    it('should delete submissions by leaderboard ID', async () => {
      const mockLeaderboard = {
        ...TEST_LEADERBOARD_ITEM,
        submittedProfiles: [TEST_SUBMISSION_ITEMS[0].profileId, TEST_SUBMISSION_ITEMS[1].profileId],
      };

      vi.mocked(LeaderboardsEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockLeaderboard }),
        params: vi.fn(),
      });

      vi.mocked(SubmissionsEntity.query.byProfileId).mockReturnValue({
        begins: vi.fn(),
        between: vi.fn(),
        gt: vi.fn(),
        gte: vi.fn(),
        lt: vi.fn(),
        lte: vi.fn(),
        go: vi.fn().mockResolvedValue({ data: TEST_SUBMISSION_ITEMS }),
        params: vi.fn(),
        where: vi.fn(),
      });

      vi.mocked(SubmissionsEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({ unprocessed: [] }),
        params: vi.fn(),
      });

      await submissionDao.deleteByLeaderboardId(mockLeaderboard.leaderboardId);

      expect(LeaderboardsEntity.get).toHaveBeenCalledWith({ leaderboardId: mockLeaderboard.leaderboardId });

      for (const profileId of mockLeaderboard.submittedProfiles) {
        expect(SubmissionsEntity.query.byProfileId).toHaveBeenCalledWith({
          leaderboardId: mockLeaderboard.leaderboardId,
          profileId,
        });
        expect(SubmissionsEntity.delete).toHaveBeenCalledWith(TEST_SUBMISSION_ITEMS);
      }
    });
  });

  describe('getStoppableSubmission()', () => {
    it('should return a stoppable submission if found', async () => {
      vi.mocked(SubmissionsEntity.query.byProfileId).mockReturnValue({
        begins: vi.fn(),
        between: vi.fn(),
        gt: vi.fn(),
        gte: vi.fn(),
        lt: vi.fn(),
        lte: vi.fn(),
        go: vi.fn(),
        params: vi.fn(),
        where: vi.fn(() => ({
          go: vi.fn(),
          params: vi.fn(),
          where: vi.fn(() => ({
            go: vi.fn().mockResolvedValue({ data: [TEST_SUBMISSION_ITEM] }),
            params: vi.fn(),
            where: vi.fn(),
          })),
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const result = await submissionDao.getStoppableSubmission(
        TEST_SUBMISSION_ITEM.modelId,
        TEST_SUBMISSION_ITEM.profileId,
      );

      expect(result).toEqual(TEST_SUBMISSION_ITEM);
      expect(SubmissionsEntity.query.byProfileId).toHaveBeenCalledWith({
        profileId: TEST_SUBMISSION_ITEM.profileId,
      });
    });

    it('should return null if no stoppable submission is found', async () => {
      vi.mocked(SubmissionsEntity.query.byProfileId).mockReturnValue({
        begins: vi.fn(),
        between: vi.fn(),
        gt: vi.fn(),
        gte: vi.fn(),
        lt: vi.fn(),
        lte: vi.fn(),
        go: vi.fn(),
        params: vi.fn(),
        where: vi.fn(() => ({
          go: vi.fn(),
          params: vi.fn(),
          where: vi.fn(() => ({
            go: vi.fn().mockResolvedValue({ data: [] }),
            params: vi.fn(),
            where: vi.fn(),
          })),
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const result = await submissionDao.getStoppableSubmission(
        TEST_SUBMISSION_ITEM.modelId,
        TEST_SUBMISSION_ITEM.profileId,
      );

      expect(result).toBeNull();
      expect(SubmissionsEntity.query.byProfileId).toHaveBeenCalledWith({
        profileId: TEST_SUBMISSION_ITEM.profileId,
      });
    });
  });

  describe('listByCreatedAt()', () => {
    it('should correctly use SubmissionsEntity to list submissions by created date', async () => {
      const testParams: Parameters<(typeof submissionDao)['listByCreatedAt']>[0] = {
        cursor: TEST_CURSOR,
        maxResults: 10,
        profileId: TEST_SUBMISSION_ITEM.profileId,
        leaderboardId: TEST_SUBMISSION_ITEM.leaderboardId,
      };

      const mockGo = vi.fn().mockResolvedValue({ cursor: TEST_CURSOR, data: TEST_SUBMISSION_ITEMS });

      vi.mocked(SubmissionsEntity.query.sortedByCreatedAt).mockReturnValue({
        begins: vi.fn(),
        between: vi.fn(),
        gt: vi.fn(),
        gte: vi.fn(),
        lt: vi.fn(),
        lte: vi.fn(),
        go: mockGo,
        params: vi.fn(),
        where: vi.fn(),
      });

      const result = await submissionDao.listByCreatedAt(testParams);

      expect(result.data).toEqual(TEST_SUBMISSION_ITEMS);
      expect(result.cursor).toEqual(TEST_CURSOR);
      expect(SubmissionsEntity.query.sortedByCreatedAt).toHaveBeenCalledWith({
        leaderboardId: testParams.leaderboardId,
        profileId: testParams.profileId,
      });
      expect(mockGo).toHaveBeenCalledWith({
        cursor: testParams.cursor,
        limit: testParams.maxResults,
        order: 'desc',
      });
    });
  });

  describe('updateScoreWithRanking()', () => {
    const mockRankingGet = (data: { submissionId: string; rankingScore: number } | null) => {
      mockRankingsEntity.get.mockReturnValue({ go: vi.fn().mockResolvedValue({ data }) });
    };

    const mockProfileSubmissions = (
      submissions: { submissionId: string; submissionNumber: number; rankingScore: number }[],
    ) => {
      mockSubmissionsEntity.query.byProfileId.mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: submissions }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    };

    it('should update the ranking when this submission is the one currently reflected on the leaderboard, even if the recomputed score is worse', async () => {
      // The Ranking already points at TEST_SUBMISSION_ID_1 with a score of 15000. Recomputing to
      // 18000 (worse, but still the racer's only/best submission) must still update the Ranking,
      // since it must stay consistent with the submission it's currently pointing at — this
      // proves the "is current best submission" branch drives the update on its own.
      mockRankingGet({ submissionId: TEST_SUBMISSION_ID_1, rankingScore: 15000 });
      mockProfileSubmissions([{ submissionId: TEST_SUBMISSION_ID_1, submissionNumber: 2, rankingScore: 15000 }]);

      const submissionPatchSetMock = vi.fn(() => ({ commit: vi.fn(() => 'submission-commit') }));
      mockSubmissionsEntity.patch.mockReturnValue({ set: submissionPatchSetMock });

      type WhereCallback = (attr: { rankingScore: string }, ops: { eq: (...args: unknown[]) => unknown }) => unknown;

      const rankingPatchWhereMock = vi.fn<(callback: WhereCallback) => { commit: () => string }>(() => ({
        commit: vi.fn(() => 'ranking-commit'),
      }));
      const rankingPatchSetMock = vi.fn(() => ({ where: rankingPatchWhereMock }));
      mockRankingsEntity.patch.mockReturnValue({ set: rankingPatchSetMock });

      mockTransactionGo.mockResolvedValue({ canceled: false });

      await submissionDao.updateScoreWithRanking({
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
        submissionId: TEST_SUBMISSION_ID_1,
        rankingScore: 18000,
      });

      expect(mockSubmissionsEntity.patch).toHaveBeenCalledWith({
        profileId: TEST_PROFILE_ID_1,
        leaderboardId: TEST_LEADERBOARD_ID,
        submissionId: TEST_SUBMISSION_ID_1,
      });
      expect(submissionPatchSetMock).toHaveBeenCalledWith({ rankingScore: 18000 });
      expect(mockRankingsEntity.patch).toHaveBeenCalledWith({
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
      });
      // Same submission as before — score and identifying fields both reflect this submission.
      expect(rankingPatchSetMock).toHaveBeenCalledWith({
        rankingScore: 18000,
        submissionId: TEST_SUBMISSION_ID_1,
        submissionNumber: 2,
      });

      // Assert the optimistic-concurrency guard was actually applied to the Ranking patch —
      // without this, a regression that drops the `.where(eq(rankingScore, currentRanking))`
      // condition would still pass every other assertion in this test.
      expect(rankingPatchWhereMock).toHaveBeenCalledTimes(1);
      const whereCallback = rankingPatchWhereMock.mock.calls[0][0];
      const eqMock = vi.fn();
      whereCallback({ rankingScore: 'rankingScore' }, { eq: eqMock });
      expect(eqMock).toHaveBeenCalledWith('rankingScore', 15000);

      expect(mockTransactionWrite).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should re-promote a different, still-better submission when the current-best submission is downgraded', async () => {
      // Regression test for the AutoSDE finding: the Ranking points at TEST_SUBMISSION_ID_1
      // (score 12000). It gets edited to a WORSE score (16000), but the racer has another
      // submission ("other-submission-id") at 13000 — still better than the newly-edited
      // submission's 16000. The Ranking must be re-pointed at "other-submission-id" with its own
      // score, not left showing TEST_SUBMISSION_ID_1's now-worse 16000.
      const otherSubmissionId = 'other-submission-id';
      mockRankingGet({ submissionId: TEST_SUBMISSION_ID_1, rankingScore: 12000 });
      mockProfileSubmissions([
        { submissionId: TEST_SUBMISSION_ID_1, submissionNumber: 2, rankingScore: 12000 },
        { submissionId: otherSubmissionId, submissionNumber: 1, rankingScore: 13000 },
      ]);

      const submissionPatchSetMock = vi.fn(() => ({ commit: vi.fn(() => 'submission-commit') }));
      mockSubmissionsEntity.patch.mockReturnValue({ set: submissionPatchSetMock });

      type WhereCallback = (attr: { rankingScore: string }, ops: { eq: (...args: unknown[]) => unknown }) => unknown;
      const rankingPatchWhereMock = vi.fn<(callback: WhereCallback) => { commit: () => string }>(() => ({
        commit: vi.fn(() => 'ranking-commit'),
      }));
      const rankingPatchSetMock = vi.fn(() => ({ where: rankingPatchWhereMock }));
      mockRankingsEntity.patch.mockReturnValue({ set: rankingPatchSetMock });

      mockTransactionGo.mockResolvedValue({ canceled: false });

      await submissionDao.updateScoreWithRanking({
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
        submissionId: TEST_SUBMISSION_ID_1,
        rankingScore: 16000,
      });

      expect(submissionPatchSetMock).toHaveBeenCalledWith({ rankingScore: 16000 });
      // The Ranking must reflect the racer's true best across ALL their submissions —
      // "other-submission-id" at 13000, NOT the just-edited TEST_SUBMISSION_ID_1 at 16000.
      expect(rankingPatchSetMock).toHaveBeenCalledWith({
        rankingScore: 13000,
        submissionId: otherSubmissionId,
        submissionNumber: 1,
      });

      // The concurrency guard must be conditioned on the Ranking's PREVIOUS score (12000, what
      // was actually read), not the new trueBest score (13000) or the edited submission's score
      // (16000) — otherwise a concurrent write between the read and this write would go undetected.
      const whereCallback = rankingPatchWhereMock.mock.calls[0][0];
      const eqMock = vi.fn();
      whereCallback({ rankingScore: 'rankingScore' }, { eq: eqMock });
      expect(eqMock).toHaveBeenCalledWith('rankingScore', 12000);
    });

    it('should keep the ranking pointed at the same submission when it is downgraded but remains the true best', async () => {
      // TEST_SUBMISSION_ID_1 is current-best at 12000, edited to a worse 14000. No other
      // submission beats 14000, so it must remain the Ranking's submission — just with the new,
      // worse score. This distinguishes the "still best after downgrade" case from the
      // "re-promote a different submission" regression test above.
      const otherSubmissionId = 'other-submission-id';
      mockRankingGet({ submissionId: TEST_SUBMISSION_ID_1, rankingScore: 12000 });
      mockProfileSubmissions([
        { submissionId: TEST_SUBMISSION_ID_1, submissionNumber: 2, rankingScore: 12000 },
        { submissionId: otherSubmissionId, submissionNumber: 1, rankingScore: 20000 },
      ]);

      const submissionPatchSetMock = vi.fn(() => ({ commit: vi.fn(() => 'submission-commit') }));
      mockSubmissionsEntity.patch.mockReturnValue({ set: submissionPatchSetMock });

      type WhereCallback = (attr: { rankingScore: string }, ops: { eq: (...args: unknown[]) => unknown }) => unknown;
      const rankingPatchWhereMock = vi.fn<(callback: WhereCallback) => { commit: () => string }>(() => ({
        commit: vi.fn(() => 'ranking-commit'),
      }));
      const rankingPatchSetMock = vi.fn(() => ({ where: rankingPatchWhereMock }));
      mockRankingsEntity.patch.mockReturnValue({ set: rankingPatchSetMock });

      mockTransactionGo.mockResolvedValue({ canceled: false });

      await submissionDao.updateScoreWithRanking({
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
        submissionId: TEST_SUBMISSION_ID_1,
        rankingScore: 14000,
      });

      expect(rankingPatchSetMock).toHaveBeenCalledWith({
        rankingScore: 14000,
        submissionId: TEST_SUBMISSION_ID_1,
        submissionNumber: 2,
      });

      const whereCallback = rankingPatchWhereMock.mock.calls[0][0];
      const eqMock = vi.fn();
      whereCallback({ rankingScore: 'rankingScore' }, { eq: eqMock });
      expect(eqMock).toHaveBeenCalledWith('rankingScore', 12000);
    });

    it('should exclude sibling submissions that have not been scored yet when determining the true best', async () => {
      // A racer can have a QUEUED/unscored submission alongside their SUBMITTED one — it must
      // never be treated as a ranking candidate (no rankingScore to compare), even though it
      // would otherwise win a naive `undefined < number` comparison in some JS engines.
      const unscoredSubmissionId = 'unscored-submission-id';
      mockRankingGet({ submissionId: TEST_SUBMISSION_ID_1, rankingScore: 12000 });
      mockProfileSubmissions([
        { submissionId: TEST_SUBMISSION_ID_1, submissionNumber: 2, rankingScore: 12000 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { submissionId: unscoredSubmissionId, submissionNumber: 3, rankingScore: undefined as any },
      ]);

      const submissionPatchSetMock = vi.fn(() => ({ commit: vi.fn(() => 'submission-commit') }));
      mockSubmissionsEntity.patch.mockReturnValue({ set: submissionPatchSetMock });

      const rankingPatchWhereMock = vi.fn(() => ({ commit: vi.fn(() => 'ranking-commit') }));
      const rankingPatchSetMock = vi.fn(() => ({ where: rankingPatchWhereMock }));
      mockRankingsEntity.patch.mockReturnValue({ set: rankingPatchSetMock });

      mockTransactionGo.mockResolvedValue({ canceled: false });

      await submissionDao.updateScoreWithRanking({
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
        submissionId: TEST_SUBMISSION_ID_1,
        rankingScore: 14000,
      });

      // The unscored submission must never be selected as trueBest — TEST_SUBMISSION_ID_1 (the
      // only scored candidate) remains best even after its downgrade.
      expect(rankingPatchSetMock).toHaveBeenCalledWith({
        rankingScore: 14000,
        submissionId: TEST_SUBMISSION_ID_1,
        submissionNumber: 2,
      });
    });

    it('should select the true best across 3+ sibling submissions, not just the edited one and the previous best', async () => {
      const submissionA = 'submission-a';
      const submissionB = 'submission-b';
      // The Ranking points at submissionA (10000). TEST_SUBMISSION_ID_1 is edited to 9500 — a
      // new best — but submissionB (9000) is better still and must win, proving the reduce scans
      // every candidate rather than just comparing the edited submission against the old Ranking.
      mockRankingGet({ submissionId: submissionA, rankingScore: 10000 });
      mockProfileSubmissions([
        { submissionId: submissionA, submissionNumber: 1, rankingScore: 10000 },
        { submissionId: TEST_SUBMISSION_ID_1, submissionNumber: 2, rankingScore: 10500 },
        { submissionId: submissionB, submissionNumber: 3, rankingScore: 9000 },
      ]);

      const submissionPatchSetMock = vi.fn(() => ({ commit: vi.fn(() => 'submission-commit') }));
      mockSubmissionsEntity.patch.mockReturnValue({ set: submissionPatchSetMock });

      const rankingPatchWhereMock = vi.fn(() => ({ commit: vi.fn(() => 'ranking-commit') }));
      const rankingPatchSetMock = vi.fn(() => ({ where: rankingPatchWhereMock }));
      mockRankingsEntity.patch.mockReturnValue({ set: rankingPatchSetMock });

      mockTransactionGo.mockResolvedValue({ canceled: false });

      await submissionDao.updateScoreWithRanking({
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
        submissionId: TEST_SUBMISSION_ID_1,
        rankingScore: 9500,
      });

      expect(rankingPatchSetMock).toHaveBeenCalledWith({
        rankingScore: 9000,
        submissionId: submissionB,
        submissionNumber: 3,
      });
    });

    it('should keep the ranking on the current-best submission on an exact score tie with another submission', async () => {
      // TEST_SUBMISSION_ID_1 is current-best at 10000. Another submission also sits at 10000.
      // On an exact tie, the reduce's `<` comparison never displaces the first-seen candidate, so
      // the Ranking should stay pointed at TEST_SUBMISSION_ID_1 (deterministic tie-break: the
      // submission already reflected on the leaderboard is preferred over a later-listed tie).
      const otherSubmissionId = 'other-submission-id';
      mockRankingGet({ submissionId: TEST_SUBMISSION_ID_1, rankingScore: 12000 });
      mockProfileSubmissions([
        { submissionId: TEST_SUBMISSION_ID_1, submissionNumber: 2, rankingScore: 12000 },
        { submissionId: otherSubmissionId, submissionNumber: 3, rankingScore: 10000 },
      ]);

      const submissionPatchSetMock = vi.fn(() => ({ commit: vi.fn(() => 'submission-commit') }));
      mockSubmissionsEntity.patch.mockReturnValue({ set: submissionPatchSetMock });

      const rankingPatchWhereMock = vi.fn(() => ({ commit: vi.fn(() => 'ranking-commit') }));
      const rankingPatchSetMock = vi.fn(() => ({ where: rankingPatchWhereMock }));
      mockRankingsEntity.patch.mockReturnValue({ set: rankingPatchSetMock });

      mockTransactionGo.mockResolvedValue({ canceled: false });

      await submissionDao.updateScoreWithRanking({
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
        submissionId: TEST_SUBMISSION_ID_1,
        rankingScore: 10000,
      });

      expect(rankingPatchSetMock).toHaveBeenCalledWith({
        rankingScore: 10000,
        submissionId: TEST_SUBMISSION_ID_1,
        submissionNumber: 2,
      });
    });

    it('should update the ranking score AND identifying fields when promoting a different submission to best', async () => {
      const otherSubmissionId = 'other-submission-id';
      mockRankingGet({ submissionId: otherSubmissionId, rankingScore: 15000 });
      mockProfileSubmissions([
        { submissionId: otherSubmissionId, submissionNumber: 2, rankingScore: 15000 },
        { submissionId: TEST_SUBMISSION_ID_1, submissionNumber: 3, rankingScore: 15000 },
      ]);

      const submissionPatchSetMock = vi.fn(() => ({ commit: vi.fn(() => 'submission-commit') }));
      mockSubmissionsEntity.patch.mockReturnValue({ set: submissionPatchSetMock });

      type WhereCallback = (attr: { rankingScore: string }, ops: { eq: (...args: unknown[]) => unknown }) => unknown;
      const rankingPatchWhereMock = vi.fn<(callback: WhereCallback) => { commit: () => string }>(() => ({
        commit: vi.fn(() => 'ranking-commit'),
      }));
      const rankingPatchSetMock = vi.fn(() => ({ where: rankingPatchWhereMock }));
      mockRankingsEntity.patch.mockReturnValue({ set: rankingPatchSetMock });

      mockTransactionGo.mockResolvedValue({ canceled: false });

      await submissionDao.updateScoreWithRanking({
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
        submissionId: TEST_SUBMISSION_ID_1,
        rankingScore: 11000,
      });

      expect(mockSubmissionsEntity.query.byProfileId).toHaveBeenCalledWith({
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
      });
      expect(mockRankingsEntity.patch).toHaveBeenCalledWith({
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
      });
      // Promoting a DIFFERENT submission — the Ranking's identifying fields must be updated too,
      // not just rankingScore, so the record doesn't end up with a mismatched submissionId/Number.
      expect(rankingPatchSetMock).toHaveBeenCalledWith({
        rankingScore: 11000,
        submissionId: TEST_SUBMISSION_ID_1,
        submissionNumber: 3,
      });

      const whereCallback = rankingPatchWhereMock.mock.calls[0][0];
      const eqMock = vi.fn();
      whereCallback({ rankingScore: 'rankingScore' }, { eq: eqMock });
      expect(eqMock).toHaveBeenCalledWith('rankingScore', 15000);
    });

    it('should NOT update the ranking when a different, non-best submission is edited to a worse-than-best score', async () => {
      const otherSubmissionId = 'other-submission-id';
      mockRankingGet({ submissionId: otherSubmissionId, rankingScore: 9000 });
      mockProfileSubmissions([
        { submissionId: otherSubmissionId, submissionNumber: 2, rankingScore: 9000 },
        { submissionId: TEST_SUBMISSION_ID_1, submissionNumber: 3, rankingScore: 15000 },
      ]);

      const submissionPatchSetMock = vi.fn(() => ({ commit: vi.fn(() => 'submission-commit') }));
      mockSubmissionsEntity.patch.mockReturnValue({ set: submissionPatchSetMock });

      mockTransactionGo.mockResolvedValue({ canceled: false });

      await submissionDao.updateScoreWithRanking({
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
        submissionId: TEST_SUBMISSION_ID_1,
        rankingScore: 15000,
      });

      expect(submissionPatchSetMock).toHaveBeenCalledWith({ rankingScore: 15000 });
      expect(mockRankingsEntity.patch).not.toHaveBeenCalled();
    });

    it('should not attempt to patch a Ranking when no Ranking exists yet for this racer/leaderboard', async () => {
      // A Ranking is only ever created at SUBMITTED time (runLifecycleFunction) — this cascade
      // must never try to .patch() one into existence, since patching a nonexistent item fails.
      mockRankingGet(null);
      mockProfileSubmissions([{ submissionId: TEST_SUBMISSION_ID_1, submissionNumber: 1, rankingScore: 11000 }]);

      const submissionPatchSetMock = vi.fn(() => ({ commit: vi.fn(() => 'submission-commit') }));
      mockSubmissionsEntity.patch.mockReturnValue({ set: submissionPatchSetMock });

      mockTransactionGo.mockResolvedValue({ canceled: false });

      await submissionDao.updateScoreWithRanking({
        leaderboardId: TEST_LEADERBOARD_ID,
        profileId: TEST_PROFILE_ID_1,
        submissionId: TEST_SUBMISSION_ID_1,
        rankingScore: 11000,
      });

      expect(mockRankingsEntity.patch).not.toHaveBeenCalled();
    });

    it('should throw ConflictError when the transaction is canceled', async () => {
      mockRankingGet({ submissionId: TEST_SUBMISSION_ID_1, rankingScore: 15000 });
      mockProfileSubmissions([{ submissionId: TEST_SUBMISSION_ID_1, submissionNumber: 2, rankingScore: 15000 }]);
      mockSubmissionsEntity.patch.mockReturnValue({ set: vi.fn(() => ({ commit: vi.fn() })) });
      mockRankingsEntity.patch.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(() => ({ commit: vi.fn() })) })) });

      mockTransactionGo.mockResolvedValue({ canceled: true });

      await expect(
        submissionDao.updateScoreWithRanking({
          leaderboardId: TEST_LEADERBOARD_ID,
          profileId: TEST_PROFILE_ID_1,
          submissionId: TEST_SUBMISSION_ID_1,
          rankingScore: 11000,
        }),
      ).rejects.toThrow('Ranking changed concurrently. Please retry.');
    });
  });
});
