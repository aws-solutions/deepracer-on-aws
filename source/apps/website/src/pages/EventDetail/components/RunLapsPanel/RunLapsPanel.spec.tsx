// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { Lap, Leaderboard, Profile, Run, RunStatus } from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen, waitFor } from '#utils/testUtils';

import RunLapsPanel from './RunLapsPanel';

const mockTrack: Leaderboard = {
  leaderboardId: 'lb-001',
  name: 'Track 1',
  openTime: new Date('2026-09-01T00:00:00Z'),
  closeTime: new Date('2026-09-30T00:00:00Z'),
  trackConfig: { trackId: 'REINVENT_2018', direction: 'CW' },
  raceType: 'HEAD_TO_BOT',
  maxSubmissionsPerUser: 0,
  resettingBehaviorConfig: { continuousLap: true },
  submissionTerminationConditions: { minimumLaps: 1, maximumLaps: 5 },
  timingMethod: 'BEST_LAP_TIME',
  participantCount: 0,
} as unknown as Leaderboard;

const mockProfile: Profile = {
  profileId: 'profile-001',
  alias: 'Speedy Racer',
  avatar: {},
};

const mockRun: Run = {
  runId: 'run-001',
  leaderboardId: 'lb-001',
  eventId: 'evt-001',
  profileId: 'profile-001',
  runStatus: RunStatus.FINISHED,
  createdAt: new Date('2026-09-15T10:00:00Z'),
  updatedAt: new Date('2026-09-15T10:00:00Z'),
};

const mockLap: Lap = {
  runId: 'run-001',
  leaderboardId: 'lb-001',
  lapNumber: 1,
  lapTimeMs: 11230,
  isValid: true,
  resets: 0,
  createdAt: new Date('2026-09-15T10:01:00Z'),
  updatedAt: new Date('2026-09-15T10:01:00Z'),
};

const mockListRunsQuery = vi.fn();
const mockListProfilesQuery = vi.fn();
const mockGetRunQuery = vi.fn();
const mockUpdateLap = vi.fn();

vi.mock('#services/deepRacer/runsApi.js', () => ({
  useListRunsQuery: (...args: unknown[]) => mockListRunsQuery(...args),
  useGetRunQuery: (...args: unknown[]) => mockGetRunQuery(...args),
  useUpdateLapMutation: vi.fn(() => [mockUpdateLap, { isLoading: false }]),
}));

vi.mock('#services/deepRacer/profileApi.js', () => ({
  useListProfilesQuery: (...args: unknown[]) => mockListProfilesQuery(...args),
}));

const selectTrack = (leaderboardId = 'lb-001') => {
  const wrapper = createWrapper();
  const trackSelect = wrapper.findSelect('[data-testid="track-select"]');
  trackSelect?.openDropdown();
  trackSelect?.selectOptionByValue(leaderboardId);
};

const selectRacer = (profileId = 'profile-001') => {
  const wrapper = createWrapper();
  const racerSelect = wrapper.findSelect('[data-testid="racer-select"]');
  racerSelect?.openDropdown();
  racerSelect?.selectOptionByValue(profileId);
};

const selectRun = (runId = 'run-001') => {
  const wrapper = createWrapper();
  const runSelect = wrapper.findSelect('[data-testid="run-select"]');
  runSelect?.openDropdown();
  runSelect?.selectOptionByValue(runId);
};

const selectTrackRacerAndRun = () => {
  selectTrack();
  selectRacer();
  selectRun();
};

describe('<RunLapsPanel />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListRunsQuery.mockReturnValue({ data: [mockRun], isFetching: false, isError: false });
    mockListProfilesQuery.mockReturnValue({ data: [mockProfile] });
    mockGetRunQuery.mockReturnValue({ data: undefined, isFetching: false, isError: false });
    mockUpdateLap.mockReturnValue({ unwrap: () => Promise.resolve({ lap: mockLap }) });
  });

  it('renders the run lookup header and track selector', () => {
    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);

    expect(screen.getByText(i18n.t('events:detail.runs.lookup.header'))).toBeInTheDocument();

    const trackSelect = createWrapper().findSelect('[data-testid="track-select"]');
    expect(trackSelect?.findTrigger().getElement()).toHaveTextContent(
      i18n.t('events:detail.runs.lookup.trackPlaceholder'),
    );
  });

  it('disables the racer and run selectors until a track is chosen', () => {
    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);

    const wrapper = createWrapper();
    expect(wrapper.findSelect('[data-testid="racer-select"]')?.findTrigger().getElement()).toBeDisabled();
    expect(wrapper.findSelect('[data-testid="run-select"]')?.findTrigger().getElement()).toBeDisabled();

    expect(mockListRunsQuery).toHaveBeenCalledWith(expect.anything());
    const [firstCallArg] = mockListRunsQuery.mock.calls[0] as [unknown];
    expect(typeof firstCallArg).toBe('symbol');
  });

  it('queries ListRuns for the selected track and enables the racer selector', () => {
    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);

    selectTrack();

    expect(mockListRunsQuery).toHaveBeenLastCalledWith({ eventId: 'evt-001', leaderboardId: 'lb-001' });
    const racerSelect = createWrapper().findSelect('[data-testid="racer-select"]');
    expect(racerSelect?.findTrigger().getElement()).not.toBeDisabled();
  });

  it('resets the racer and run selection when the track changes', () => {
    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);

    selectTrack();
    selectRacer();

    let wrapper = createWrapper();
    expect(wrapper.findSelect('[data-testid="run-select"]')?.findTrigger().getElement()).not.toBeDisabled();

    selectTrack();

    wrapper = createWrapper();
    expect(wrapper.findSelect('[data-testid="racer-select"]')?.findTrigger().getElement()).toHaveTextContent(
      i18n.t('events:detail.runs.lookup.racerPlaceholder'),
    );
    expect(wrapper.findSelect('[data-testid="run-select"]')?.findTrigger().getElement()).toBeDisabled();
  });

  it('only lists racers who have at least one run on the selected track', () => {
    mockListProfilesQuery.mockReturnValue({
      data: [mockProfile, { profileId: 'profile-002', alias: 'No Runs Racer', avatar: {} }],
    });

    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);
    selectTrack();

    const racerSelect = createWrapper().findSelect('[data-testid="racer-select"]');
    racerSelect?.openDropdown();
    const optionTexts = racerSelect
      ?.findDropdown()
      .findOptions()
      ?.map((option) => option.getElement().textContent);

    expect(optionTexts).toEqual(['Speedy Racer']);
  });

  it("enables the run selector and lists only that racer's runs once a racer is chosen", () => {
    const otherRacerRun: Run = { ...mockRun, runId: 'run-002', profileId: 'profile-002' };
    mockListRunsQuery.mockReturnValue({ data: [mockRun, otherRacerRun], isFetching: false, isError: false });
    mockListProfilesQuery.mockReturnValue({
      data: [mockProfile, { profileId: 'profile-002', alias: 'Other Racer', avatar: {} }],
    });

    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);
    selectTrack();
    selectRacer('profile-001');

    const runSelect = createWrapper().findSelect('[data-testid="run-select"]');
    expect(runSelect?.findTrigger().getElement()).not.toBeDisabled();

    runSelect?.openDropdown();
    expect(runSelect?.findDropdown().findOptions()).toHaveLength(1);
  });

  it('queries GetRun with the selected track and run once a run is chosen', () => {
    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);

    selectTrackRacerAndRun();

    expect(mockGetRunQuery).toHaveBeenLastCalledWith({
      eventId: 'evt-001',
      leaderboardId: 'lb-001',
      runId: 'run-001',
    });
  });

  it('shows a not-found alert when the run lookup fails', async () => {
    mockGetRunQuery.mockReturnValue({ data: undefined, isFetching: false, isError: true });

    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);
    selectTrackRacerAndRun();

    await waitFor(() => {
      expect(screen.getByText(i18n.t('events:detail.runs.lookup.notFound'))).toBeInTheDocument();
    });
  });

  it('renders the run status and lap table once the run is found', async () => {
    mockGetRunQuery.mockReturnValue({ data: { run: mockRun, laps: [mockLap] }, isFetching: false, isError: false });

    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);
    selectTrackRacerAndRun();

    await waitFor(() => {
      expect(screen.getByText(i18n.t('events:detail.runStatus.FINISHED'))).toBeInTheDocument();
    });

    expect(screen.getByText('1')).toBeInTheDocument(); // lap number
  });

  it('renders the empty laps message when the run has no laps', async () => {
    mockGetRunQuery.mockReturnValue({ data: { run: mockRun, laps: [] }, isFetching: false, isError: false });

    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);
    selectTrackRacerAndRun();

    await waitFor(() => {
      expect(screen.getByText(i18n.t('events:detail.runs.lapTable.empty'))).toBeInTheDocument();
    });
  });

  it('shows the edit button for Admins', async () => {
    mockGetRunQuery.mockReturnValue({ data: { run: mockRun, laps: [mockLap] }, isFetching: false, isError: false });

    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);
    selectTrackRacerAndRun();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: i18n.t('events:detail.runs.lapTable.editButton') }),
      ).toBeInTheDocument();
    });
  });

  it('hides the edit button for non-Admins', async () => {
    mockGetRunQuery.mockReturnValue({ data: { run: mockRun, laps: [mockLap] }, isFetching: false, isError: false });

    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin={false} />);
    selectTrackRacerAndRun();

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('events:detail.runs.lapTable.header', { runId: mockRun.runId })),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: i18n.t('events:detail.runs.lapTable.editButton') }),
    ).not.toBeInTheDocument();
  });

  it('opens the lap edit modal when the edit button is clicked', async () => {
    mockGetRunQuery.mockReturnValue({ data: { run: mockRun, laps: [mockLap] }, isFetching: false, isError: false });

    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);
    selectTrackRacerAndRun();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: i18n.t('events:detail.runs.lapTable.editButton') }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.runs.lapTable.editButton') }));

    expect(
      screen.getByText(i18n.t('events:detail.runs.lapEdit.modalHeader', { lapNumber: mockLap.lapNumber })),
    ).toBeInTheDocument();
  });

  it('calls updateLap with the correct identifiers and closes the modal on success', async () => {
    mockGetRunQuery.mockReturnValue({ data: { run: mockRun, laps: [mockLap] }, isFetching: false, isError: false });

    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);
    selectTrackRacerAndRun();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: i18n.t('events:detail.runs.lapTable.editButton') }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.runs.lapTable.editButton') }));

    fireEvent.change(
      screen.getByRole('textbox', { name: i18n.t('events:detail.runs.lapEdit.fields.editReason.label') }),
      { target: { value: 'Corrected using video replay' } },
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.runs.lapEdit.saveButton') }));

    await waitFor(() => {
      expect(mockUpdateLap).toHaveBeenCalledWith({
        eventId: 'evt-001',
        leaderboardId: 'lb-001',
        runId: 'run-001',
        lapNumber: mockLap.lapNumber,
        lapTimeMs: mockLap.lapTimeMs,
        editReason: 'Corrected using video replay',
      });
    });

    await waitFor(() => {
      expect(
        screen.queryByText(i18n.t('events:detail.runs.lapEdit.modalHeader', { lapNumber: mockLap.lapNumber })),
      ).not.toBeInTheDocument();
    });
  });

  it('keeps the modal open when updateLap fails', async () => {
    // Suppresses the expected console.error from the component's catch block; not asserted on
    // directly — the test verifies observable behavior (the modal staying open) instead of this
    // implementation detail. See RunLapsPanel's error notification opt-out tests in
    // runsApi.spec.ts for coverage of the actual error-notification dispatch.
    const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
    mockGetRunQuery.mockReturnValue({ data: { run: mockRun, laps: [mockLap] }, isFetching: false, isError: false });
    mockUpdateLap.mockReturnValue({ unwrap: () => Promise.reject(new Error('Conflict')) });

    render(<RunLapsPanel eventId="evt-001" tracks={[mockTrack]} isAdmin />);
    selectTrackRacerAndRun();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: i18n.t('events:detail.runs.lapTable.editButton') }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.runs.lapTable.editButton') }));

    fireEvent.change(
      screen.getByRole('textbox', { name: i18n.t('events:detail.runs.lapEdit.fields.editReason.label') }),
      { target: { value: 'Corrected using video replay' } },
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.runs.lapEdit.saveButton') }));

    await waitFor(() => {
      expect(mockUpdateLap).toHaveBeenCalled();
    });

    expect(
      screen.getByText(i18n.t('events:detail.runs.lapEdit.modalHeader', { lapNumber: mockLap.lapNumber })),
    ).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
