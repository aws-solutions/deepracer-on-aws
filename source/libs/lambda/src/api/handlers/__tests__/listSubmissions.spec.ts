// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { submissionDao, TEST_LEADERBOARD_ITEM, TEST_SUBMISSION_ITEMS } from '@deepracer-indy/database';
import { InternalFailureError } from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListSubmissionsOperation } from '../listSubmissions.js';

describe('ListSubmissions operation', () => {
  beforeEach(() => {
    vi.spyOn(s3Helper, 'getPresignedUrl').mockImplementation((location) => Promise.resolve(location));
  });

  it('should return a list of submissions on success', async () => {
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValue({ data: TEST_SUBMISSION_ITEMS, cursor: null });

    const output = await ListSubmissionsOperation(
      { leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId },
      TEST_OPERATION_CONTEXT,
    );

    expect(submissionDao.listByCreatedAt).toHaveBeenCalledWith({
      profileId: TEST_OPERATION_CONTEXT.profileId,
      leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId,
      cursor: undefined,
    });
    expect(output.submissions).toHaveLength(TEST_SUBMISSION_ITEMS.length);
    expect(output.token).toBeUndefined();
    output.submissions.forEach((submission, i) => {
      expect(submission).toEqual({
        modelId: TEST_SUBMISSION_ITEMS[i].modelId,
        modelName: TEST_SUBMISSION_ITEMS[i].modelName,
        status: TEST_SUBMISSION_ITEMS[i].status,
        stats: TEST_SUBMISSION_ITEMS[i].stats,
        submissionNumber: TEST_SUBMISSION_ITEMS[i].submissionNumber,
        submittedAt: new Date(TEST_SUBMISSION_ITEMS[i].createdAt),
        rankingScore: TEST_SUBMISSION_ITEMS[i].rankingScore,
        videoUrl: TEST_SUBMISSION_ITEMS[i].assetS3Locations.primaryVideoS3Location,
      });
    });
  });

  it('should return a list of submissions on success with token', async () => {
    const mockToken = 'nextToken';
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValue({ data: TEST_SUBMISSION_ITEMS, cursor: mockToken });

    const output = await ListSubmissionsOperation(
      { leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId, token: mockToken },
      TEST_OPERATION_CONTEXT,
    );

    expect(submissionDao.listByCreatedAt).toHaveBeenCalledWith({
      profileId: TEST_OPERATION_CONTEXT.profileId,
      leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId,
      cursor: mockToken,
    });
    expect(output.submissions).toHaveLength(TEST_SUBMISSION_ITEMS.length);
    expect(output.token).toBe(mockToken);
    output.submissions.forEach((submission, i) => {
      expect(submission).toEqual({
        modelId: TEST_SUBMISSION_ITEMS[i].modelId,
        modelName: TEST_SUBMISSION_ITEMS[i].modelName,
        status: TEST_SUBMISSION_ITEMS[i].status,
        stats: TEST_SUBMISSION_ITEMS[i].stats,
        submissionNumber: TEST_SUBMISSION_ITEMS[i].submissionNumber,
        submittedAt: new Date(TEST_SUBMISSION_ITEMS[i].createdAt),
        rankingScore: TEST_SUBMISSION_ITEMS[i].rankingScore,
        videoUrl: TEST_SUBMISSION_ITEMS[i].assetS3Locations.primaryVideoS3Location,
      });
    });
  });

  it('should throw an error if list submissions fails', async () => {
    vi.spyOn(submissionDao, 'listByCreatedAt').mockRejectedValue(new InternalFailureError({ message: 'Failure.' }));

    return expect(
      ListSubmissionsOperation({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Failure.' }));
  });

  it('should return an empty array if dao returns no submissions', async () => {
    vi.spyOn(submissionDao, 'listByCreatedAt').mockResolvedValue({ data: [], cursor: null });

    const output = await ListSubmissionsOperation(
      { leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId },
      TEST_OPERATION_CONTEXT,
    );

    expect(submissionDao.listByCreatedAt).toHaveBeenCalledWith({
      profileId: TEST_OPERATION_CONTEXT.profileId,
      leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId,
      cursor: undefined,
    });
    expect(output.submissions).toHaveLength(0);
    expect(output.token).toBeUndefined();
  });
});
