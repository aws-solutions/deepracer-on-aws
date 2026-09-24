// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_LAP_ITEM, TEST_PROFILE_ID_1 } from '@deepracer-indy/database';

import { toLapResponse } from '../toLapResponse.js';

describe('toLapResponse', () => {
  it('should map a LapItem to the Smithy Lap response shape', () => {
    const response = toLapResponse(TEST_LAP_ITEM);

    expect(response).toEqual({
      runId: TEST_LAP_ITEM.runId,
      leaderboardId: TEST_LAP_ITEM.leaderboardId,
      lapNumber: TEST_LAP_ITEM.lapNumber,
      lapTimeMs: TEST_LAP_ITEM.lapTimeMs,
      isValid: TEST_LAP_ITEM.isValid,
      resets: TEST_LAP_ITEM.resets,
      originalLapTimeMs: undefined,
      editedBy: undefined,
      editedAt: undefined,
      editReason: undefined,
      createdAt: new Date(TEST_LAP_ITEM.createdAt),
      updatedAt: new Date(TEST_LAP_ITEM.updatedAt),
    });
  });

  it('should map edit audit fields when present', () => {
    const editedLap = {
      ...TEST_LAP_ITEM,
      originalLapTimeMs: 9999,
      editedBy: TEST_PROFILE_ID_1,
      editedAt: '2026-09-15T10:40:00.000Z',
      editReason: 'Timer misfire',
    };

    const response = toLapResponse(editedLap);

    expect(response.originalLapTimeMs).toEqual(9999);
    expect(response.editedBy).toEqual(TEST_PROFILE_ID_1);
    expect(response.editedAt).toEqual(new Date('2026-09-15T10:40:00.000Z'));
    expect(response.editReason).toEqual('Timer misfire');
  });
});
