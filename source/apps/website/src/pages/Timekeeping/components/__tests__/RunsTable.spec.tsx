// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { AdminProfile, Run, RunStatus, RunTransitionAction } from '@deepracer-indy/typescript-client';
import { userEvent } from '@storybook/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen, waitFor, within } from '#utils/testUtils';

import { ACTIVE_RUN_STATUS_INDICATOR } from '../activeRunStatusIndicator';
import { RunsTable } from '../RunsTable';

const {
  mockUseTimekeepingContext,
  mockUseTimekeepingSession,
  mockRegisterActiveRun,
  mockRegisterCreatedRun,
  mockUseListRunsQuery,
  mockUseCreateRunMutation,
  mockUseTransitionRunStatusMutation,
  mockCreateRun,
  mockTransitionRunStatus,
  mockUseListAdminProfilesQuery,
  mockUseGetEventQuery,
} = vi.hoisted(() => ({
  mockUseTimekeepingContext: vi.fn(),
  mockUseTimekeepingSession: vi.fn(),
  mockRegisterActiveRun: vi.fn(),
  mockRegisterCreatedRun: vi.fn(),
  mockUseListRunsQuery: vi.fn(),
  mockUseCreateRunMutation: vi.fn(),
  mockUseTransitionRunStatusMutation: vi.fn(),
  mockCreateRun: vi.fn(),
  mockTransitionRunStatus: vi.fn(),
  mockUseListAdminProfilesQuery: vi.fn(),
  mockUseGetEventQuery: vi.fn(),
}));

vi.mock('#hooks/useTimekeepingContext.js', () => ({
  useTimekeepingContext: () => mockUseTimekeepingContext(),
}));

vi.mock('#services/deepRacer/runsApi.js', () => ({
  useListRunsQuery: (...args: unknown[]) => mockUseListRunsQuery(...args),
  useCreateRunMutation: () => mockUseCreateRunMutation(),
  useTransitionRunStatusMutation: () => mockUseTransitionRunStatusMutation(),
}));

vi.mock('#services/deepRacer/adminApi.js', () => ({
  useListAdminProfilesQuery: () => mockUseListAdminProfilesQuery(),
}));

vi.mock('#services/deepRacer/eventsApi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#services/deepRacer/eventsApi.js')>();
  return {
    ...actual,
    useGetEventQuery: (...args: unknown[]) => mockUseGetEventQuery(...args),
  };
});

vi.mock('#hooks/useTimekeepingSession.js', () => ({
  useTimekeepingSessionActions: mockUseTimekeepingSession,
}));

const mockProfiles: AdminProfile[] = [
  { profileId: 'profile-001', alias: 'SpeedRacer42' },
  { profileId: 'profile-002', alias: 'TurboML' },
];

const mockRuns: Run[] = [
  {
    runId: 'run-older',
    eventId: 'event-001',
    leaderboardId: 'leaderboard-001',
    profileId: 'profile-001',
    runStatus: RunStatus.SUBMITTED,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
  },
  {
    runId: 'run-active',
    eventId: 'event-001',
    leaderboardId: 'leaderboard-001',
    profileId: 'profile-002',
    runStatus: RunStatus.IN_PROGRESS,
    createdAt: new Date('2026-01-02T10:00:00Z'),
    updatedAt: new Date('2026-01-02T10:00:00Z'),
  },
];

const createdRun: Run = {
  ...mockRuns[0],
  runId: 'run-created',
  profileId: 'profile-001',
  runStatus: RunStatus.READY,
  racedByProxy: false,
};

describe('<RunsTable />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTimekeepingContext.mockReturnValue({
      selectedEventId: 'event-001',
      selectedLeaderboardId: 'leaderboard-001',
    });
    mockUseTimekeepingSession.mockReturnValue({
      registerActiveRun: mockRegisterActiveRun,
      registerCreatedRun: mockRegisterCreatedRun,
    });
    mockUseListRunsQuery.mockReturnValue({ data: mockRuns, isLoading: false });
    mockUseCreateRunMutation.mockReturnValue([mockCreateRun, { isLoading: false }]);
    mockUseTransitionRunStatusMutation.mockReturnValue([mockTransitionRunStatus, { isLoading: false }]);
    mockCreateRun.mockReturnValue({ unwrap: () => Promise.resolve(createdRun) });
    mockTransitionRunStatus.mockReturnValue({ unwrap: () => Promise.resolve({ run: mockRuns[1] }) });
    mockUseListAdminProfilesQuery.mockReturnValue({ data: mockProfiles });
    mockUseGetEventQuery.mockReturnValue({ data: {} });
  });

  it('loads the selected track runs and resolves racer aliases', () => {
    render(<RunsTable />);

    expect(mockUseListRunsQuery).toHaveBeenCalledWith(
      { eventId: 'event-001', leaderboardId: 'leaderboard-001' },
      { skip: false },
    );
    const runsWorkflow = screen.getByTestId('runs-workflow');
    const runsTable = within(runsWorkflow).getByTestId('runs-table');

    expect(within(runsTable).getByText('TurboML')).toBeInTheDocument();
    expect(within(runsTable).getByText('SpeedRacer42')).toBeInTheDocument();
    expect(within(runsTable).getAllByRole('row')[1]).toHaveTextContent('TurboML');
    expect(within(runsWorkflow).getAllByText(i18n.t('timekeeping:runStatus.IN_PROGRESS'))).toHaveLength(2);
    expect(screen.getByTestId('discard-run-button')).toBeInTheDocument();
    expect(screen.queryByTestId('submit-run-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('start-new-run-button')).not.toBeInTheDocument();
  });

  it('skips the run query until Event and Track are selected', () => {
    mockUseTimekeepingContext.mockReturnValue({
      selectedEventId: undefined,
      selectedLeaderboardId: undefined,
    });
    mockUseListRunsQuery.mockReturnValue({ data: [], isLoading: false });

    render(<RunsTable />);

    expect(mockUseListRunsQuery).toHaveBeenCalledWith({ eventId: '', leaderboardId: '' }, { skip: true });
    expect(screen.getByTestId('active-run-status')).toHaveTextContent(i18n.t('timekeeping:runs.noRunInProgress'));
  });

  it('creates a new run from a submitted run, then registers the created run', async () => {
    mockUseListRunsQuery.mockReturnValue({
      data: [{ ...mockRuns[0], runStatus: RunStatus.SUBMITTED }],
      isLoading: false,
    });
    render(<RunsTable />);

    const modal = createWrapper().findModal();
    expect(modal?.isVisible()).toBe(false);

    fireEvent.click(screen.getByTestId('start-new-run-button'));
    expect(modal?.isVisible()).toBe(true);
    expect(screen.getByTestId('run-setup-racer-select')).toBeInTheDocument();

    const proxyToggle = createWrapper().findToggle('[data-testid="run-setup-raced-by-proxy-toggle"]');
    const proxyToggleInput = proxyToggle?.findNativeInput().getElement();
    if (!proxyToggleInput) throw new Error('Expected race-by-proxy toggle input');
    fireEvent.click(proxyToggleInput);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:runSetup.next') }));

    await waitFor(() => {
      expect(mockCreateRun).toHaveBeenCalledWith({
        eventId: 'event-001',
        leaderboardId: 'leaderboard-001',
        profileId: 'profile-001',
        racedByProxy: true,
      });
    });
    expect(mockRegisterCreatedRun).toHaveBeenCalledWith(createdRun, {
      selectedRacer: { label: 'SpeedRacer42', value: 'profile-001' },
      racedByProxy: true,
    });
    expect(modal?.isVisible()).toBe(false);
  });

  it('updates completed races for the selected racer and blocks racers at the event cap', () => {
    mockUseListRunsQuery.mockReturnValue({
      data: [
        { ...mockRuns[0], runId: 'run-submitted-1' },
        { ...mockRuns[0], runId: 'run-submitted-2' },
      ],
      isLoading: false,
    });
    mockUseGetEventQuery.mockReturnValue({ data: { maxRunsPerRacer: 2 } });
    render(<RunsTable />);

    fireEvent.click(screen.getByTestId('start-new-run-button'));

    expect(screen.getByTestId('run-setup-completed-races')).toHaveTextContent('2');
    expect(
      screen.getByText(i18n.t('timekeeping:runSetup.maxRacesReached', { racer: 'SpeedRacer42', maxRaces: 2 })),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('timekeeping:runSetup.next') })).toBeDisabled();

    const racerSelect = createWrapper().findSelect('[data-testid="run-setup-racer-select"]');
    racerSelect?.openDropdown();
    racerSelect?.selectOptionByValue('profile-002');

    expect(screen.getByTestId('run-setup-completed-races')).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: i18n.t('timekeeping:runSetup.next') })).toBeEnabled();
  });

  it('keeps the setup modal open and shows an error when new-run creation fails', async () => {
    mockUseListRunsQuery.mockReturnValue({
      data: [{ ...mockRuns[0], runStatus: RunStatus.SUBMITTED }],
      isLoading: false,
    });
    mockCreateRun.mockReturnValueOnce({ unwrap: () => Promise.reject(new Error('Create failed')) });
    render(<RunsTable />);

    const modal = createWrapper().findModal();
    fireEvent.click(screen.getByTestId('start-new-run-button'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:runSetup.next') }));

    expect(await screen.findByText(i18n.t('timekeeping:errors.startRun'))).toBeInTheDocument();
    expect(mockRegisterCreatedRun).not.toHaveBeenCalled();
    expect(modal?.isVisible()).toBe(true);
  });

  it('disables Start new Run while a run is being created', () => {
    mockUseListRunsQuery.mockReturnValue({
      data: [{ ...mockRuns[0], runStatus: RunStatus.SUBMITTED }],
      isLoading: false,
    });
    mockUseCreateRunMutation.mockReturnValue([mockCreateRun, { isLoading: true }]);
    render(<RunsTable />);

    expect(screen.getByTestId('start-new-run-button')).toBeDisabled();
  });

  it('discards a ready run through TransitionRunStatus', async () => {
    const readyRun = { ...mockRuns[1], runStatus: RunStatus.READY };
    mockUseListRunsQuery.mockReturnValue({ data: [readyRun], isLoading: false });
    mockTransitionRunStatus.mockReturnValue({ unwrap: () => Promise.resolve({ run: readyRun }) });
    render(<RunsTable />);

    fireEvent.click(screen.getByTestId('discard-run-button'));

    await waitFor(() => {
      expect(mockTransitionRunStatus).toHaveBeenCalledWith({
        eventId: 'event-001',
        leaderboardId: 'leaderboard-001',
        runId: 'run-active',
        action: RunTransitionAction.DISCARD,
      });
    });
  });

  it.each([RunStatus.IN_PROGRESS, RunStatus.PAUSED])('finishes then discards a %s run', async (runStatus) => {
    const activeRun = { ...mockRuns[1], runStatus };
    const finishedRun = { ...activeRun, runStatus: RunStatus.FINISHED };
    mockUseListRunsQuery.mockReturnValue({ data: [activeRun], isLoading: false });
    mockTransitionRunStatus
      .mockReturnValueOnce({ unwrap: () => Promise.resolve({ run: finishedRun }) })
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({ run: { ...finishedRun, runStatus: RunStatus.DISCARDED } }),
      });
    render(<RunsTable />);

    fireEvent.click(screen.getByTestId('discard-run-button'));

    await waitFor(() => {
      expect(mockTransitionRunStatus).toHaveBeenNthCalledWith(1, {
        eventId: 'event-001',
        leaderboardId: 'leaderboard-001',
        runId: 'run-active',
        action: RunTransitionAction.FINISH,
      });
    });
    expect(mockTransitionRunStatus).toHaveBeenNthCalledWith(2, {
      eventId: 'event-001',
      leaderboardId: 'leaderboard-001',
      runId: 'run-active',
      action: RunTransitionAction.DISCARD,
    });
    expect(mockRegisterActiveRun).toHaveBeenCalledWith(undefined);
  });

  it('resumes, submits, or discards a finished run through TransitionRunStatus', async () => {
    const finishedRun = { ...mockRuns[1], runStatus: RunStatus.FINISHED };
    mockUseListRunsQuery.mockReturnValue({ data: [finishedRun], isLoading: false });
    mockTransitionRunStatus.mockReturnValue({ unwrap: () => Promise.resolve({ run: finishedRun }) });
    render(<RunsTable />);

    fireEvent.click(screen.getByTestId('resume-run-button'));
    await waitFor(() => {
      expect(mockTransitionRunStatus).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: RunTransitionAction.RESUME_FROM_FINISHED }),
      );
    });

    fireEvent.click(screen.getByTestId('submit-run-button'));
    await waitFor(() => {
      expect(mockTransitionRunStatus).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: RunTransitionAction.SUBMIT }),
      );
    });

    fireEvent.click(screen.getByTestId('discard-run-button'));
    await waitFor(() => {
      expect(mockTransitionRunStatus).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: RunTransitionAction.DISCARD }),
      );
    });
  });

  it('orders the Resume, Discard, and Submit buttons for a finished run', () => {
    const finishedRun = { ...mockRuns[1], runStatus: RunStatus.FINISHED };
    mockUseListRunsQuery.mockReturnValue({ data: [finishedRun], isLoading: false });
    render(<RunsTable />);

    const buttons = screen.getAllByRole('button', {
      name: new RegExp(
        `^(${i18n.t('timekeeping:actions.RESUME_FROM_FINISHED')}|${i18n.t('timekeeping:actions.discardRun')}|${i18n.t('timekeeping:actions.submitRun')})$`,
      ),
    });

    expect(buttons.map((button) => button.textContent)).toEqual([
      i18n.t('timekeeping:actions.RESUME_FROM_FINISHED'),
      i18n.t('timekeeping:actions.discardRun'),
      i18n.t('timekeeping:actions.submitRun'),
    ]);
  });

  it('defaults to 10 rows per page and navigates to the second page', async () => {
    const user = userEvent.setup();
    const paginatedProfiles = Array.from({ length: 12 }, (_, index) => ({
      profileId: `profile-${index + 1}`,
      alias: `Racer ${index + 1}`,
    }));
    const paginatedRuns = paginatedProfiles.map((profile, index) => ({
      ...mockRuns[0],
      runId: `run-${index + 1}`,
      profileId: profile.profileId,
      createdAt: new Date(`2026-01-${String(index + 1).padStart(2, '0')}T10:00:00Z`),
      updatedAt: new Date(`2026-01-${String(index + 1).padStart(2, '0')}T10:00:00Z`),
    }));
    mockUseListRunsQuery.mockReturnValue({ data: paginatedRuns, isLoading: false });
    mockUseListAdminProfilesQuery.mockReturnValue({ data: paginatedProfiles });

    render(<RunsTable />);

    const expandableSection = createWrapper().findExpandableSection('[data-testid="runs-workflow"]');
    if (!expandableSection) throw new Error('Runs expandable section not found');
    await user.click(expandableSection.findExpandButton().getElement());

    expect(await screen.findByText('Racer 12')).toBeInTheDocument();
    expect(screen.getByText('Racer 3')).toBeInTheDocument();
    expect(screen.queryByText('Racer 2')).not.toBeInTheDocument();

    const table = createWrapper().findTable('[data-testid="runs-table"]');
    const pagination = table?.findPagination();
    if (!pagination) throw new Error('Runs pagination not found');
    const secondPageButton = pagination.findPageNumberByIndex(2);
    if (!secondPageButton) throw new Error('Runs page two control not found');

    await user.click(secondPageButton.getElement());

    expect(await screen.findByText('Racer 2')).toBeInTheDocument();
    expect(screen.queryByText('Racer 12')).not.toBeInTheDocument();
  });

  it('offers page sizes of 5, 10, 15, 25, 50, and 100', async () => {
    const user = userEvent.setup();
    render(<RunsTable />);

    const table = createWrapper().findTable('[data-testid="runs-table"]');
    const preferences = table?.findCollectionPreferences();
    if (!preferences) throw new Error('Runs preferences not found');
    const triggerButton = preferences.findTriggerButton();
    if (!triggerButton) throw new Error('Runs preferences trigger not found');

    await user.click(triggerButton.getElement());

    [5, 10, 15, 25, 50, 100].forEach((count) => {
      expect(
        screen.getByText(i18n.t('timekeeping:runs.preferences.pageSizeOptionsLabel', { count })),
      ).toBeInTheDocument();
    });
  });

  it.each([
    [RunStatus.READY, 'pending', 'runStatus.READY'],
    [RunStatus.IN_PROGRESS, 'in-progress', 'runStatus.IN_PROGRESS'],
    [RunStatus.PAUSED, 'stopped', 'runStatus.PAUSED'],
    [RunStatus.FINISHED, 'success', 'runStatus.FINISHED'],
  ] as const)('maps %s to the requested active-run header indicator', (runStatus, type, textKey) => {
    mockUseListRunsQuery.mockReturnValue({ data: [{ ...mockRuns[1], runStatus }], isLoading: false });

    render(<RunsTable />);

    expect(ACTIVE_RUN_STATUS_INDICATOR[runStatus]).toEqual({ textKey, type });
    expect(screen.getByTestId('active-run-status')).toHaveTextContent(i18n.t(`timekeeping:${textKey}`));
  });

  it('registers the active run with the persisted session', async () => {
    render(<RunsTable />);

    await waitFor(() => {
      expect(mockRegisterActiveRun).toHaveBeenLastCalledWith(
        expect.objectContaining(mockRuns[1]),
        expect.objectContaining({ racedByProxy: false }),
      );
    });
  });

  it('shows no-run-in-progress header info for submitted and discarded runs', () => {
    mockUseListRunsQuery.mockReturnValue({
      data: [{ ...mockRuns[0], runStatus: RunStatus.SUBMITTED }],
      isLoading: false,
    });

    const { rerender } = render(<RunsTable />);

    expect(ACTIVE_RUN_STATUS_INDICATOR[RunStatus.SUBMITTED]).toBeUndefined();
    expect(screen.getByTestId('active-run-status')).toHaveTextContent(i18n.t('timekeeping:runs.noRunInProgress'));

    mockUseListRunsQuery.mockReturnValue({
      data: [{ ...mockRuns[0], runStatus: RunStatus.DISCARDED }],
      isLoading: false,
    });
    rerender(<RunsTable />);

    expect(ACTIVE_RUN_STATUS_INDICATOR[RunStatus.DISCARDED]).toBeUndefined();
    expect(screen.getByTestId('active-run-status')).toHaveTextContent(i18n.t('timekeeping:runs.noRunInProgress'));
  });
});
