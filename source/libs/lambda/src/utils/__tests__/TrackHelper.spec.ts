// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TrackDirection, TrackId } from '@deepracer-indy/typescript-server-client';

import { trackHelper } from '../TrackHelper.js';

// Mocking tracks in case they change later on
vi.mock('#api/constants/tracks.js', () => ({
  TRACKS: [
    {
      trackId: TrackId.ACE_SPEEDWAY,
      enabledDirections: [TrackDirection.CLOCKWISE, TrackDirection.COUNTER_CLOCKWISE],
    },
    {
      trackId: TrackId.DBRO_RACEWAY,
      enabledDirections: [TrackDirection.COUNTER_CLOCKWISE],
    },
  ],
}));

describe('TrackHelper', () => {
  describe('hasSingleEnabledDirection', () => {
    it('should return false if track has multiple enabled directions', () => {
      expect(trackHelper.hasSingleEnabledDirection(TrackId.ACE_SPEEDWAY)).toBe(false);
    });

    it('should return true if track has a single enabled direction', () => {
      expect(trackHelper.hasSingleEnabledDirection(TrackId.DBRO_RACEWAY)).toBe(true);
    });
  });
});
