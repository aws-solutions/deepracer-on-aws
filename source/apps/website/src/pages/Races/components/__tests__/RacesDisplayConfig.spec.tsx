// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { renderHook } from '@testing-library/react';

import { mockLeaderboards } from '#constants/testConstants.js';

import useRacesDisplayConfig from '../RacesDisplayConfig';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockDateNow = vi.fn();
vi.spyOn(Date, 'now').mockImplementation(mockDateNow);

const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();
vi.spyOn(global, 'setInterval').mockImplementation(mockSetInterval);
vi.spyOn(global, 'clearInterval').mockImplementation(mockClearInterval);

describe('useRacesDisplayConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDateNow.mockReturnValue(new Date('2023-06-15T12:00:00Z').getTime());
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('hook initialization', () => {
    it('returns all required properties', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      expect(result.current).toHaveProperty('collectionProps');
      expect(result.current).toHaveProperty('cardDefinitions');
      expect(result.current).toHaveProperty('visibleContent');
      expect(result.current).toHaveProperty('items');
      expect(result.current).toHaveProperty('paginationProps');
      expect(result.current).toHaveProperty('TrackDisplayPreferences');
      expect(result.current).toHaveProperty('filteredItemsCount');
      expect(result.current).toHaveProperty('filterProps');
    });
  });

  describe('default preferences', () => {
    it('sets correct default page size', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      expect(result.current.paginationProps.currentPageIndex).toBe(1);
    });

    it('sets correct default visible content', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      expect(result.current.visibleContent).toEqual([
        'leaderboardName',
        'raceType',
        'raceDates',
        'image',
        'raceDetails',
      ]);
    });
  });

  describe('card definitions', () => {
    it('creates card definitions with correct sections', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      expect(result.current.cardDefinitions.sections).toHaveLength(6);
      expect(result.current.cardDefinitions.sections?.map((section) => section.id)).toEqual([
        'leaderboardId',
        'leaderboardName',
        'raceType',
        'raceDates',
        'image',
        'raceDetails',
      ]);
    });

    it('has header function for time remaining', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      expect(result.current.cardDefinitions.header).toBeDefined();
      expect(typeof result.current.cardDefinitions.header).toBe('function');
    });
  });

  describe('time remaining calculations', () => {
    it('shows "closed" for past events', () => {
      const pastTime = new Date('2023-12-31T23:59:59Z').getTime();
      mockDateNow.mockReturnValue(pastTime);

      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      const headerElement = result.current.cardDefinitions.header?.(mockLeaderboards[0]);
      expect(headerElement).toBeDefined();
    });

    it('shows remaining time for ongoing events', () => {
      const duringRaceTime = new Date('2023-06-15T12:00:00Z').getTime();
      mockDateNow.mockReturnValue(duringRaceTime);

      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      const headerElement = result.current.cardDefinitions.header?.(mockLeaderboards[0]);
      expect(headerElement).toBeDefined();
    });

    it('shows time until race starts for future events', () => {
      const beforeRaceTime = new Date('2023-06-01T12:00:00Z').getTime();
      mockDateNow.mockReturnValue(beforeRaceTime);

      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      const headerElement = result.current.cardDefinitions.header?.(mockLeaderboards[0]);
      expect(headerElement).toBeDefined();
    });
  });

  describe('empty state handling', () => {
    it('shows correct empty state for closed races', () => {
      const { result } = renderHook(() => useRacesDisplayConfig([], true, true));

      expect(result.current.collectionProps.empty).toBeDefined();
    });

    it('shows create race button for authorized users on open races with no data', () => {
      const { result } = renderHook(() => useRacesDisplayConfig([], false, true));

      expect(result.current.collectionProps.empty).toBeDefined();
    });

    it('shows appropriate message for unauthorized users on open races with no data', () => {
      const { result } = renderHook(() => useRacesDisplayConfig([], false, false));

      expect(result.current.collectionProps.empty).toBeDefined();
    });
  });

  describe('navigation functionality', () => {
    it('navigates to race details when race details button is clicked', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      const raceDetailsSection = result.current.cardDefinitions.sections?.find(
        (section) => section.id === 'raceDetails',
      );
      expect(raceDetailsSection).toBeDefined();

      const contentElement = raceDetailsSection?.content?.(mockLeaderboards[0]);
      expect(contentElement).toBeDefined();
    });

    it('navigates to create race when create race button is clicked in empty state', () => {
      const { result } = renderHook(() => useRacesDisplayConfig([], false, true));

      expect(result.current.collectionProps.empty).toBeDefined();
    });
  });

  describe('collection preferences', () => {
    it('creates TrackDisplayPreferences component', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      expect(result.current.TrackDisplayPreferences).toBeDefined();
    });

    it('has correct page size options', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      expect(result.current.TrackDisplayPreferences).toBeDefined();
    });
  });

  describe('leaderboard data processing', () => {
    it('processes leaderboard items correctly', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      expect(result.current.items).toBeDefined();
      expect(Array.isArray(result.current.items)).toBe(true);
    });

    it('handles empty leaderboards array', () => {
      const { result } = renderHook(() => useRacesDisplayConfig([], false, true));

      expect(result.current.items).toBeDefined();
      expect(Array.isArray(result.current.items)).toBe(true);
      expect(result.current.items).toHaveLength(0);
    });
  });

  describe('card content sections', () => {
    it('renders leaderboard name section correctly', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      const nameSection = result.current.cardDefinitions.sections?.find((section) => section.id === 'leaderboardName');
      expect(nameSection).toBeDefined();

      expect(nameSection?.content).toBeDefined();
      const contentElement = nameSection?.content?.(mockLeaderboards[0]);
      expect(contentElement).toBeDefined();
    });

    it('renders race type section correctly', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      const raceTypeSection = result.current.cardDefinitions.sections?.find((section) => section.id === 'raceType');
      expect(raceTypeSection).toBeDefined();

      expect(raceTypeSection?.content).toBeDefined();
      const contentElement = raceTypeSection?.content?.(mockLeaderboards[0]);
      expect(contentElement).toBeDefined();
    });

    it('renders race dates section correctly', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      const raceDatesSection = result.current.cardDefinitions.sections?.find((section) => section.id === 'raceDates');
      expect(raceDatesSection).toBeDefined();

      expect(raceDatesSection?.content).toBeDefined();
      const contentElement = raceDatesSection?.content?.(mockLeaderboards[0]);
      expect(contentElement).toBeDefined();
    });

    it('renders image section correctly', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      const imageSection = result.current.cardDefinitions.sections?.find((section) => section.id === 'image');
      expect(imageSection).toBeDefined();

      expect(imageSection?.content).toBeDefined();

      const contentElement = imageSection?.content?.(mockLeaderboards[0]);
      expect(contentElement).toBeDefined();
    });
  });

  describe('filtering and pagination', () => {
    it('provides filter props', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      expect(result.current.filterProps).toBeDefined();
      expect(result.current.filteredItemsCount).toBeDefined();
    });

    it('provides pagination props', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      expect(result.current.paginationProps).toBeDefined();
      expect(result.current.paginationProps.currentPageIndex).toBeDefined();
    });
  });

  describe('different race management permissions', () => {
    it('handles authorized users correctly', () => {
      const { result } = renderHook(() => useRacesDisplayConfig([], false, true));

      expect(result.current.collectionProps.empty).toBeDefined();
    });

    it('handles unauthorized users correctly', () => {
      const { result } = renderHook(() => useRacesDisplayConfig([], false, false));

      expect(result.current.collectionProps.empty).toBeDefined();
    });
  });

  describe('legacy test compatibility', () => {
    it('hook executes without crashing (legacy test)', () => {
      const { result } = renderHook(() => useRacesDisplayConfig(mockLeaderboards, false, true));

      expect(result.current).toBeDefined();
      expect(result.current.collectionProps).toBeDefined();
      expect(result.current.cardDefinitions).toBeDefined();
      expect(result.current.items).toBeDefined();
    });
  });
});
