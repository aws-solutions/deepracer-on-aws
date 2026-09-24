// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EventStatus } from '@deepracer-indy/typescript-client';
import { describe, expect, it } from 'vitest';

import { mapEventStatusToRaceStatus } from '../mapEventStatusToRaceStatus.js';

describe('mapEventStatusToRaceStatus', () => {
  it('returns RACE_IN_PROGRESS for EventStatus.IN_PROGRESS', () => {
    expect(mapEventStatusToRaceStatus(EventStatus.IN_PROGRESS)).toBe('RACE_IN_PROGRESS');
  });

  it('returns NO_RACER_SELECTED for EventStatus.DRAFT', () => {
    expect(mapEventStatusToRaceStatus(EventStatus.DRAFT)).toBe('NO_RACER_SELECTED');
  });

  it('returns READY_TO_START for EventStatus.OPEN', () => {
    expect(mapEventStatusToRaceStatus(EventStatus.OPEN)).toBe('READY_TO_START');
  });

  it('returns RACE_FINISHED for EventStatus.COMPLETED', () => {
    expect(mapEventStatusToRaceStatus(EventStatus.COMPLETED)).toBe('RACE_FINISHED');
  });

  it('returns RACE_FINISHED for EventStatus.ARCHIVED', () => {
    expect(mapEventStatusToRaceStatus(EventStatus.ARCHIVED)).toBe('RACE_FINISHED');
  });

  it('returns RACE_FINISHED for EventStatus.DELETING', () => {
    expect(mapEventStatusToRaceStatus(EventStatus.DELETING)).toBe('RACE_FINISHED');
  });
});
