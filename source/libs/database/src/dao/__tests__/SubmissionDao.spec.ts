// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  TEST_CURSOR,
  TEST_LEADERBOARD_ITEM,
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

const mockSubmissionsEntity = vi.hoisted(() => ({
  create: vi.fn(),
  query: {
    byProfileId: vi.fn(),
    sortedByCreatedAt: vi.fn(),
  },
  delete: vi.fn(),
}));

vi.mock('electrodb', async () => ({
  ...(await vi.importActual('electrodb')),
  Service: vi.fn(() => ({
    entities: {
      leaderboards: mockLeaderboardsEntity,
      submissions: mockSubmissionsEntity,
    },
    transaction: {
      write: vi.fn(() => ({
        go: vi.fn(),
      })),
    },
  })),
}));

vi.mock('#entities/LeaderboardsEntity.js', () => ({
  LeaderboardsEntity: mockLeaderboardsEntity,
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
      });

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
      });

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
});
