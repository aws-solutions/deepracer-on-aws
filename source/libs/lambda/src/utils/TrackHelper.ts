// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TrackId } from '@deepracer-indy/typescript-server-client';

import { Track, TRACKS } from '../api/constants/tracks.js';

class TrackHelper {
  /**
   * Determines whether the given trackId corresponds to a track that
   * supports only a single track direction ("legacy track").
   *
   * Legacy tracks have slightly different handling for reward function
   * validation and during the creation of SimApp env variables in the workflow.
   *
   * For legacy tracks:
   * - `track_name` passed to RewardFunctionValidationLambda does not include
   * an appended track direction suffix
   * - `TRACK_DIRECTION_CLOCKWISE` env variable is not written to simulation YAML file
   *
   * @param trackId TrackId of the track
   * @returns a boolean indicating if the track supports only a single direction
   */
  hasSingleEnabledDirection = (trackId: TrackId) =>
    (TRACKS.find((track) => track.trackId === trackId) as Track).enabledDirections.length === 1;
}

export const trackHelper = new TrackHelper();
