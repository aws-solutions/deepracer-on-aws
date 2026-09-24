// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen, waitFor, within } from '#utils/testUtils';

import { Timekeeping } from '../Timekeeping';

const mockCreateRun = vi.fn(() => ({
  unwrap: () => Promise.resolve({ runId: 'run-created' }),
}));
const mockTransitionRunStatus = vi.fn();

vi.mock('#services/deepRacer/runsApi.js', () => ({
  useListRunsQuery: () => ({ data: [], isLoading: false }),
  useGetRunQuery: () => ({ data: undefined, isFetching: false }),
  useCreateRunMutation: () => [mockCreateRun, { isLoading: false }],
  useTransitionRunStatusMutation: () => [mockTransitionRunStatus, { isLoading: false }],
}));

vi.mock('#services/deepRacer/adminApi.js', () => ({
  useListAdminProfilesQuery: () => ({ data: [{ profileId: 'profile-001', alias: 'rclove' }], isLoading: false }),
}));

describe('<TimekeepingNew />', () => {
  it('retains the marked component containers', () => {
    const markedComponents = [
      { dataId: 'RunsTable', testId: 'runs-workflow' },
      { dataId: 'RaceControls', testId: 'race-controls' },
      { dataId: 'EventAndTrackInfo', testId: 'event-and-track-info' },
      { dataId: 'RecordedLaps', testId: 'recorded-laps' },
    ];

    render(<Timekeeping />);

    markedComponents.forEach(({ dataId, testId }) => {
      expect(screen.getByTestId(testId)).toHaveAttribute('data-id', dataId);
    });
  });

  it('renders the runs workflow scaffold expanded', () => {
    render(<Timekeeping />);

    const runsWorkflow = screen.getByTestId('runs-workflow');
    expect(within(runsWorkflow).getByRole('heading', { level: 2 })).toHaveTextContent(
      i18n.t('timekeeping:runs.header'),
    );
    expect(within(runsWorkflow).getByTestId('runs-table')).toBeInTheDocument();
  });

  it('renders the localized timekeeping controls and race summary', () => {
    render(<Timekeeping />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(i18n.t('timekeeping:header'));
    expect(screen.getByText(i18n.t('timekeeping:racerSelector.header'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('timekeeping:carSelector.placeholder') })).toBeDisabled();
    expect(screen.getByText(i18n.t('timekeeping:manualTiming.countdownLabel'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('timekeeping:manualTiming.lapElapsedLabel'))).toBeInTheDocument();
    const eventAndTrackInfo = within(screen.getByTestId('event-and-track-info'));
    expect(eventAndTrackInfo.getByTestId('race-format-info')).toHaveTextContent(
      i18n.t('timekeeping:contextSelection.raceFormatLabel'),
    );
    expect(eventAndTrackInfo.getByTestId('automatic-timer-info')).toHaveTextContent(
      `${i18n.t('timekeeping:contextSelection.automaticTimerLabel')} ${i18n.t('timekeeping:contextSelection.timerNotConnected')}`,
    );
  });

  it('renders the localized static controls as disabled', () => {
    render(<Timekeeping />);

    const disabledControlLabels = [
      i18n.t('timekeeping:manualTiming.recordLap'),
      i18n.t('timekeeping:manualTiming.carReset'),
      i18n.t('timekeeping:actions.FINISH'),
      i18n.t('timekeeping:actions.START'),
    ];
    disabledControlLabels.forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
    });
  });

  it('uses the created run setup to display the racer label', async () => {
    localStorage.setItem(
      'deepracer-timekeeping-selected-event-and-track',
      JSON.stringify({ selectedEventId: 'event-001', selectedLeaderboardId: 'leaderboard-001' }),
    );
    render(<Timekeeping />);

    expect(screen.getByTestId('racer-name')).toHaveTextContent(i18n.t('timekeeping:racerSelector.placeholder'));

    fireEvent.click(screen.getByTestId('start-new-run-button'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:runSetup.next') }));

    await waitFor(() => {
      expect(mockCreateRun).toHaveBeenCalledWith({
        eventId: 'event-001',
        leaderboardId: 'leaderboard-001',
        profileId: 'profile-001',
        racedByProxy: false,
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId('racer-name')).toHaveTextContent('rclove');
    });
  });

  it('places reset actions before the End and run control', () => {
    render(<Timekeeping />);

    const resetInfoAndDecrement = screen.getByTestId('reset-info-and-decrement');
    const decrementButton = within(resetInfoAndDecrement).getByRole('button', { name: '-1' });
    expect(within(resetInfoAndDecrement).getByText(i18n.t('timekeeping:manualTiming.resetsLabel'))).toBeInTheDocument();
    const endButton = screen.getByRole('button', { name: i18n.t('timekeeping:actions.FINISH') });
    const runControl = screen.getByRole('button', { name: i18n.t('timekeeping:actions.START') });

    expect(decrementButton.compareDocumentPosition(endButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(endButton.compareDocumentPosition(runControl)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders localized fastest and recorded lap empty states', () => {
    render(<Timekeeping />);

    const fastestLap = within(screen.getByTestId('fastest-lap-table'));
    const recordedLaps = within(screen.getByTestId('recorded-laps-table'));

    expect(fastestLap.getByRole('heading', { level: 2 })).toHaveTextContent(
      i18n.t('timekeeping:lapTable.fastestHeader'),
    );
    expect(fastestLap.getByText(i18n.t('timekeeping:lapTable.fastestEmptyTitle'))).toBeInTheDocument();
    expect(recordedLaps.getByRole('heading', { level: 2 })).toHaveTextContent(i18n.t('timekeeping:lapTable.header'));
    expect(recordedLaps.getByText(i18n.t('timekeeping:lapTable.emptyTitle'))).toBeInTheDocument();
  });
});
