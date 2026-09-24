// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { render, screen, waitFor } from '#utils/testUtils';

import CombinedLeaderboardPanel from './CombinedLeaderboardPanel';

const mockGetCombinedLeaderboardQuery = vi.fn();

vi.mock('#services/deepRacer/eventsApi.js', () => ({
  useGetCombinedLeaderboardQuery: (...args: unknown[]) => mockGetCombinedLeaderboardQuery(...args),
}));

describe('<CombinedLeaderboardPanel />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when not active', () => {
    mockGetCombinedLeaderboardQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false });

    const { container } = render(<CombinedLeaderboardPanel eventId="evt-001" isActive={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('skips the query when not active', () => {
    mockGetCombinedLeaderboardQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false });

    render(<CombinedLeaderboardPanel eventId="evt-001" isActive={false} />);

    expect(mockGetCombinedLeaderboardQuery).toHaveBeenCalledWith({ eventId: 'evt-001' }, { skip: true });
  });

  it('renders a distinct error state when the query fails', async () => {
    mockGetCombinedLeaderboardQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    render(<CombinedLeaderboardPanel eventId="evt-001" isActive />);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('events:detail.tracks.combinedLeaderboard.errorTitle'))).toBeInTheDocument();
    });
  });

  it('renders the empty state when there are no rankings', async () => {
    mockGetCombinedLeaderboardQuery.mockReturnValue({
      data: { combinedScoringStrategy: 'BEST_RESULT_PER_RACER', rankings: [] },
      isLoading: false,
      isError: false,
    });

    render(<CombinedLeaderboardPanel eventId="evt-001" isActive />);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('events:detail.tracks.combinedLeaderboard.emptyTitle'))).toBeInTheDocument();
    });
  });

  it('renders ranking rows when rankings are available', async () => {
    mockGetCombinedLeaderboardQuery.mockReturnValue({
      data: {
        combinedScoringStrategy: 'BEST_RESULT_PER_RACER',
        rankings: [
          {
            rank: 1,
            rankingScore: 9120,
            userProfile: { alias: 'SpeedRacer42' },
            submissionNumber: 1,
            submittedAt: new Date('2026-01-01'),
            videoUrl: '',
            stats: {
              avgLapTime: 9500,
              avgResets: 0,
              bestLapTime: 9120,
              collisionCount: 0,
              completedLapCount: 3,
              offTrackCount: 0,
              resetCount: 0,
              totalLapTime: 28500,
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
    });

    render(<CombinedLeaderboardPanel eventId="evt-001" isActive />);

    await waitFor(() => {
      expect(screen.getByText('SpeedRacer42')).toBeInTheDocument();
    });
  });
});
