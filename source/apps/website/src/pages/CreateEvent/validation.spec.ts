// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CombinedScoringStrategy, EventType, RaceFormat, TrackId } from '@deepracer-indy/typescript-client';
import { describe, expect, it } from 'vitest';

import { CREATE_EVENT_DEFAULTS, createEventValidationSchema, CreateEventFormValues } from './validation';

const validForm: CreateEventFormValues = {
  name: 'My Race',
  eventType: EventType.AWS_SUMMIT,
  eventDate: '2026-12-01',
  countryCode: 'US',
  sponsor: '',
  raceFormat: RaceFormat.BEST_LAP,
  combinedScoringStrategy: '',
  combinedLeaderBoardHeader: '',
  combinedLeaderBoardFooter: '',
  maxLaps: 5,
  maxTimeInMinutes: '3',
  maxRunsPerRacer: '',
  maxResets: '3',
  averageLapsWindow: '3',
  trackType: TrackId.AWS_SUMMIT_RACEWAY,
};

// Create-mode schema — trackType is required (see the dedicated describe block below for
// the edit-mode variant, where trackType is optional).
const createModeSchema = createEventValidationSchema(false);

describe('createEventValidationSchema (create mode)', () => {
  it('passes with all valid required fields', async () => {
    await expect(createModeSchema.validate(validForm)).resolves.toBeDefined();
  });

  it('fails when name is empty', async () => {
    await expect(createModeSchema.validate({ ...validForm, name: '' })).rejects.toThrow();
  });

  it('fails when name exceeds 128 characters', async () => {
    await expect(createModeSchema.validate({ ...validForm, name: 'a'.repeat(129) })).rejects.toThrow();
  });

  it('fails when eventType is empty', async () => {
    await expect(createModeSchema.validate({ ...validForm, eventType: '' })).rejects.toThrow();
  });

  it('fails when eventDate is empty', async () => {
    await expect(createModeSchema.validate({ ...validForm, eventDate: '' })).rejects.toThrow();
  });

  it('fails when eventDate does not match YYYY-MM-DD format', async () => {
    await expect(createModeSchema.validate({ ...validForm, eventDate: '01/12/2026' })).rejects.toThrow();
  });

  it('fails when eventDate is in the past', async () => {
    await expect(createModeSchema.validate({ ...validForm, eventDate: '2020-01-01' })).rejects.toThrow();
  });

  it("passes when eventDate is today's date", async () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate(),
    ).padStart(2, '0')}`;
    await expect(createModeSchema.validate({ ...validForm, eventDate: todayStr })).resolves.toBeDefined();
  });

  it('fails when countryCode is empty', async () => {
    await expect(createModeSchema.validate({ ...validForm, countryCode: '' })).rejects.toThrow();
  });

  it('fails when countryCode is too short', async () => {
    await expect(createModeSchema.validate({ ...validForm, countryCode: 'U' })).rejects.toThrow();
  });

  it('fails when countryCode exceeds 64 characters', async () => {
    await expect(createModeSchema.validate({ ...validForm, countryCode: 'a'.repeat(65) })).rejects.toThrow();
  });

  it('passes when sponsor is empty', async () => {
    await expect(createModeSchema.validate({ ...validForm, sponsor: '' })).resolves.toBeDefined();
  });

  it('fails when sponsor exceeds 128 characters', async () => {
    await expect(createModeSchema.validate({ ...validForm, sponsor: 'a'.repeat(129) })).rejects.toThrow();
  });

  it('fails when raceFormat is empty', async () => {
    await expect(createModeSchema.validate({ ...validForm, raceFormat: '' })).rejects.toThrow();
  });

  it('fails when maxLaps is less than 1', async () => {
    await expect(createModeSchema.validate({ ...validForm, maxLaps: 0 })).rejects.toThrow();
  });

  it('fails when maxLaps is missing', async () => {
    await expect(
      createModeSchema.validate({ ...validForm, maxLaps: undefined as unknown as number }),
    ).rejects.toThrow();
  });

  it('fails when maxTimeInMinutes is not one of the allowed Select values', async () => {
    await expect(createModeSchema.validate({ ...validForm, maxTimeInMinutes: '0' })).rejects.toThrow();
  });

  it('fails when maxTimeInMinutes is missing', async () => {
    await expect(
      createModeSchema.validate({ ...validForm, maxTimeInMinutes: undefined as unknown as string }),
    ).rejects.toThrow();
  });

  it('passes when maxTimeInMinutes is a valid option', async () => {
    await expect(createModeSchema.validate({ ...validForm, maxTimeInMinutes: '10' })).resolves.toBeDefined();
  });

  it('fails when maxResets is not one of the allowed Select values', async () => {
    await expect(createModeSchema.validate({ ...validForm, maxResets: '-1' })).rejects.toThrow();
  });

  it('fails when maxResets is missing', async () => {
    await expect(
      createModeSchema.validate({ ...validForm, maxResets: undefined as unknown as string }),
    ).rejects.toThrow();
  });

  it('passes when maxResets is "0"', async () => {
    await expect(createModeSchema.validate({ ...validForm, maxResets: '0' })).resolves.toBeDefined();
  });

  it('passes when maxResets is "9999" (Unlimited)', async () => {
    await expect(createModeSchema.validate({ ...validForm, maxResets: '9999' })).resolves.toBeDefined();
  });

  it('fails when maxRunsPerRacer is not one of the allowed Select values', async () => {
    await expect(createModeSchema.validate({ ...validForm, maxRunsPerRacer: '7' })).rejects.toThrow();
  });

  it('passes when maxRunsPerRacer is "" (Unlimited)', async () => {
    await expect(createModeSchema.validate({ ...validForm, maxRunsPerRacer: '' })).resolves.toBeDefined();
  });

  it('passes when maxRunsPerRacer is a valid numeric option', async () => {
    await expect(createModeSchema.validate({ ...validForm, maxRunsPerRacer: '3' })).resolves.toBeDefined();
  });

  it('passes with optional combinedScoringStrategy provided', async () => {
    await expect(
      createModeSchema.validate({
        ...validForm,
        combinedScoringStrategy: CombinedScoringStrategy.BEST_RESULT_PER_RACER,
      }),
    ).resolves.toBeDefined();
  });

  it('fails when averageLapsWindow is not one of the allowed Select values', async () => {
    await expect(createModeSchema.validate({ ...validForm, averageLapsWindow: '8' })).rejects.toThrow();
  });

  it('passes when averageLapsWindow is a valid option', async () => {
    await expect(createModeSchema.validate({ ...validForm, averageLapsWindow: '5' })).resolves.toBeDefined();
  });

  it('fails when trackType is empty', async () => {
    await expect(createModeSchema.validate({ ...validForm, trackType: '' })).rejects.toThrow();
  });

  it('passes when trackType is a valid TrackId', async () => {
    await expect(createModeSchema.validate({ ...validForm, trackType: TrackId.REINVENT_2018 })).resolves.toBeDefined();
  });
});

describe('createEventValidationSchema (edit mode)', () => {
  // Edit mode's Tracks section reuses EventTracks, which derives its own effective
  // layout from the event's existing tracks — there's nothing to persist trackType
  // against on the Event itself, so the field isn't required when editing.
  const editModeSchema = createEventValidationSchema(true);

  it('passes when trackType is empty', async () => {
    await expect(editModeSchema.validate({ ...validForm, trackType: '' })).resolves.toBeDefined();
  });

  it('still enforces all other required fields', async () => {
    await expect(editModeSchema.validate({ ...validForm, trackType: '', name: '' })).rejects.toThrow();
  });

  it('passes when eventDate is in the past (already-past events must remain editable)', async () => {
    await expect(
      editModeSchema.validate({ ...validForm, trackType: '', eventDate: '2020-01-01' }),
    ).resolves.toBeDefined();
  });

  it('still enforces eventDate format in edit mode', async () => {
    await expect(editModeSchema.validate({ ...validForm, trackType: '', eventDate: '01/12/2026' })).rejects.toThrow();
  });
});

describe('CREATE_EVENT_DEFAULTS', () => {
  it('has expected default values', () => {
    expect(CREATE_EVENT_DEFAULTS.name).toBe('');
    expect(CREATE_EVENT_DEFAULTS.eventType).toBe('');
    expect(CREATE_EVENT_DEFAULTS.raceFormat).toBe('');
    expect(CREATE_EVENT_DEFAULTS.maxLaps).toBe(5);
    expect(CREATE_EVENT_DEFAULTS.maxTimeInMinutes).toBe('3');
    expect(CREATE_EVENT_DEFAULTS.maxResets).toBe('9999');
    expect(CREATE_EVENT_DEFAULTS.maxRunsPerRacer).toBe('3');
    expect(CREATE_EVENT_DEFAULTS.averageLapsWindow).toBe('3');
    expect(CREATE_EVENT_DEFAULTS.trackType).toBe('');
  });
});
