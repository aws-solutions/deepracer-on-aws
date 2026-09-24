// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CombinedScoringStrategy, Event, EventStatus, EventType, RaceFormat } from '@deepracer-indy/typescript-client';
import { describe, expect, it } from 'vitest';

import { CreateEventFormValues } from '../../../validation';
import { buildEventDefinition } from '../buildEventDefinition.js';

const baseFormValues: CreateEventFormValues = {
  name: 'Summit Race',
  eventType: EventType.AWS_SUMMIT,
  eventDate: '2026-06-01',
  countryCode: 'US',
  sponsor: 'Acme',
  raceFormat: RaceFormat.BEST_LAP,
  combinedScoringStrategy: '',
  combinedLeaderBoardHeader: '',
  combinedLeaderBoardFooter: '',
  maxLaps: 5,
  maxTimeInMinutes: '3',
  maxRunsPerRacer: '3',
  maxResets: '9999',
  averageLapsWindow: '3',
  trackType: '',
};

const existingEvent: Event = {
  eventId: 'evt-001',
  name: 'Existing',
  eventType: EventType.AWS_SUMMIT,
  eventDate: '2025-12-01',
  countryCode: 'GB',
  raceFormat: RaceFormat.AVERAGE_LAPS,
  maxLaps: 7,
  maxTimeInMinutes: 8,
  maxResets: 4,
  maxRunsPerRacer: 6,
  averageLapsWindow: 5,
  eventStatus: EventStatus.OPEN,
  createdBy: 'TestAdmin',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('buildEventDefinition', () => {
  describe('create mode (no existing event)', () => {
    it('maps every field straight from the form', () => {
      expect(buildEventDefinition(baseFormValues)).toEqual({
        name: 'Summit Race',
        eventType: EventType.AWS_SUMMIT,
        eventDate: '2026-06-01',
        countryCode: 'US',
        sponsor: 'Acme',
        raceFormat: RaceFormat.BEST_LAP,
        combinedScoringStrategy: undefined,
        maxLaps: 5,
        maxTimeInMinutes: 3,
        maxRunsPerRacer: 3,
        maxResets: 9999,
        // Best lap format → averageLapsWindow is inert.
        averageLapsWindow: undefined,
      });
    });

    it('maps an empty maxRunsPerRacer ("Unlimited") to undefined', () => {
      expect(buildEventDefinition({ ...baseFormValues, maxRunsPerRacer: '' }).maxRunsPerRacer).toBeUndefined();
    });

    it('sends averageLapsWindow only when raceFormat is AVERAGE_LAPS', () => {
      expect(
        buildEventDefinition({ ...baseFormValues, raceFormat: RaceFormat.AVERAGE_LAPS, averageLapsWindow: '5' })
          .averageLapsWindow,
      ).toBe(5);
    });

    it('passes the combined scoring strategy through when selected', () => {
      expect(
        buildEventDefinition({
          ...baseFormValues,
          combinedScoringStrategy: CombinedScoringStrategy.BEST_RESULT_PER_RACER,
        }).combinedScoringStrategy,
      ).toBe(CombinedScoringStrategy.BEST_RESULT_PER_RACER);
    });
  });

  describe('edit mode with locked config', () => {
    it('falls back to the existing event for locked numeric fields', () => {
      const result = buildEventDefinition(
        { ...baseFormValues, maxTimeInMinutes: '1', maxResets: '1', maxRunsPerRacer: '1', averageLapsWindow: '7' },
        { existingEvent, isConfigLocked: true },
      );

      expect(result.maxTimeInMinutes).toBe(existingEvent.maxTimeInMinutes);
      expect(result.maxResets).toBe(existingEvent.maxResets);
      expect(result.maxRunsPerRacer).toBe(existingEvent.maxRunsPerRacer);
      expect(result.averageLapsWindow).toBe(existingEvent.averageLapsWindow);
    });

    it('keeps the sponsor editable by using the submitted value even when config is locked', () => {
      const result = buildEventDefinition(
        { ...baseFormValues, sponsor: 'New Sponsor' },
        { existingEvent, isConfigLocked: true },
      );

      expect(result.sponsor).toBe('New Sponsor');
    });

    it('clears the sponsor when submitted empty', () => {
      const result = buildEventDefinition({ ...baseFormValues, sponsor: '' }, { existingEvent, isConfigLocked: true });

      expect(result.sponsor).toBeUndefined();
    });
  });
});
