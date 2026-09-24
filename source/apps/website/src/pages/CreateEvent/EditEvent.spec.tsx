// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import {
  CombinedScoringStrategy,
  Event,
  EventStatus,
  EventType,
  RaceFormat,
  TrackId,
} from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { render, screen, fireEvent, waitFor } from '#utils/testUtils';

import EditEvent from './EditEvent';

interface GetEventQueryResult {
  data: Event | undefined;
  isLoading: boolean;
}

const mockGetEventQuery = vi.fn((): GetEventQueryResult => ({ data: undefined, isLoading: false }));

const mockEditEvent = vi.fn();
const mockAddTrackToEvent = vi.fn();
const mockRemoveTrackFromEvent = vi.fn();
const mockUseListEventTracksQuery = vi.fn();

vi.mock('#services/deepRacer/eventsApi.js', () => ({
  useEditEventMutation: vi.fn(() => [mockEditEvent, { isLoading: false }]),
  useGetEventQuery: (_input: unknown) => mockGetEventQuery(),
  useAddTrackToEventMutation: vi.fn(() => [mockAddTrackToEvent, { isLoading: false }]),
  useRemoveTrackFromEventMutation: vi.fn(() => [mockRemoveTrackFromEvent, { isLoading: false }]),
  useListEventTracksQuery: (...args: unknown[]) => mockUseListEventTracksQuery(...args),
}));

vi.mock('#services/deepRacer/fleetsApi.js', () => ({
  useListFleetsQuery: () => ({ data: [] }),
}));

const mockEditLeaderboard = vi.fn();

vi.mock('#services/deepRacer/leaderboardsApi.js', () => ({
  useEditLeaderboardMutation: vi.fn(() => [mockEditLeaderboard, { isLoading: false }]),
}));

const mockNavigate = vi.fn();
const mockParams: { eventId?: string } = {};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

const mockOpenEvent: Event = {
  eventId: 'evt-001',
  name: 'Test Event',
  eventType: EventType.AWS_SUMMIT,
  eventDate: '2025-12-01',
  countryCode: 'US',
  raceFormat: RaceFormat.BEST_LAP,
  maxLaps: 5,
  maxTimeInMinutes: 3,
  maxResets: 3,
  eventStatus: EventStatus.OPEN,
  createdBy: 'TestAdmin',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockInProgressEvent: Event = { ...mockOpenEvent, eventStatus: EventStatus.IN_PROGRESS };
const mockDraftEvent: Event = { ...mockOpenEvent, eventStatus: EventStatus.DRAFT };

const buildPersistedTrack = (overrides = {}) => ({
  leaderboardId: 'lb-001',
  name: 'Qualifying Track',
  leaderBoardFooter: 'Original footer',
  fleetId: 'fleet-001',
  trackType: TrackId.AWS_SUMMIT_RACEWAY,
  ...overrides,
});

describe('<EditEvent />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEventQuery.mockReturnValue({ data: mockDraftEvent, isLoading: false });
    mockEditEvent.mockReturnValue({ unwrap: () => Promise.resolve({ eventId: 'evt-001' }) });
    mockAddTrackToEvent.mockReturnValue({ unwrap: () => Promise.resolve({ leaderboardId: 'lb-002' }) });
    mockRemoveTrackFromEvent.mockReturnValue({ unwrap: () => Promise.resolve() });
    mockEditLeaderboard.mockReturnValue({ unwrap: () => Promise.resolve() });
    mockUseListEventTracksQuery.mockReturnValue({ data: [], isLoading: false, isSuccess: true });
    mockNavigate.mockReset();
    mockParams.eventId = 'evt-001';
  });

  describe('field lock rules', () => {
    it('disables config fields when editing an OPEN event', async () => {
      mockGetEventQuery.mockReturnValue({ data: mockOpenEvent, isLoading: false });

      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:form.editTitle'))).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue('Test Event')).toBeDisabled();
      expect(screen.getByDisplayValue('2025/12/01')).toBeDisabled();

      const wrapper = createWrapper();
      const countrySelect = wrapper.findSelect('[data-testid="select-country-code"]');
      expect(countrySelect?.findTrigger().getElement()).toBeDisabled();
    });

    it("shows the country name and flag for the event's countryCode", async () => {
      mockGetEventQuery.mockReturnValue({ data: mockOpenEvent, isLoading: false });

      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:form.editTitle'))).toBeInTheDocument();
      });

      const wrapper = createWrapper();
      const countrySelect = wrapper.findSelect('[data-testid="select-country-code"]');
      expect(countrySelect?.findTrigger().getElement().textContent).toBe('United States of America');
      expect(screen.getByTestId('country-flag')).toHaveTextContent('🇺🇸');
    });

    it('keeps the sponsor field enabled when the event is OPEN', async () => {
      mockGetEventQuery.mockReturnValue({ data: mockOpenEvent, isLoading: false });

      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:form.editTitle'))).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText(i18n.t('events:form.fields.sponsor.placeholder'))).not.toBeDisabled();
    });

    it('disables the sponsor field once the event is IN_PROGRESS', async () => {
      mockGetEventQuery.mockReturnValue({ data: mockInProgressEvent, isLoading: false });

      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:form.editTitle'))).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue('Test Event')).toBeDisabled();
      expect(screen.getByDisplayValue('2025/12/01')).toBeDisabled();
    });
  });

  describe('event save', () => {
    it('calls editEvent with form data on save', async () => {
      mockGetEventQuery.mockReturnValue({ data: mockOpenEvent, isLoading: false });

      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:form.editTitle'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.saveButton') }));

      await waitFor(() => {
        expect(mockEditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            eventDefinition: expect.objectContaining({ maxRunsPerRacer: undefined, eventDate: '2025-12-01' }),
          }),
        );
      });
    });

    it('sends the selected numeric cap for maximum runs per racer on save', async () => {
      render(<EditEvent />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: `${i18n.t('events:form.fields.maxRunsPerRacer.label')} ${i18n.t('events:form.fields.maxRunsPerRacer.unlimitedOption')}`,
          }),
        ).toBeInTheDocument();
      });

      const wrapper = createWrapper();
      const maxRunsSelect = wrapper.findSelect('[data-testid="select-max-runs-per-racer"]');
      if (!maxRunsSelect) throw new Error('maxRunsSelect not found');
      maxRunsSelect.openDropdown();
      maxRunsSelect.selectOptionByValue('3');

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.saveButton') }));

      await waitFor(() => {
        expect(mockEditEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventDefinition: expect.objectContaining({ maxRunsPerRacer: 3 }) }),
        );
      });
    });

    it('sends the selected maximum time and the Unlimited sentinel for maximum resets on save', async () => {
      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Maximum time \(minutes\) 3/ })).toBeInTheDocument();
      });

      const wrapper = createWrapper();
      const maxTimeSelect = wrapper.findSelect('[data-testid="select-max-time-in-minutes"]');
      if (!maxTimeSelect) throw new Error('maxTimeSelect not found');
      maxTimeSelect.openDropdown();
      maxTimeSelect.selectOptionByValue('7');

      const maxResetsSelect = wrapper.findSelect('[data-testid="select-max-resets"]');
      if (!maxResetsSelect) throw new Error('maxResetsSelect not found');
      maxResetsSelect.openDropdown();
      maxResetsSelect.selectOptionByValue('9999');

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.saveButton') }));

      await waitFor(() => {
        expect(mockEditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            eventDefinition: expect.objectContaining({ maxTimeInMinutes: 7, maxResets: 9999 }),
          }),
        );
      });
    });

    it('sends the selected country code on save and updates the displayed flag', async () => {
      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Country United States of America/ })).toBeInTheDocument();
      });

      const wrapper = createWrapper();
      const countrySelect = wrapper.findSelect('[data-testid="select-country-code"]');
      if (!countrySelect) throw new Error('countrySelect not found');
      countrySelect.openDropdown();
      countrySelect.selectOptionByValue('GB');

      await waitFor(() => {
        expect(screen.getByTestId('country-flag')).toHaveTextContent('🇬🇧');
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.saveButton') }));

      await waitFor(() => {
        expect(mockEditEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventDefinition: expect.objectContaining({ countryCode: 'GB' }) }),
        );
      });
    });

    it('sends averageLapsWindow only when raceFormat is set to Average laps', async () => {
      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Race format Best lap/ })).toBeInTheDocument();
      });

      const wrapper = createWrapper();
      const raceFormatSelect = wrapper.findSelect('[data-testid="select-race-format"]');
      if (!raceFormatSelect) throw new Error('raceFormatSelect not found');
      raceFormatSelect.openDropdown();
      raceFormatSelect.selectOptionByValue(RaceFormat.AVERAGE_LAPS);

      await waitFor(() => {
        const averageLapsWindowSelect = wrapper.findSelect('[data-testid="select-average-laps-window"]');
        expect(averageLapsWindowSelect?.findTrigger().getElement()).not.toBeDisabled();
      });
      const averageLapsWindowSelect = wrapper.findSelect('[data-testid="select-average-laps-window"]');
      if (!averageLapsWindowSelect) throw new Error('averageLapsWindowSelect not found');
      averageLapsWindowSelect.openDropdown();
      averageLapsWindowSelect.selectOptionByValue('5');

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.saveButton') }));

      await waitFor(() => {
        expect(mockEditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            eventDefinition: expect.objectContaining({ raceFormat: RaceFormat.AVERAGE_LAPS, averageLapsWindow: 5 }),
          }),
        );
      });
    });

    it('omits averageLapsWindow when raceFormat remains Best lap', async () => {
      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:form.editTitle'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.saveButton') }));

      await waitFor(() => {
        expect(mockEditEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventDefinition: expect.objectContaining({ averageLapsWindow: undefined }) }),
        );
      });
    });
  });

  describe('staged track changes', () => {
    it('initializes edit tracks from the post-authorization query result', async () => {
      mockUseListEventTracksQuery.mockImplementation((_input: unknown, options: { skip: boolean }) =>
        options.skip
          ? { data: undefined, isLoading: false, isSuccess: false }
          : {
              data: [buildPersistedTrack({ name: 'Persisted header', leaderBoardFooter: 'Persisted footer' })],
              isLoading: false,
              isSuccess: true,
            },
      );

      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Persisted header')).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue('Persisted footer')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Track 1')).not.toBeInTheDocument();
    });

    it('stages persisted track edits locally until Save', async () => {
      mockUseListEventTracksQuery.mockReturnValue({
        data: [buildPersistedTrack()],
        isLoading: false,
        isSuccess: true,
      });

      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Qualifying Track')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByDisplayValue('Qualifying Track'), { target: { value: 'Updated header' } });
      expect(mockEditLeaderboard).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.saveButton') }));

      await waitFor(() => {
        expect(mockEditLeaderboard).toHaveBeenCalledWith(
          expect.objectContaining({
            leaderboardId: 'lb-001',
            leaderboardDefinition: expect.objectContaining({ name: 'Updated header' }),
          }),
        );
      });
    });

    it('stages new tracks locally until Save', async () => {
      mockUseListEventTracksQuery.mockReturnValue({
        data: [buildPersistedTrack()],
        isLoading: false,
        isSuccess: true,
      });

      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Track 1' })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-add-queued-track'));

      expect(screen.getByRole('tab', { name: 'Track 2' })).toBeInTheDocument();
      expect(mockAddTrackToEvent).not.toHaveBeenCalled();

      // 2+ tracks (the persisted track plus the newly queued one) require a combined
      // scoring strategy to be selected before saving.
      const combinedScoringSelect = createWrapper().findSelect('[data-testid="select-combined-scoring-strategy"]');
      combinedScoringSelect?.openDropdown();
      combinedScoringSelect?.selectOptionByValue(CombinedScoringStrategy.BEST_RESULT_PER_RACER);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.saveButton') }));

      await waitFor(() => {
        expect(mockAddTrackToEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            eventId: 'evt-001',
            trackType: TrackId.AWS_SUMMIT_RACEWAY,
            leaderBoardTitle: 'Track 2',
          }),
        );
      });
    });

    it('does not remove or re-create an unchanged hydrated track on Save', async () => {
      mockUseListEventTracksQuery.mockReturnValue({
        data: [buildPersistedTrack()],
        isLoading: false,
        isSuccess: true,
      });

      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Qualifying Track')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.saveButton') }));

      await waitFor(() => {
        expect(mockEditEvent).toHaveBeenCalled();
      });
      expect(mockRemoveTrackFromEvent).not.toHaveBeenCalled();
      expect(mockAddTrackToEvent).not.toHaveBeenCalled();
      expect(mockEditLeaderboard).not.toHaveBeenCalled();
    });
  });

  describe('loading and not-found states', () => {
    it('renders loading screen while the event is loading', async () => {
      mockGetEventQuery.mockReturnValue({ data: undefined, isLoading: true });

      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });

    it('renders the not-found message when the event does not exist', async () => {
      mockGetEventQuery.mockReturnValue({ data: undefined, isLoading: false });

      render(<EditEvent />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:detail.notFound'))).toBeInTheDocument();
      });
    });
  });
});
