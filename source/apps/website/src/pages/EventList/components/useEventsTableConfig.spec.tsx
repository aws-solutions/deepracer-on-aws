// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EventStatus, EventType, RaceFormat } from '@deepracer-indy/typescript-client';
import { assert, describe, expect, it } from 'vitest';

import { act, renderHook } from '#utils/testUtils';

import { useEventsTableConfig } from './useEventsTableConfig';

const mockEvents = [
  {
    eventId: 'evt-001',
    name: 're:Invent 2025',
    eventType: EventType.AWS_SUMMIT,
    eventDate: '2025-12-01',
    countryCode: 'US',
    raceFormat: RaceFormat.BEST_LAP,
    maxLaps: 5,
    maxTimeInMinutes: 3,
    maxResets: 3,
    eventStatus: EventStatus.DRAFT,
    createdBy: 'TestAdmin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    eventId: 'evt-002',
    name: 'Summit Berlin',
    eventType: EventType.AWS_SUMMIT,
    eventDate: '2025-06-15',
    countryCode: 'DE',
    raceFormat: RaceFormat.AVERAGE_LAPS,
    maxLaps: 8,
    maxTimeInMinutes: 5,
    maxResets: 5,
    eventStatus: EventStatus.IN_PROGRESS,
    sponsor: 'AWS',
    createdBy: 'TestAdmin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('useEventsTableConfig()', () => {
  it('returns the correct number of column definitions', () => {
    const { result } = renderHook(() => useEventsTableConfig(mockEvents));
    expect(result.current.columnDefinitions).toHaveLength(11);
  });

  it('renders sponsor cell with value when present', () => {
    const { result } = renderHook(() => useEventsTableConfig(mockEvents));
    const sponsorCol = result.current.columnDefinitions.find((col) => col.id === 'Sponsor');
    assert(sponsorCol !== undefined, 'Sponsor column should be defined');
    expect(sponsorCol.cell(mockEvents[1] as never)).toBe('AWS');
  });

  it('renders sponsor cell with em dash when sponsor is absent', () => {
    const { result } = renderHook(() => useEventsTableConfig(mockEvents));
    const sponsorCol = result.current.columnDefinitions.find((col) => col.id === 'Sponsor');
    assert(sponsorCol !== undefined, 'Sponsor column should be defined');
    expect(sponsorCol.cell(mockEvents[0] as never)).toBe('—');
  });

  it('returns items matching the provided events list', () => {
    const { result } = renderHook(() => useEventsTableConfig(mockEvents));
    expect(result.current.items).toHaveLength(mockEvents.length);
  });

  it('returns preferencesProps with the column definitions', () => {
    const { result } = renderHook(() => useEventsTableConfig(mockEvents));
    expect(result.current.preferencesProps.columnDefinitions).toHaveLength(11);
  });

  describe('filteringFunction', () => {
    const filterBy = (result: { current: ReturnType<typeof useEventsTableConfig> }, filteringText: string) => {
      act(() => {
        result.current.filterProps.onChange({ detail: { filteringText } } as never);
      });
    };

    it('matches on event name', () => {
      const { result } = renderHook(() => useEventsTableConfig(mockEvents));
      filterBy(result, 're:Invent');
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].eventId).toBe('evt-001');
    });

    it('matches on translated event status', () => {
      const { result } = renderHook(() => useEventsTableConfig(mockEvents));
      filterBy(result, 'in progress');
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].eventId).toBe('evt-002');
    });

    it('matches on translated event type', () => {
      const { result } = renderHook(() => useEventsTableConfig(mockEvents));
      filterBy(result, 'summit');
      expect(result.current.items).toHaveLength(2);
    });

    it('matches on event date', () => {
      const { result } = renderHook(() => useEventsTableConfig(mockEvents));
      filterBy(result, '2025-06-15');
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].eventId).toBe('evt-002');
    });

    it('matches on country code', () => {
      const { result } = renderHook(() => useEventsTableConfig(mockEvents));
      filterBy(result, 'de');
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].eventId).toBe('evt-002');
    });

    it('matches on translated race format', () => {
      const { result } = renderHook(() => useEventsTableConfig(mockEvents));
      filterBy(result, 'average');
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].eventId).toBe('evt-002');
    });

    it('matches on sponsor when present', () => {
      const eventsWithDistinctSponsor = [mockEvents[0], { ...mockEvents[1], sponsor: 'Contoso' }];
      const { result } = renderHook(() => useEventsTableConfig(eventsWithDistinctSponsor));
      filterBy(result, 'contoso');
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].eventId).toBe('evt-002');
    });

    it('does not throw when sponsor is absent', () => {
      const { result } = renderHook(() => useEventsTableConfig([mockEvents[0]]));
      expect(() => filterBy(result, 'aws')).not.toThrow();
    });

    it('is case-insensitive', () => {
      const { result } = renderHook(() => useEventsTableConfig(mockEvents));
      filterBy(result, 'BERLIN');
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].eventId).toBe('evt-002');
    });

    it('returns no items when no field matches', () => {
      const { result } = renderHook(() => useEventsTableConfig(mockEvents));
      filterBy(result, 'nonexistent-filter-text');
      expect(result.current.items).toHaveLength(0);
    });

    it('returns all items when filtering text is empty', () => {
      const { result } = renderHook(() => useEventsTableConfig(mockEvents));
      filterBy(result, '');
      expect(result.current.items).toHaveLength(mockEvents.length);
    });
  });
});
