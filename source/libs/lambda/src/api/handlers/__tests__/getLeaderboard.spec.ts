// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { leaderboardDao, TEST_ITEM_NOT_FOUND_ERROR, TEST_LEADERBOARD_ITEM } from '@deepracer-indy/database';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetLeaderboardOperation } from '../getLeaderboard.js';

describe('GetLeaderboard operation', () => {
  it('should return successful leaderboard response', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LEADERBOARD_ITEM);

    const output = await GetLeaderboardOperation(
      { leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.leaderboard).toBeDefined();
    expect(output.leaderboard.leaderboardId).toEqual(TEST_LEADERBOARD_ITEM.leaderboardId);
    expect(output.leaderboard.name).toEqual(TEST_LEADERBOARD_ITEM.name);
    expect(output.leaderboard.maxSubmissionsPerUser).toEqual(TEST_LEADERBOARD_ITEM.maxSubmissionsPerUser);
    expect(output.leaderboard.closeTime.toISOString()).toEqual(TEST_LEADERBOARD_ITEM.closeTime);
    expect(output.leaderboard.openTime).toEqual(new Date(TEST_LEADERBOARD_ITEM.openTime));
    expect(output.leaderboard.participantCount).toEqual(TEST_LEADERBOARD_ITEM.participantCount);
    expect(output.leaderboard.objectAvoidanceConfig).toEqual(TEST_LEADERBOARD_ITEM.objectAvoidanceConfig);
    expect(output.leaderboard.raceType).toEqual(TEST_LEADERBOARD_ITEM.raceType);
    expect(output.leaderboard.resettingBehaviorConfig).toEqual(TEST_LEADERBOARD_ITEM.resettingBehaviorConfig);
    expect(output.leaderboard.submissionTerminationConditions).toEqual({
      maximumLaps: TEST_LEADERBOARD_ITEM.submissionTerminationConditions.maxLaps,
      minimumLaps: TEST_LEADERBOARD_ITEM.minimumLaps,
      maxTimeInMinutes: TEST_LEADERBOARD_ITEM.submissionTerminationConditions.maxTimeInMinutes,
    });
    expect(output.leaderboard.timingMethod).toEqual(TEST_LEADERBOARD_ITEM.timingMethod);
    expect(output.leaderboard.trackConfig).toEqual(TEST_LEADERBOARD_ITEM.trackConfig);
  });

  it('should fail if leaderboard item does not exist', async () => {
    vi.spyOn(leaderboardDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    return expect(
      GetLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });
});
