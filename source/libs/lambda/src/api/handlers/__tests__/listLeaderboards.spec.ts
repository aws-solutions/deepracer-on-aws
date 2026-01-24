// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { leaderboardDao, TEST_LEADERBOARD_ITEMS } from '@deepracer-indy/database';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListLeaderboardsOperation } from '../listLeaderboards.js';

describe('listLeaderboards Operation', () => {
  it('should return a list of leaderboards on success', async () => {
    expect.assertions(6);
    vi.spyOn(leaderboardDao, 'list').mockResolvedValue({ data: TEST_LEADERBOARD_ITEMS, cursor: null });
    const output = await ListLeaderboardsOperation({}, TEST_OPERATION_CONTEXT);

    expect(output.leaderboards).toBeDefined();
    expect(output.leaderboards).toHaveLength(TEST_LEADERBOARD_ITEMS.length);
    expect(output.token).toBeUndefined();
    output.leaderboards.forEach((leaderboard, i) => {
      expect(leaderboard.leaderboardId).toEqual(TEST_LEADERBOARD_ITEMS[i].leaderboardId);
    });
  });

  it('should return a list of leaderboards on success with token', async () => {
    expect.assertions(6);
    vi.spyOn(leaderboardDao, 'list').mockResolvedValue({ data: TEST_LEADERBOARD_ITEMS, cursor: 'nextToken' });
    const output = await ListLeaderboardsOperation({}, TEST_OPERATION_CONTEXT);

    expect(output.leaderboards).toBeDefined();
    expect(output.leaderboards).toHaveLength(TEST_LEADERBOARD_ITEMS.length);
    expect(output.token).toBe('nextToken');
    output.leaderboards.forEach((leaderboard, i) => {
      expect(leaderboard.leaderboardId).toEqual(TEST_LEADERBOARD_ITEMS[i].leaderboardId);
    });
  });

  it('should return an empty array if there are no leaderboards', async () => {
    expect.assertions(3);
    vi.spyOn(leaderboardDao, 'list').mockResolvedValue({ data: [], cursor: null });
    const output = await ListLeaderboardsOperation({}, TEST_OPERATION_CONTEXT);

    expect(output.leaderboards).toBeDefined();
    expect(output.leaderboards).toHaveLength(0);
    expect(output.token).toBeUndefined();
  });
});
