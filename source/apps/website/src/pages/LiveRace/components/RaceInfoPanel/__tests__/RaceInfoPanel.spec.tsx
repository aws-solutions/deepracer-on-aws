// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { render, screen } from '#utils/testUtils';

import RaceInfoPanel from '../RaceInfoPanel';

describe('<RaceInfoPanel />', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays countdown when liveEventTime is in the future', () => {
    vi.setSystemTime(new Date('2026-03-10T13:00:00Z'));

    render(<RaceInfoPanel liveEventTime="2026-03-10T14:00:00Z" />);

    expect(screen.getByText(/1h/)).toBeInTheDocument();
  });

  it('hides countdown when liveEventTime is in the past', () => {
    vi.setSystemTime(new Date('2026-03-10T15:00:00Z'));

    render(<RaceInfoPanel liveEventTime="2026-03-10T14:00:00Z" />);

    expect(screen.queryByText(/Starts in/)).not.toBeInTheDocument();
  });
});
