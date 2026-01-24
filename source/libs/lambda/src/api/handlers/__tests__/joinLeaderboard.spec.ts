// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { JoinLeaderboardOperation } from '../joinLeaderboard.js';

describe('JoinLeaderboard operation', () => {
  const TEST_LEADERBOARD_ID = '123abcABC_-4567';

  it("doesn't throw with valid input", async () => {
    expect.assertions(1);
    const output = await JoinLeaderboardOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, inviteCode: 'testInviteCode' },
      TEST_OPERATION_CONTEXT,
    );
    expect(output).toStrictEqual({});
  });
});
