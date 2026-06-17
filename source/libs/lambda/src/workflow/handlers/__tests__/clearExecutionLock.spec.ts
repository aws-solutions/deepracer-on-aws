// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { leaderboardDao, TEST_LEADERBOARD_ID } from '@deepracer-indy/database';

import type { LiveRaceContext } from '../../types/liveRaceContext.js';
import { clearExecutionLock } from '../clearExecutionLock.js';

const baseContext: LiveRaceContext = {
  leaderboardId: TEST_LEADERBOARD_ID,
  modelsProcessed: 5,
};

describe('clearExecutionLock', () => {
  it('should clear execution lock', async () => {
    const spy = vi.spyOn(leaderboardDao, 'clearExecutionLock').mockResolvedValue(undefined);

    const result = await clearExecutionLock.handler(baseContext);

    expect(spy).toHaveBeenCalledWith(baseContext.leaderboardId);
    expect(result.leaderboardId).toBe(baseContext.leaderboardId);
  });

  it('should propagate errors', async () => {
    vi.spyOn(leaderboardDao, 'clearExecutionLock').mockRejectedValue(new Error('DynamoDB error'));

    await expect(clearExecutionLock.handler(baseContext)).rejects.toThrow('DynamoDB error');
  });
});
