// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LiveEventStatus } from '@deepracer-indy/typescript-client';
import { describe, expect, it } from 'vitest';

import { mapLiveEventStatusToRaceStatus } from '../mapLiveEventStatusToRaceStatus.js';

describe('mapLiveEventStatusToRaceStatus', () => {
  it('returns IN_PROGRESS for LiveEventStatus.IN_PROGRESS', () => {
    expect(mapLiveEventStatusToRaceStatus(LiveEventStatus.IN_PROGRESS)).toBe('IN_PROGRESS');
  });

  it('returns COMPLETED for LiveEventStatus.COMPLETED', () => {
    expect(mapLiveEventStatusToRaceStatus(LiveEventStatus.COMPLETED)).toBe('COMPLETED');
  });

  it('returns null for LiveEventStatus.SCHEDULED (no banner pre-race)', () => {
    expect(mapLiveEventStatusToRaceStatus(LiveEventStatus.SCHEDULED)).toBeNull();
  });

  it('returns null for undefined status', () => {
    expect(mapLiveEventStatusToRaceStatus(undefined)).toBeNull();
  });
});
