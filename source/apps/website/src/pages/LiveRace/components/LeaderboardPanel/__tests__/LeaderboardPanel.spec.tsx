// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';

import { render, screen } from '#utils/testUtils';

import LeaderboardPanel, { RankingEntry } from '../LeaderboardPanel';

const mockRankings: RankingEntry[] = [
  {
    rank: 1,
    participantName: 'Alice',
    modelName: 'SpeedDemon-v3',
    bestLapTime: 12450,
    submissionId: 'sub-001',
    avatar: {},
  },
  {
    rank: 2,
    participantName: 'Bob',
    modelName: 'TurboBot',
    bestLapTime: 15200,
    submissionId: 'sub-002',
    avatar: {},
  },
];

describe('<LeaderboardPanel />', () => {
  it('renders rankings table with correct data', () => {
    render(<LeaderboardPanel rankings={mockRankings} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('00:12.450')).toBeInTheDocument();
    expect(screen.getByText('00:15.200')).toBeInTheDocument();
  });

  it('displays rank numbers', () => {
    render(<LeaderboardPanel rankings={mockRankings} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows counter in header', () => {
    render(<LeaderboardPanel rankings={mockRankings} />);

    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('shows empty state when no rankings', () => {
    render(<LeaderboardPanel rankings={[]} />);

    expect(screen.getByText('(0)')).toBeInTheDocument();
  });

  it('updates when rankings change', () => {
    const { rerender } = render(<LeaderboardPanel rankings={mockRankings} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();

    const updatedRankings: RankingEntry[] = [
      { ...mockRankings[1], rank: 1, bestLapTime: 11000 },
      { ...mockRankings[0], rank: 2 },
    ];

    rerender(<LeaderboardPanel rankings={updatedRankings} />);

    // Bob should now be first with updated time
    expect(screen.getByText('00:11.000')).toBeInTheDocument();
  });
});
