// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { leaderboardDao, TEST_LEADERBOARD_ITEM, TEST_LEADERBOARD_ID } from '@deepracer-indy/database';
import { LiveEventStatus } from '@deepracer-indy/typescript-server-client';

import type { LiveRaceContext } from '../../types/liveRaceContext.js';
import { checkAutolaunch } from '../checkAutolaunch.js';

const baseContext: LiveRaceContext = {
  leaderboardId: TEST_LEADERBOARD_ID,
  modelsProcessed: 0,
};

describe('checkAutolaunch', () => {
  it('should continue loop when autolaunch is enabled', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      autoLaunchEnabled: true,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
    });

    const result = await checkAutolaunch.handler(baseContext);

    expect(result.continueLoop).toBe(true);
  });

  it('should stop loop when autolaunch is disabled', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      autoLaunchEnabled: false,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
    });

    const result = await checkAutolaunch.handler(baseContext);

    expect(result.continueLoop).toBe(false);
  });

  it('should stop loop when race is COMPLETED', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      autoLaunchEnabled: true,
      liveEventStatus: LiveEventStatus.COMPLETED,
    });

    const result = await checkAutolaunch.handler(baseContext);

    expect(result.continueLoop).toBe(false);
  });
});
