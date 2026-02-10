// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { TRACKS } from '#constants/tracks';

import { SortByValue } from '../constants';
import { getTrackTiles } from '../utils';

// Mock the tracks constant
vi.mock('#constants/tracks', () => ({
  TRACKS: [
    {
      trackId: 'track1',
      name: 'Short Easy Track',
      description: 'A short and easy track',
      length: 10,
      difficulty: 1,
    },
    {
      trackId: 'track2',
      name: 'Medium Track',
      description: 'A medium difficulty track',
      length: 20,
      difficulty: 5,
    },
    {
      trackId: 'track3',
      name: 'Long Hard Track',
      description: 'A long and difficult track',
      length: 30,
      difficulty: 10,
    },
  ],
}));

describe('getTrackTiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sorting functionality', () => {
    it('sorts tracks by length shortest to longest', () => {
      const result = getTrackTiles(SortByValue.LENGTH_SHORTEST, '');

      expect(result).toHaveLength(3);
      expect(result[0].value).toBe('track1');
      expect(result[1].value).toBe('track2');
      expect(result[2].value).toBe('track3');
    });

    it('sorts tracks by length longest to shortest', () => {
      const result = getTrackTiles(SortByValue.LENGTH_LONGEST, '');

      expect(result).toHaveLength(3);
      expect(result[0].value).toBe('track3');
      expect(result[1].value).toBe('track2');
      expect(result[2].value).toBe('track1');
    });

    it('sorts tracks by difficulty most to least', () => {
      const result = getTrackTiles(SortByValue.DIFFICULTY_MOST, '');

      expect(result).toHaveLength(3);
      expect(result[0].value).toBe('track1');
      expect(result[1].value).toBe('track2');
      expect(result[2].value).toBe('track3');
    });

    it('sorts tracks by difficulty least to most', () => {
      const result = getTrackTiles(SortByValue.DIFFICULTY_LEAST, '');

      expect(result).toHaveLength(3);
      expect(result[0].value).toBe('track3');
      expect(result[1].value).toBe('track2');
      expect(result[2].value).toBe('track1');
    });

    it('uses LENGTH_SHORTEST as default sort', () => {
      const result = getTrackTiles('invalid' as SortByValue, '');

      expect(result).toHaveLength(3);
      expect(result[0].value).toBe('track1');
      expect(result[1].value).toBe('track2');
      expect(result[2].value).toBe('track3');
    });
  });

  describe('filtering functionality', () => {
    it('filters tracks by name (case insensitive)', () => {
      const result = getTrackTiles(SortByValue.LENGTH_SHORTEST, 'short');

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('track1');
      expect(result[0].label).toBe('Short Easy Track');
    });

    it('filters tracks with partial match', () => {
      const result = getTrackTiles(SortByValue.LENGTH_SHORTEST, 'track');

      expect(result).toHaveLength(3);
    });

    it('returns empty array when no tracks match filter', () => {
      const result = getTrackTiles(SortByValue.LENGTH_SHORTEST, 'nonexistent');

      expect(result).toHaveLength(0);
    });

    it('handles empty filter string', () => {
      const result = getTrackTiles(SortByValue.LENGTH_SHORTEST, '');

      expect(result).toHaveLength(3);
    });
  });

  describe('output format', () => {
    it('returns correctly formatted track tiles', () => {
      const result = getTrackTiles(SortByValue.LENGTH_SHORTEST, '');

      expect(result[0]).toHaveProperty('label');
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('image');
      expect(result[0]).toHaveProperty('value');
    });

    it('includes track name as label', () => {
      const result = getTrackTiles(SortByValue.LENGTH_SHORTEST, '');

      expect(result[0].label).toBe('Short Easy Track');
    });

    it('includes track description', () => {
      const result = getTrackTiles(SortByValue.LENGTH_SHORTEST, '');

      expect(result[0].description).toBe('A short and easy track');
    });

    it('includes track ID as value', () => {
      const result = getTrackTiles(SortByValue.LENGTH_SHORTEST, '');

      expect(result[0].value).toBe('track1');
    });
  });

  describe('immutability', () => {
    it('does not mutate the original TRACKS array', () => {
      const originalOrder = [...TRACKS];

      getTrackTiles(SortByValue.LENGTH_LONGEST, '');

      expect(TRACKS).toEqual(originalOrder);
    });

    it('does not mutate TRACKS when sorting by difficulty', () => {
      const originalOrder = [...TRACKS];

      getTrackTiles(SortByValue.DIFFICULTY_MOST, '');

      expect(TRACKS).toEqual(originalOrder);
    });
  });

  describe('combined sorting and filtering', () => {
    it('applies both sorting and filtering correctly', () => {
      const result = getTrackTiles(SortByValue.LENGTH_LONGEST, 'track');

      expect(result).toHaveLength(3);
      expect(result[0].value).toBe('track3');
      expect(result[2].value).toBe('track1');
    });
  });
});
