// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen, waitFor, within } from '#utils/testUtils';

import { AddTrackFormValues } from './components/validation.js';
import CreateEventTracks from './CreateEventTracks';

vi.mock('#services/deepRacer/fleetsApi.js', () => ({
  useListFleetsQuery: () => ({ data: [] }),
}));

const buildQueuedTrack = (overrides: Partial<AddTrackFormValues> = {}): AddTrackFormValues => ({
  leaderBoardTitle: 'Qualifying Track',
  leaderBoardFooter: '',
  fleetId: '',
  ...overrides,
});

describe('<CreateEventTracks />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeds a single default track on first mount when nothing has been queued yet', async () => {
    const onChange = vi.fn();
    render(<CreateEventTracks queuedTracks={[]} onChange={onChange} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ leaderBoardTitle: 'Track 1' })]);
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('does not re-seed a track after the operator removes every queued track', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CreateEventTracks queuedTracks={[buildQueuedTrack()]} onChange={onChange} />);

    // Simulate the parent applying an onChange([]) from removing the last track.
    rerender(<CreateEventTracks queuedTracks={[]} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders an editable tab per queued track pre-filled with its details', () => {
    render(
      <CreateEventTracks
        queuedTracks={[buildQueuedTrack({ fleetId: 'fleet-001', leaderBoardFooter: 'Go racers!' })]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Track 1' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Qualifying Track')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Go racers!')).toBeInTheDocument();
  });

  it('does not render a trailing add tab when disabled', () => {
    render(<CreateEventTracks queuedTracks={[buildQueuedTrack()]} onChange={vi.fn()} disabled />);

    expect(screen.queryByTestId('btn-add-queued-track')).not.toBeInTheDocument();
  });

  it('disables adding once the max track count is reached', () => {
    const queuedTracks = Array.from({ length: 10 }, (_, i) => buildQueuedTrack({ leaderBoardTitle: `Track ${i}` }));

    render(<CreateEventTracks queuedTracks={queuedTracks} onChange={vi.fn()} />);

    expect(screen.getByTestId('btn-add-queued-track')).toBeDisabled();
  });

  it('immediately appends a new editable track when the add tab is clicked (no separate form)', () => {
    const onChange = vi.fn();
    render(<CreateEventTracks queuedTracks={[buildQueuedTrack()]} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('btn-add-queued-track'));

    expect(onChange).toHaveBeenCalledWith([
      buildQueuedTrack(),
      expect.objectContaining({ leaderBoardTitle: i18n.t('events:detail.tracks.defaultTrackName', { number: 2 }) }),
    ]);
  });

  it('activates the new track tab instead of the add tab after adding a track', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CreateEventTracks queuedTracks={[buildQueuedTrack()]} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('btn-add-queued-track'));

    const updatedTracks = onChange.mock.calls[0]?.[0] as AddTrackFormValues[];
    rerender(<CreateEventTracks queuedTracks={updatedTracks} onChange={onChange} />);

    expect(
      screen.getByRole('tab', { name: i18n.t('events:detail.tracks.defaultTrackName', { number: 2 }) }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('carries the fleet forward from the last track when adding a new one', () => {
    const onChange = vi.fn();
    render(<CreateEventTracks queuedTracks={[buildQueuedTrack({ fleetId: 'fleet-001' })]} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('btn-add-queued-track'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ fleetId: 'fleet-001' }),
      expect.objectContaining({ fleetId: 'fleet-001' }),
    ]);
  });

  it('does not show a Combined tab with fewer than 2 queued tracks', () => {
    render(<CreateEventTracks queuedTracks={[buildQueuedTrack()]} onChange={vi.fn()} />);

    expect(
      screen.queryByRole('tab', { name: i18n.t('events:detail.tracks.combinedTabLabel') }),
    ).not.toBeInTheDocument();
  });

  it('shows a Combined tab with the header/footer fields once 2 or more tracks are queued', async () => {
    render(
      <CreateEventTracks
        queuedTracks={[
          buildQueuedTrack({ leaderBoardTitle: 'Track A' }),
          buildQueuedTrack({ leaderBoardTitle: 'Track B' }),
        ]}
        onChange={vi.fn()}
        combinedLeaderBoardHeader="Grand Final"
        combinedLeaderBoardFooter="Powered by AWS"
        onCombinedLeaderBoardHeaderChange={vi.fn()}
        onCombinedLeaderBoardFooterChange={vi.fn()}
      />,
    );

    const combinedTab = screen.getByRole('tab', { name: i18n.t('events:detail.tracks.combinedTabLabel') });
    expect(combinedTab).toBeInTheDocument();

    fireEvent.click(combinedTab);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Grand Final')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Powered by AWS')).toBeInTheDocument();
    // Fleet is intentionally omitted from the Combined tab.
    expect(screen.queryByText(i18n.t('events:detail.tracks.addModal.fields.fleetId.label'))).not.toBeInTheDocument();
  });

  it('reports combined header/footer edits through their change handlers', async () => {
    const onCombinedLeaderBoardHeaderChange = vi.fn();
    render(
      <CreateEventTracks
        queuedTracks={[
          buildQueuedTrack({ leaderBoardTitle: 'Track A' }),
          buildQueuedTrack({ leaderBoardTitle: 'Track B' }),
        ]}
        onChange={vi.fn()}
        combinedLeaderBoardHeader=""
        combinedLeaderBoardFooter=""
        onCombinedLeaderBoardHeaderChange={onCombinedLeaderBoardHeaderChange}
        onCombinedLeaderBoardFooterChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: i18n.t('events:detail.tracks.combinedTabLabel') }));

    await waitFor(() => {
      expect(screen.getByTestId('input-combined-header')).toBeInTheDocument();
    });
    fireEvent.change(within(screen.getByTestId('input-combined-header')).getByRole('textbox'), {
      target: { value: 'Grand Final' },
    });

    expect(onCombinedLeaderBoardHeaderChange).toHaveBeenCalledWith('Grand Final');
  });

  it('disables the Delete button when only 1 track is queued', () => {
    render(<CreateEventTracks queuedTracks={[buildQueuedTrack()]} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: i18n.t('events:detail.tracks.removeTrackButton') })).toBeDisabled();
  });

  it('enables the Delete button once 2+ tracks are queued', () => {
    render(
      <CreateEventTracks
        queuedTracks={[
          buildQueuedTrack({ leaderBoardTitle: 'Track A' }),
          buildQueuedTrack({ leaderBoardTitle: 'Track B' }),
        ]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: i18n.t('events:detail.tracks.removeTrackButton') })).not.toBeDisabled();
  });

  it('removes a queued track when its Delete button is clicked', () => {
    const onChange = vi.fn();
    const queuedTracks = [
      buildQueuedTrack({ leaderBoardTitle: 'Track A' }),
      buildQueuedTrack({ leaderBoardTitle: 'Track B' }),
    ];

    render(<CreateEventTracks queuedTracks={queuedTracks} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.tracks.removeTrackButton') }));

    expect(onChange).toHaveBeenCalledWith([queuedTracks[1]]);
  });

  it('renumbers generated track titles after removing a track', () => {
    const onChange = vi.fn();
    const queuedTracks = [
      buildQueuedTrack({ leaderBoardTitle: i18n.t('events:detail.tracks.defaultTrackName', { number: 1 }) }),
      buildQueuedTrack({ leaderBoardTitle: i18n.t('events:detail.tracks.defaultTrackName', { number: 2 }) }),
      buildQueuedTrack({ leaderBoardTitle: i18n.t('events:detail.tracks.defaultTrackName', { number: 3 }) }),
    ];

    render(<CreateEventTracks queuedTracks={queuedTracks} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.tracks.removeTrackButton') }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ leaderBoardTitle: i18n.t('events:detail.tracks.defaultTrackName', { number: 1 }) }),
      expect.objectContaining({ leaderBoardTitle: i18n.t('events:detail.tracks.defaultTrackName', { number: 2 }) }),
    ]);
  });

  it('live-syncs an edited field back to the parent as queuedTracks', async () => {
    const onChange = vi.fn();
    render(<CreateEventTracks queuedTracks={[buildQueuedTrack()]} onChange={onChange} />);

    fireEvent.change(screen.getByDisplayValue('Qualifying Track'), { target: { value: 'Renamed Track' } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ leaderBoardTitle: 'Renamed Track' })]);
    });
  });
});
