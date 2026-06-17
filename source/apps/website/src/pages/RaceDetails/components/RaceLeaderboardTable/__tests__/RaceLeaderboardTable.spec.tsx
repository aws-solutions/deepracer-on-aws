// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { Leaderboard, Ranking, TimingMethod } from '@deepracer-indy/typescript-client';
import { describe, it, expect } from 'vitest';

import { render } from '#utils/testUtils';

import RaceLeaderboardTable from '../RaceLeaderboardTable';

const mockLeaderboard = {
  leaderboardId: 'lb-1',
  name: 'Test Race',
  openTime: new Date(Date.now() - 86400000),
  closeTime: new Date(Date.now() + 86400000),
  timingMethod: TimingMethod.BEST_LAP_TIME,
} as Leaderboard;

const mockRankings: Ranking[] = [
  {
    rank: 1,
    submittedAt: new Date(),
    submissionNumber: 1,
    rankingScore: 12000,
    videoUrl: '',
    stats: {
      avgLapTime: 12000,
      avgResets: 0,
      bestLapTime: 12000,
      collisionCount: 0,
      completedLapCount: 3,
      offTrackCount: 5,
      resetCount: 0,
      totalLapTime: 36000,
      bestLapOffTrackCount: 0,
      avgLapOffTrackCount: 2,
    },
    userProfile: { alias: 'Alice', avatar: {} },
  },
  {
    rank: 2,
    submittedAt: new Date(),
    submissionNumber: 2,
    rankingScore: 15000,
    videoUrl: '',
    stats: {
      avgLapTime: 15000,
      avgResets: 0,
      bestLapTime: 15000,
      collisionCount: 0,
      completedLapCount: 3,
      offTrackCount: 3,
      resetCount: 0,
      totalLapTime: 45000,
      bestLapOffTrackCount: 1,
      avgLapOffTrackCount: 2,
    },
    userProfile: { alias: 'Bob', avatar: {} },
  },
];

describe('<RaceLeaderboardTable />', () => {
  it('renders table with rankings', () => {
    const { container } = render(<RaceLeaderboardTable rankings={mockRankings} leaderboard={mockLeaderboard} />);
    const table = createWrapper(container).findTable();
    expect(table?.findRows()).toHaveLength(2);
  });

  it('shows filter count text when filtering', () => {
    const { container } = render(<RaceLeaderboardTable rankings={mockRankings} leaderboard={mockLeaderboard} />);

    const filter = createWrapper(container).findTextFilter();
    filter?.findInput().setInputValue('Alice');

    expect(filter?.findResultsCount()?.getElement().textContent).toContain('1');
  });

  it('shows bestLapOffTrackCount when timing method is BEST_LAP_TIME', () => {
    const { container } = render(
      <RaceLeaderboardTable
        rankings={mockRankings}
        leaderboard={{ ...mockLeaderboard, timingMethod: TimingMethod.BEST_LAP_TIME }}
      />,
    );
    const table = createWrapper(container).findTable();
    const firstRowCells = table?.findBodyCell(1, 5);
    expect(firstRowCells?.getElement().textContent).toBe('0');
  });

  it('shows avgLapOffTrackCount when timing method is AVG_LAP_TIME', () => {
    const { container } = render(
      <RaceLeaderboardTable
        rankings={mockRankings}
        leaderboard={{ ...mockLeaderboard, timingMethod: TimingMethod.AVG_LAP_TIME }}
      />,
    );
    const table = createWrapper(container).findTable();
    const firstRowCells = table?.findBodyCell(1, 5);
    expect(firstRowCells?.getElement().textContent).toBe('2');
  });

  it('shows total offTrackCount when timing method is TOTAL_TIME', () => {
    const { container } = render(
      <RaceLeaderboardTable
        rankings={mockRankings}
        leaderboard={{ ...mockLeaderboard, timingMethod: TimingMethod.TOTAL_TIME }}
      />,
    );
    const table = createWrapper(container).findTable();
    const firstRowCells = table?.findBodyCell(1, 5);
    expect(firstRowCells?.getElement().textContent).toBe('5');
  });

  it('falls back to total offTrackCount when bestLapOffTrackCount is undefined', () => {
    const rankingsWithoutNewFields = mockRankings.map((r) => ({
      ...r,
      stats: { ...r.stats, bestLapOffTrackCount: undefined, avgLapOffTrackCount: undefined },
    })) as Ranking[];
    const { container } = render(
      <RaceLeaderboardTable
        rankings={rankingsWithoutNewFields}
        leaderboard={{ ...mockLeaderboard, timingMethod: TimingMethod.BEST_LAP_TIME }}
      />,
    );
    const table = createWrapper(container).findTable();
    const firstRowCells = table?.findBodyCell(1, 5);
    expect(firstRowCells?.getElement().textContent).toBe('5');
  });
});
