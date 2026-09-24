// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { DeepRacerApiQueryTagType, LIST_QUERY_TAG_ID } from '#services/deepRacer/constants';
import { editLeaderboardInvalidatesTags } from '#services/deepRacer/leaderboardsApi';

describe('editLeaderboardInvalidatesTags', () => {
  it('invalidates the event tracks query when editing an event-linked leaderboard', () => {
    expect(editLeaderboardInvalidatesTags('lb-001', { eventId: 'evt-001' })).toEqual([
      { type: DeepRacerApiQueryTagType.LEADERBOARDS, id: 'lb-001' },
      { type: DeepRacerApiQueryTagType.LEADERBOARDS, id: LIST_QUERY_TAG_ID },
      { type: DeepRacerApiQueryTagType.EVENTS, id: 'evt-001-tracks' },
    ]);
  });

  it('omits the event tracks tag when the edit response lacks an event ID', () => {
    expect(editLeaderboardInvalidatesTags('lb-001', undefined)).not.toContainEqual(
      expect.objectContaining({ type: DeepRacerApiQueryTagType.EVENTS }),
    );
  });

  it('preserves existing leaderboard-only invalidation for standalone leaderboards', () => {
    expect(editLeaderboardInvalidatesTags('lb-001')).toEqual([
      { type: DeepRacerApiQueryTagType.LEADERBOARDS, id: 'lb-001' },
      { type: DeepRacerApiQueryTagType.LEADERBOARDS, id: LIST_QUERY_TAG_ID },
    ]);
  });
});
