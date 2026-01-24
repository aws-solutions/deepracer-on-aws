// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Track, TRACKS } from '#constants/tracks';

import { SortByValue } from './constants';

export const getTrackTiles = (sortBy: SortByValue, filteringText: string) => {
  let sortedTracks: Track[];

  switch (sortBy) {
    case SortByValue.LENGTH_LONGEST:
      sortedTracks = TRACKS.sort((a, b) => b.length - a.length);
      break;
    case SortByValue.DIFFICULTY_MOST:
      sortedTracks = TRACKS.sort((a, b) => a.difficulty - b.difficulty);
      break;
    case SortByValue.DIFFICULTY_LEAST:
      sortedTracks = TRACKS.sort((a, b) => b.difficulty - a.difficulty);
      break;
    case SortByValue.LENGTH_SHORTEST:
    default:
      sortedTracks = TRACKS.sort((a, b) => a.length - b.length);
      break;
  }

  return sortedTracks
    .filter((t) => t.name.toLowerCase().includes(filteringText))
    .map((track) => {
      return {
        label: track.name,
        description: track.description,
        image: (
          <img
            src={new URL(`../../../../assets/images/tracks/${track.trackId}.png`, import.meta.url).href}
            alt={track.name}
          />
        ),
        value: track.trackId,
      };
    });
};
