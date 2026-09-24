// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import {
  CombinedScoringStrategy,
  Event,
  EventStatus,
  EventType,
  Leaderboard,
  RaceFormat,
  RaceType,
  TimingMethod,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen, waitFor, within } from '#utils/testUtils';

import EventTracks from './EventTracks';

const mockUseListEventTracksQuery = vi.fn();
const mockUseAddTrackToEventMutation = vi.fn();
const mockUseRemoveTrackFromEventMutation = vi.fn();
const mockUseGetCombinedLeaderboardQuery = vi.fn();
const mockAddTrackToEvent = vi.fn();
const mockRemoveTrackFromEvent = vi.fn();

vi.mock('#services/deepRacer/eventsApi.js', () => ({
  useListEventTracksQuery: (...args: unknown[]) => mockUseListEventTracksQuery(...args),
  useAddTrackToEventMutation: (...args: unknown[]) => mockUseAddTrackToEventMutation(...args),
  useRemoveTrackFromEventMutation: (...args: unknown[]) => mockUseRemoveTrackFromEventMutation(...args),
  useGetCombinedLeaderboardQuery: (...args: unknown[]) => mockUseGetCombinedLeaderboardQuery(...args),
}));

const mockUseEditLeaderboardMutation = vi.fn();
const mockEditLeaderboard = vi.fn();

vi.mock('#services/deepRacer/leaderboardsApi.js', () => ({
  useEditLeaderboardMutation: (...args: unknown[]) => mockUseEditLeaderboardMutation(...args),
}));

vi.mock('#services/deepRacer/fleetsApi.js', () => ({
  useListFleetsQuery: () => ({ data: [{ fleetId: 'fleet-001', name: 'fleet-001' }] }),
}));

const baseEvent: Event = {
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
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const buildTrack = (overrides: Partial<Leaderboard> = {}): Leaderboard => ({
  leaderboardId: 'lb-001',
  name: 'Summit Speedway - Qualifying',
  openTime: new Date('2026-01-01'),
  closeTime: new Date('2026-01-02'),
  trackConfig: { trackId: TrackId.AWS_SUMMIT_RACEWAY, trackDirection: TrackDirection.CLOCKWISE },
  raceType: RaceType.TIME_TRIAL,
  maxSubmissionsPerUser: 0,
  timingMethod: TimingMethod.BEST_LAP_TIME,
  resettingBehaviorConfig: { continuousLap: true },
  submissionTerminationConditions: { minimumLaps: 1, maximumLaps: 5 },
  participantCount: 0,
  trackType: TrackId.AWS_SUMMIT_RACEWAY,
  fleetId: 'fleet-001',
  ...overrides,
});

describe('<EventTracks />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseListEventTracksQuery.mockReturnValue({ data: [], isLoading: false });
    mockUseAddTrackToEventMutation.mockReturnValue([mockAddTrackToEvent, { isLoading: false }]);
    mockUseRemoveTrackFromEventMutation.mockReturnValue([mockRemoveTrackFromEvent, { isLoading: false }]);
    mockUseGetCombinedLeaderboardQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mockUseEditLeaderboardMutation.mockReturnValue([mockEditLeaderboard, { isLoading: false }]);
    mockAddTrackToEvent.mockReturnValue({ unwrap: () => Promise.resolve({ leaderboardId: 'lb-001' }) });
    mockRemoveTrackFromEvent.mockReturnValue({ unwrap: () => Promise.resolve() });
    mockEditLeaderboard.mockReturnValue({ unwrap: () => Promise.resolve(buildTrack()) });
  });

  it('renders nothing when not active', () => {
    const { container } = render(<EventTracks event={baseEvent} canManageTracks={false} isActive={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('skips the tracks query when not active', () => {
    render(<EventTracks event={baseEvent} canManageTracks={false} isActive={false} />);

    expect(mockUseListEventTracksQuery).toHaveBeenCalledWith({ eventId: 'evt-001' }, { skip: true });
  });

  it('shows the empty state with an add button when there are no tracks', () => {
    render(
      <EventTracks event={baseEvent} canManageTracks={true} isActive initialTrackType={TrackId.AWS_SUMMIT_RACEWAY} />,
    );

    expect(screen.getByText(i18n.t('events:detail.tracks.emptyTitle'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('events:detail.tracks.addTrackButton') })).toBeInTheDocument();
  });

  it('does not show the add button in the empty state when canManageTracks is false', () => {
    render(<EventTracks event={baseEvent} canManageTracks={false} isActive />);

    expect(screen.getByText(i18n.t('events:detail.tracks.emptyTitle'))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('events:detail.tracks.addTrackButton') }),
    ).not.toBeInTheDocument();
  });

  it('renders an editable tab per track pre-filled with its details', () => {
    mockUseListEventTracksQuery.mockReturnValue({ data: [buildTrack()], isLoading: false });

    render(<EventTracks event={baseEvent} canManageTracks={true} isActive />);

    expect(screen.getByRole('tab', { name: 'Track 1' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Summit Speedway - Qualifying')).toBeInTheDocument();
    expect(createWrapper().findSelect()?.findTrigger().getElement()).toHaveTextContent('fleet-001');
  });

  it('does not show the combined tab with fewer than 2 tracks even with a combined scoring strategy', () => {
    mockUseListEventTracksQuery.mockReturnValue({ data: [buildTrack()], isLoading: false });

    render(
      <EventTracks
        event={{ ...baseEvent, combinedScoringStrategy: CombinedScoringStrategy.BEST_RESULT_PER_RACER }}
        canManageTracks={true}
        isActive
      />,
    );

    expect(
      screen.queryByRole('tab', { name: i18n.t('events:detail.tracks.combinedTabLabel') }),
    ).not.toBeInTheDocument();
  });

  it('shows the combined tab as a peer when there are 2+ tracks and a combined scoring strategy', () => {
    mockUseListEventTracksQuery.mockReturnValue({
      data: [buildTrack(), buildTrack({ leaderboardId: 'lb-002', name: 'Summit Speedway - Finals' })],
      isLoading: false,
    });

    render(
      <EventTracks
        event={{ ...baseEvent, combinedScoringStrategy: CombinedScoringStrategy.BEST_RESULT_PER_RACER }}
        canManageTracks={true}
        isActive
      />,
    );

    expect(screen.getByRole('tab', { name: i18n.t('events:detail.tracks.combinedTabLabel') })).toBeInTheDocument();
  });

  it('does not query the combined leaderboard when the combined tab is not active', () => {
    mockUseListEventTracksQuery.mockReturnValue({
      data: [buildTrack(), buildTrack({ leaderboardId: 'lb-002', name: 'Summit Speedway - Finals' })],
      isLoading: false,
    });

    render(
      <EventTracks
        event={{ ...baseEvent, combinedScoringStrategy: CombinedScoringStrategy.BEST_RESULT_PER_RACER }}
        canManageTracks={true}
        isActive
      />,
    );

    // Cloudscape Tabs only mounts the active tab's content by default (contentRenderStrategy
    // 'active'), so the combined tab's panel — and its data hook — never mounts until selected.
    expect(mockUseGetCombinedLeaderboardQuery).not.toHaveBeenCalled();
  });

  it('queries the combined leaderboard once the combined tab is selected', async () => {
    mockUseListEventTracksQuery.mockReturnValue({
      data: [buildTrack(), buildTrack({ leaderboardId: 'lb-002', name: 'Summit Speedway - Finals' })],
      isLoading: false,
    });

    render(
      <EventTracks
        event={{ ...baseEvent, combinedScoringStrategy: CombinedScoringStrategy.BEST_RESULT_PER_RACER }}
        canManageTracks={true}
        isActive
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: i18n.t('events:detail.tracks.combinedTabLabel') }));

    await waitFor(() => {
      expect(mockUseGetCombinedLeaderboardQuery).toHaveBeenCalledWith({ eventId: 'evt-001' }, { skip: false });
    });
  });

  it('disables the Delete button on the combined tab', () => {
    mockUseListEventTracksQuery.mockReturnValue({
      data: [buildTrack(), buildTrack({ leaderboardId: 'lb-002', name: 'Summit Speedway - Finals' })],
      isLoading: false,
    });

    render(
      <EventTracks
        event={{ ...baseEvent, combinedScoringStrategy: CombinedScoringStrategy.BEST_RESULT_PER_RACER }}
        canManageTracks={true}
        isActive
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: i18n.t('events:detail.tracks.combinedTabLabel') }));

    expect(screen.getByRole('button', { name: i18n.t('events:detail.tracks.removeTrackButton') })).toBeDisabled();
  });

  it('does not show a trailing add tab when canManageTracks is false', () => {
    mockUseListEventTracksQuery.mockReturnValue({ data: [buildTrack()], isLoading: false });

    render(<EventTracks event={baseEvent} canManageTracks={false} isActive />);

    expect(screen.queryByTestId('btn-add-track')).not.toBeInTheDocument();
  });

  it('immediately creates a new track when the trailing add tab is clicked (no separate form)', async () => {
    mockUseListEventTracksQuery.mockReturnValue({ data: [buildTrack()], isLoading: false });

    render(<EventTracks event={baseEvent} canManageTracks={true} isActive />);

    fireEvent.click(screen.getByTestId('btn-add-track'));

    await waitFor(() => {
      expect(mockAddTrackToEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt-001',
          trackType: TrackId.AWS_SUMMIT_RACEWAY,
          leaderBoardTitle: i18n.t('events:detail.tracks.defaultTrackName', { number: 2 }),
          fleetId: 'fleet-001',
        }),
      );
    });
  });

  it('disables the add tab when the event cannot accept more tracks', () => {
    mockUseListEventTracksQuery.mockReturnValue({ data: [buildTrack()], isLoading: false });

    render(
      <EventTracks event={{ ...baseEvent, eventStatus: EventStatus.IN_PROGRESS }} canManageTracks={true} isActive />,
    );

    // The "+" tab is rendered as an icon-variant Button — disabledReason only gets the
    // aria-disabled + tooltip treatment for normal/primary variants, so icon buttons fall
    // back to the native disabled attribute (see button/internal.js, isDisabledWithReason).
    expect(screen.getByTestId('btn-add-track')).toBeDisabled();
  });

  it('disables the Delete button when only 1 track exists', () => {
    mockUseListEventTracksQuery.mockReturnValue({ data: [buildTrack()], isLoading: false });

    render(<EventTracks event={baseEvent} canManageTracks={true} isActive />);

    expect(screen.getByRole('button', { name: i18n.t('events:detail.tracks.removeTrackButton') })).toBeDisabled();
  });

  it('enables the Delete button with 2+ tracks while the event is DRAFT', () => {
    mockUseListEventTracksQuery.mockReturnValue({
      data: [buildTrack(), buildTrack({ leaderboardId: 'lb-002', name: 'Summit Speedway - Finals' })],
      isLoading: false,
    });

    render(<EventTracks event={baseEvent} canManageTracks={true} isActive />);

    expect(screen.getByRole('button', { name: i18n.t('events:detail.tracks.removeTrackButton') })).not.toBeDisabled();
  });

  it('disables the Delete button once the event is not DRAFT, even with 2+ tracks', () => {
    mockUseListEventTracksQuery.mockReturnValue({
      data: [buildTrack(), buildTrack({ leaderboardId: 'lb-002', name: 'Summit Speedway - Finals' })],
      isLoading: false,
    });

    render(<EventTracks event={{ ...baseEvent, eventStatus: EventStatus.OPEN }} canManageTracks={true} isActive />);

    expect(screen.getByRole('button', { name: i18n.t('events:detail.tracks.removeTrackButton') })).toBeDisabled();
  });

  it('opens a remove confirmation when Delete is clicked, and confirms it', async () => {
    mockUseListEventTracksQuery.mockReturnValue({
      data: [buildTrack(), buildTrack({ leaderboardId: 'lb-002', name: 'Summit Speedway - Finals' })],
      isLoading: false,
    });

    render(<EventTracks event={baseEvent} canManageTracks={true} isActive />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.tracks.removeTrackButton') }));

    await waitFor(() => {
      expect(screen.getByText(i18n.t('events:detail.tracks.removeConfirmTitle'))).toBeInTheDocument();
    });

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: i18n.t('events:detail.tracks.removeTrackButton'),
      }),
    );

    await waitFor(() => {
      expect(mockRemoveTrackFromEvent).toHaveBeenCalledWith({ eventId: 'evt-001', leaderboardId: 'lb-001' });
    });
  });

  it('commits an edited track name via EditLeaderboard on blur', async () => {
    mockUseListEventTracksQuery.mockReturnValue({ data: [buildTrack()], isLoading: false });

    render(<EventTracks event={baseEvent} canManageTracks={true} isActive />);

    const nameInput = screen.getByDisplayValue('Summit Speedway - Qualifying');
    fireEvent.change(nameInput, { target: { value: 'Renamed Track' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(mockEditLeaderboard).toHaveBeenCalledWith(
        expect.objectContaining({
          leaderboardId: 'lb-001',
          leaderboardDefinition: expect.objectContaining({ name: 'Renamed Track' }),
        }),
      );
    });
  });

  it('does not call EditLeaderboard when a field is blurred without any change', () => {
    mockUseListEventTracksQuery.mockReturnValue({ data: [buildTrack()], isLoading: false });

    render(<EventTracks event={baseEvent} canManageTracks={true} isActive />);

    const nameInput = screen.getByDisplayValue('Summit Speedway - Qualifying');
    fireEvent.blur(nameInput);

    expect(mockEditLeaderboard).not.toHaveBeenCalled();
  });
});
