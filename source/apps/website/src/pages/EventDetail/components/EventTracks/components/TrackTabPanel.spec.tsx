// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '#utils/testUtils';

import TrackTabPanel from './TrackTabPanel';
import { AddTrackFormValues } from './validation.js';

vi.mock('#services/deepRacer/fleetsApi.js', () => ({
  useListFleetsQuery: () => ({ data: [] }),
}));

const buildTrack = (overrides: Partial<AddTrackFormValues> = {}): AddTrackFormValues => ({
  leaderBoardTitle: '',
  leaderBoardFooter: '',
  fleetId: '',
  ...overrides,
});

describe('<TrackTabPanel />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the passed-in track values', () => {
    render(
      <TrackTabPanel
        track={buildTrack({ leaderBoardTitle: 'Qualifying Track', leaderBoardFooter: 'Go racers!' })}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        deleteDisabled={false}
      />,
    );

    expect(screen.getByDisplayValue('Qualifying Track')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Go racers!')).toBeInTheDocument();
  });

  it('re-populates the fields when the parent hydrates the track after mount', async () => {
    const { rerender } = render(
      <TrackTabPanel track={buildTrack()} onChange={vi.fn()} onDelete={vi.fn()} deleteDisabled={false} />,
    );

    // Fields start empty (placeholder state) before hydrated data arrives.
    expect(screen.queryByDisplayValue('Persisted header')).not.toBeInTheDocument();

    rerender(
      <TrackTabPanel
        track={buildTrack({ leaderBoardTitle: 'Persisted header', leaderBoardFooter: 'Persisted footer' })}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        deleteDisabled={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Persisted header')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Persisted footer')).toBeInTheDocument();
  });

  it('does not report the hydration reset back to the parent as an edit', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TrackTabPanel track={buildTrack()} onChange={onChange} onDelete={vi.fn()} deleteDisabled={false} />,
    );

    rerender(
      <TrackTabPanel
        track={buildTrack({ leaderBoardTitle: 'Persisted header' })}
        onChange={onChange}
        onDelete={vi.fn()}
        deleteDisabled={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Persisted header')).toBeInTheDocument();
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
