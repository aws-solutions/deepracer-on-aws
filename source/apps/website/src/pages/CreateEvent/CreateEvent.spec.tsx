// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { CombinedScoringStrategy, EventType, RaceFormat, TrackId } from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { render, screen, fireEvent, waitFor } from '#utils/testUtils';

import CreateEvent from './CreateEvent';

const mockCreateEvent = vi.fn();
const mockAddTrackToEvent = vi.fn();

vi.mock('#services/deepRacer/eventsApi.js', () => ({
  useCreateEventMutation: vi.fn(() => [mockCreateEvent, { isLoading: false }]),
  useAddTrackToEventMutation: vi.fn(() => [mockAddTrackToEvent, { isLoading: false }]),
}));

// AddTrackFields (rendered by CreateEventTracks' queued-track add form) calls
// useListFleetsQuery — ListFleets (Epic 2) has no handler yet, so this stubs it.
vi.mock('#services/deepRacer/fleetsApi.js', () => ({
  useListFleetsQuery: () => ({ data: [] }),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

// Admin authorization is enforced at the route level by <RequiresAdmin> (covered by its
// own spec), so this page renders its form directly without gating on group membership.
describe('<CreateEvent />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEvent.mockReturnValue({ unwrap: () => Promise.resolve('evt-new') });
    mockAddTrackToEvent.mockReturnValue({ unwrap: () => Promise.resolve({ leaderboardId: 'lb-001' }) });
    mockNavigate.mockReset();
  });

  describe('form structure', () => {
    it('renders the create event form', () => {
      render(<CreateEvent />);

      expect(screen.getByText(i18n.t('events:form.createTitle'))).toBeInTheDocument();
    });

    it('renders all required form sections', () => {
      render(<CreateEvent />);

      expect(screen.getByText(i18n.t('events:form.sections.eventDetails'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('events:form.sections.raceConfiguration'))).toBeInTheDocument();
    });

    it('renders all required form fields', () => {
      render(<CreateEvent />);

      expect(screen.getByText(i18n.t('events:form.fields.name.label'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('events:form.fields.eventType.label'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('events:form.fields.eventDate.label'))).toBeInTheDocument();
      expect(screen.getByPlaceholderText(i18n.t('events:form.fields.eventDate.placeholder'))).toHaveAttribute(
        'name',
        'eventDate',
      );
      expect(screen.getByText(i18n.t('events:form.fields.countryCode.label'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('events:form.fields.raceFormat.label'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('events:form.fields.maxLaps.label'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('events:form.fields.maxTimeInMinutes.label'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('events:form.fields.maxRunsPerRacer.label'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('events:form.fields.maxResets.label'))).toBeInTheDocument();
    });

    it('defaults maximum runs per racer to 3', () => {
      render(<CreateEvent />);

      const wrapper = createWrapper();
      const maxRunsSelect = wrapper.findSelect('[data-testid="select-max-runs-per-racer"]');
      expect(maxRunsSelect?.findTrigger().getElement().textContent).toBe('3');
    });

    it('defaults maximum time to 3 minutes and maximum resets to "Unlimited"', () => {
      render(<CreateEvent />);

      const wrapper = createWrapper();
      const maxTimeSelect = wrapper.findSelect('[data-testid="select-max-time-in-minutes"]');
      expect(maxTimeSelect?.findTrigger().getElement().textContent).toBe('3');

      const maxResetsSelect = wrapper.findSelect('[data-testid="select-max-resets"]');
      expect(maxResetsSelect?.findTrigger().getElement().textContent).toBe(
        i18n.t('events:form.fields.maxResets.unlimitedOption'),
      );
    });

    it('disables the average lap window Select when raceFormat is not Average laps', () => {
      render(<CreateEvent />);

      const wrapper = createWrapper();
      const averageLapsWindowSelect = wrapper.findSelect('[data-testid="select-average-laps-window"]');
      expect(averageLapsWindowSelect?.findTrigger().getElement()).toBeDisabled();
    });

    it('enables the average lap window Select once raceFormat is set to Average laps', async () => {
      render(<CreateEvent />);

      const wrapper = createWrapper();
      const raceFormatSelect = wrapper.findSelect('[data-testid="select-race-format"]');
      if (!raceFormatSelect) throw new Error('raceFormatSelect not found');
      raceFormatSelect.openDropdown();
      raceFormatSelect.selectOptionByValue(RaceFormat.AVERAGE_LAPS);

      await waitFor(() => {
        const averageLapsWindowSelect = wrapper.findSelect('[data-testid="select-average-laps-window"]');
        expect(averageLapsWindowSelect?.findTrigger().getElement()).not.toBeDisabled();
      });
    });

    it('renders form action buttons', () => {
      render(<CreateEvent />);

      expect(screen.getByRole('button', { name: i18n.t('events:form.createButton') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: i18n.t('events:form.cancelButton') })).toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('shows validation errors when required fields are empty on save', async () => {
      render(<CreateEvent />);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.createButton') }));

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:form.validation.nameRequired'))).toBeInTheDocument();
      });
    });

    it('blocks submission until every required field is provided', async () => {
      render(<CreateEvent />);

      fireEvent.change(screen.getByPlaceholderText(i18n.t('events:form.fields.name.placeholder')), {
        target: { value: 'My New Event' },
      });

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.createButton') }));

      await waitFor(() => {
        expect(screen.getByText(i18n.t('events:form.validation.eventTypeRequired'))).toBeInTheDocument();
      });
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it('navigates away on cancel', () => {
      render(<CreateEvent />);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.cancelButton') }));

      expect(mockNavigate).toHaveBeenCalled();
    });

    it('creates queued tracks via sequential AddTrackToEvent calls using the event-level trackType', async () => {
      render(<CreateEvent />);

      fireEvent.change(screen.getByPlaceholderText(i18n.t('events:form.fields.name.placeholder')), {
        target: { value: 'My New Event' },
      });

      const wrapper = createWrapper();
      const eventTypeSelect = wrapper.findSelect('[data-testid="select-event-type"]');
      eventTypeSelect?.openDropdown();
      eventTypeSelect?.selectOptionByValue(EventType.AWS_SUMMIT);

      fireEvent.change(screen.getByPlaceholderText(i18n.t('events:form.fields.eventDate.placeholder')), {
        target: { value: '2026/12/01' },
      });

      const countrySelect = wrapper.findSelect('[data-testid="select-country-code"]');
      countrySelect?.openDropdown();
      countrySelect?.selectOptionByValue('US');

      const raceFormatSelect = wrapper.findSelect('[data-testid="select-race-format"]');
      raceFormatSelect?.openDropdown();
      raceFormatSelect?.selectOptionByValue(RaceFormat.BEST_LAP);

      fireEvent.change(screen.getByLabelText(i18n.t('events:form.fields.maxLaps.label')), {
        target: { value: '5' },
      });

      const trackTypeSelect = wrapper.findSelect('[data-testid="select-track-type"]');
      trackTypeSelect?.openDropdown();
      trackTypeSelect?.selectOptionByValue(TrackId.AWS_SUMMIT_RACEWAY);

      // CreateEventTracks auto-seeds its first track and renders each queued track as
      // an editable tab. The trailing "+" tab immediately appends the second track.
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Track 1' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('btn-add-queued-track'));
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Track 2' })).toBeInTheDocument();
      });
      fireEvent.change(screen.getByDisplayValue('Track 2'), { target: { value: 'Qualifying Track' } });
      await waitFor(() => {
        expect(screen.getByDisplayValue('Qualifying Track')).toBeInTheDocument();
      });
      expect(screen.getByRole('tab', { name: 'Track 2' })).toBeInTheDocument();

      // A "Combined" preview tab should appear automatically now that 2 tracks are queued.
      expect(screen.getByRole('tab', { name: i18n.t('events:detail.tracks.combinedTabLabel') })).toBeInTheDocument();

      // 2+ queued tracks require a combined scoring strategy to be selected before saving.
      const combinedScoringSelect = wrapper.findSelect('[data-testid="select-combined-scoring-strategy"]');
      combinedScoringSelect?.openDropdown();
      combinedScoringSelect?.selectOptionByValue(CombinedScoringStrategy.BEST_RESULT_PER_RACER);

      fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.createButton') }));

      await waitFor(() => {
        expect(mockCreateEvent).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(mockAddTrackToEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            eventId: 'evt-new',
            trackType: TrackId.AWS_SUMMIT_RACEWAY,
            leaderBoardTitle: 'Track 1',
          }),
        );
      });
      await waitFor(() => {
        expect(mockAddTrackToEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            eventId: 'evt-new',
            trackType: TrackId.AWS_SUMMIT_RACEWAY,
            leaderBoardTitle: 'Qualifying Track',
          }),
        );
      });
      expect(mockAddTrackToEvent).toHaveBeenCalledTimes(2);
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
    });
  });
});
