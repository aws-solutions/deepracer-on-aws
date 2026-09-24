// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';
import { render, screen, waitFor } from '#utils/testUtils';

import EventStatistics from './EventStatistics';

const mockGetEventStatisticsQuery = vi.fn();

vi.mock('#services/deepRacer/eventsApi.js', () => ({
  useGetEventStatisticsQuery: (...args: unknown[]) => mockGetEventStatisticsQuery(...args),
}));

describe('<EventStatistics />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when not active', () => {
    mockGetEventStatisticsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { container } = render(<EventStatistics eventId="evt-001" isActive={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('skips the query when not active', () => {
    mockGetEventStatisticsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<EventStatistics eventId="evt-001" isActive={false} />);

    expect(mockGetEventStatisticsQuery).toHaveBeenCalledWith({ eventId: 'evt-001' }, { skip: true });
  });

  it('renders a spinner while loading, without the statistics header', () => {
    mockGetEventStatisticsQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });

    render(<EventStatistics eventId="evt-001" isActive />);

    expect(screen.queryByText(i18n.t('events:detail.statistics.header'))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('events:detail.statistics.emptyTitle'))).not.toBeInTheDocument();
  });

  it('renders a distinct error state (not the empty state) when the query fails', async () => {
    mockGetEventStatisticsQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });

    render(<EventStatistics eventId="evt-001" isActive />);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('events:detail.statistics.errorTitle'))).toBeInTheDocument();
    });

    expect(screen.queryByText(i18n.t('events:detail.statistics.emptyTitle'))).not.toBeInTheDocument();
  });

  it('retries the query when the retry button is clicked on the error state', async () => {
    const mockRefetch = vi.fn();
    mockGetEventStatisticsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    render(<EventStatistics eventId="evt-001" isActive />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: i18n.t('events:detail.statistics.retryButton') })).toBeInTheDocument();
    });

    screen.getByRole('button', { name: i18n.t('events:detail.statistics.retryButton') }).click();

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('renders the empty state when there are no runs', async () => {
    mockGetEventStatisticsQuery.mockReturnValue({
      data: {
        totalRuns: 0,
        completedRuns: 0,
        discardedRuns: 0,
        totalValidLaps: 0,
        averageLapsPerRun: 0,
        uniqueRacerCount: 0,
        completionRate: 0,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<EventStatistics eventId="evt-001" isActive />);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('events:detail.statistics.emptyTitle'))).toBeInTheDocument();
    });
  });

  it('renders metric cards when statistics are available', async () => {
    mockGetEventStatisticsQuery.mockReturnValue({
      data: {
        totalRuns: 10,
        completedRuns: 8,
        discardedRuns: 1,
        totalValidLaps: 40,
        averageLapsPerRun: 4,
        fastestLapMs: 9123,
        averageLapTimeMs: 10456,
        uniqueRacerCount: 5,
        completionRate: 0.8,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<EventStatistics eventId="evt-001" isActive />);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('events:detail.statistics.header'))).toBeInTheDocument();
    });

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('4.0')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText(millisToMinutesAndSeconds(9123))).toBeInTheDocument();
    expect(screen.getByText(millisToMinutesAndSeconds(10456))).toBeInTheDocument();
  });

  it('renders placeholder lap time when no valid laps exist', async () => {
    mockGetEventStatisticsQuery.mockReturnValue({
      data: {
        totalRuns: 2,
        completedRuns: 1,
        discardedRuns: 0,
        totalValidLaps: 0,
        averageLapsPerRun: 0,
        uniqueRacerCount: 2,
        completionRate: 0.5,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<EventStatistics eventId="evt-001" isActive />);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('events:detail.statistics.header'))).toBeInTheDocument();
    });

    expect(screen.getAllByText('--')).toHaveLength(2);
  });
});
