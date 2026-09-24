// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen } from '#utils/testUtils';

import { SelectEventAndTrackModal } from '../SelectEventAndTrackModal';

const events = [
  { eventId: 'event-1', name: 'Event 1' },
  { eventId: 'event-2', name: 'Event 2' },
];
const tracks = [
  { leaderboardId: 'track-1', name: 'Track 1' },
  { leaderboardId: 'track-2', name: 'Track 2' },
];

// Keep query data referentially stable. Recreating either array per render would recreate the
// memoized Select options, continually re-run the modal's preselection effects, and hang tests.
const mockListEventsQuery = vi.fn((_input?: unknown, _options?: unknown) => ({ data: events, isLoading: false }));
const mockListEventTracksQuery = vi.fn((_input?: unknown, _options?: unknown) => ({
  data: tracks,
  isLoading: false,
}));

vi.mock('#services/deepRacer/eventsApi.js', () => ({
  useListEventsQuery: (input?: unknown, options?: unknown) => mockListEventsQuery(input, options),
  useListEventTracksQuery: (input?: unknown, options?: unknown) => mockListEventTracksQuery(input, options),
}));

describe('<SelectEventAndTrackModal />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListEventsQuery.mockReturnValue({ data: events, isLoading: false });
    mockListEventTracksQuery.mockReturnValue({ data: tracks, isLoading: false });
  });

  it('renders the event and track selects when visible', () => {
    render(<SelectEventAndTrackModal isVisible onDismiss={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByTestId('select-event-and-track-modal-event-select')).toBeInTheDocument();
    expect(screen.getByTestId('select-event-and-track-modal-track-select')).toBeInTheDocument();
  });

  it('disables the track select until an event is chosen', () => {
    render(<SelectEventAndTrackModal isVisible onDismiss={vi.fn()} onConfirm={vi.fn()} />);

    const wrapper = createWrapper();
    const trackSelect = wrapper.findSelect('[data-testid="select-event-and-track-modal-track-select"]');

    expect(trackSelect?.isDisabled()).toBe(true);
  });

  it('shows Track loading after an event is chosen while tracks are loading', () => {
    mockListEventTracksQuery.mockReturnValue({ data: [], isLoading: true });
    render(<SelectEventAndTrackModal isVisible onDismiss={vi.fn()} onConfirm={vi.fn()} />);

    const wrapper = createWrapper();
    const eventSelect = wrapper.findSelect('[data-testid="select-event-and-track-modal-event-select"]');
    eventSelect?.openDropdown();
    eventSelect?.selectOptionByValue('event-1');

    const trackSelect = wrapper.findSelect('[data-testid="select-event-and-track-modal-track-select"]');
    expect(trackSelect?.isDisabled()).toBe(true);
    expect(trackSelect?.findTrigger().getElement()).toHaveTextContent(
      i18n.t('timekeeping:contextSelection.loadingTracks'),
    );
  });

  it('disables the confirm button until both an event and track are selected', () => {
    render(<SelectEventAndTrackModal isVisible onDismiss={vi.fn()} onConfirm={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: i18n.t('timekeeping:contextSelection.selectModalConfirm') }),
    ).toBeDisabled();
  });

  it('enables the track select and confirm after choosing an event and track, then calls onConfirm', () => {
    const onConfirm = vi.fn();
    render(<SelectEventAndTrackModal isVisible onDismiss={vi.fn()} onConfirm={onConfirm} />);

    const wrapper = createWrapper();
    const eventSelect = wrapper.findSelect('[data-testid="select-event-and-track-modal-event-select"]');
    eventSelect?.openDropdown();
    eventSelect?.selectOptionByValue('event-1');

    const trackSelect = wrapper.findSelect('[data-testid="select-event-and-track-modal-track-select"]');
    expect(trackSelect?.isDisabled()).toBe(false);
    trackSelect?.openDropdown();
    trackSelect?.selectOptionByValue('track-1');

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:contextSelection.selectModalConfirm') }));

    expect(onConfirm).toHaveBeenCalledWith('event-1', 'track-1', 'Event 1', 'Track 1');
  });

  it('calls onDismiss when cancel is clicked', () => {
    const onDismiss = vi.fn();
    render(<SelectEventAndTrackModal isVisible onDismiss={onDismiss} onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:contextSelection.selectModalCancel') }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('preselects the event and track from initialEventId/initialLeaderboardId when reopened', () => {
    render(
      <SelectEventAndTrackModal
        isVisible
        initialEventId="event-2"
        initialLeaderboardId="track-2"
        onDismiss={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Event 2')).toBeInTheDocument();
    expect(screen.getByText('Track 2')).toBeInTheDocument();
  });

  it('skips fetching events and tracks when not visible', () => {
    mockListEventsQuery.mockClear();
    mockListEventTracksQuery.mockClear();

    render(<SelectEventAndTrackModal isVisible={false} onDismiss={vi.fn()} onConfirm={vi.fn()} />);

    expect(mockListEventsQuery).toHaveBeenCalledWith({ status: 'IN_PROGRESS' }, { skip: true });
  });
});
