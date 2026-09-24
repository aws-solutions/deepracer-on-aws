// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { LeaderboardRankingEntry, OverlayUpdateEvent } from '#pages/PhysicalRace/types/events';

import { ActiveRaceStatsPanel } from '../ActiveRaceStatsPanel';

const CURRENT_RACE: OverlayUpdateEvent = {
  eventType: 'OVERLAY_UPDATE',
  racerName: 'Alice Chen',
  timeLeftMilliseconds: 60_000,
  currentLapTimeMilliseconds: 12_345,
  raceStatus: 'RACE_IN_PROGRESS',
  laps: [
    { lapNumber: 1, lapTimeMilliseconds: 48_000, isValid: true },
    { lapNumber: 2, lapTimeMilliseconds: 47_000, isValid: false },
  ],
} as unknown as OverlayUpdateEvent;

const RANKINGS: LeaderboardRankingEntry[] = [
  { rank: 1, participantName: 'Bob Santos', bestLapTimeMilliseconds: 46_000, modelName: 'FastBot', country: 'US' },
  { rank: 2, participantName: 'Alice Chen', bestLapTimeMilliseconds: 47_000, modelName: 'SpeedBot', country: 'CA' },
];

describe('<ActiveRaceStatsPanel />', () => {
  it("renders the racer's name as the panel header", () => {
    render(
      <ActiveRaceStatsPanel
        currentRace={CURRENT_RACE}
        fastestLapMs={47_000}
        displayRankings={RANKINGS}
        leader={null}
      />,
    );
    expect(screen.getByText('Alice Chen')).toBeInTheDocument();
    expect(screen.getByText('Race in progress')).toBeInTheDocument();
  });

  it('shows the formatted countdown for time remaining, flagging under 30 seconds', () => {
    const almostOut = { ...CURRENT_RACE, timeLeftMilliseconds: 15_000 };
    render(
      <ActiveRaceStatsPanel currentRace={almostOut} fastestLapMs={47_000} displayRankings={RANKINGS} leader={null} />,
    );
    expect(screen.getByText('0:15')).toBeInTheDocument();
    expect(screen.getByText('⚠ Under 30 seconds')).toBeInTheDocument();
  });

  it('does not flag time remaining when 30 seconds or more remain', () => {
    render(
      <ActiveRaceStatsPanel
        currentRace={CURRENT_RACE}
        fastestLapMs={47_000}
        displayRankings={RANKINGS}
        leader={null}
      />,
    );
    expect(screen.queryByText('⚠ Under 30 seconds')).not.toBeInTheDocument();
  });

  it('shows the lap count and how many of those laps are valid', () => {
    render(
      <ActiveRaceStatsPanel
        currentRace={CURRENT_RACE}
        fastestLapMs={47_000}
        displayRankings={RANKINGS}
        leader={null}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1 valid')).toBeInTheDocument();
  });

  it("shows the racer's fastest lap, and marks it Event best when it beats the confirmed leader", () => {
    const slowerLeader = { ...RANKINGS[0], bestLapTimeMilliseconds: 50_000 };
    render(
      <ActiveRaceStatsPanel
        currentRace={CURRENT_RACE}
        fastestLapMs={47_000}
        displayRankings={RANKINGS}
        leader={slowerLeader}
      />,
    );
    expect(screen.getAllByText('47.000s').length).toBeGreaterThan(0);
    expect(screen.getByText('🟣 Event best')).toBeInTheDocument();
  });

  it('does not show Event best when the fastest lap has not beaten the confirmed leader', () => {
    const slowerLeader = { ...RANKINGS[0], bestLapTimeMilliseconds: 40_000 };
    render(
      <ActiveRaceStatsPanel
        currentRace={CURRENT_RACE}
        fastestLapMs={47_000}
        displayRankings={RANKINGS}
        leader={slowerLeader}
      />,
    );
    expect(screen.queryByText('🟣 Event best')).not.toBeInTheDocument();
  });

  it('shows — for fastest lap when no valid lap has been recorded yet', () => {
    render(
      <ActiveRaceStatsPanel currentRace={CURRENT_RACE} fastestLapMs={null} displayRankings={RANKINGS} leader={null} />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows the formatted current lap time', () => {
    render(
      <ActiveRaceStatsPanel
        currentRace={CURRENT_RACE}
        fastestLapMs={47_000}
        displayRankings={RANKINGS}
        leader={null}
      />,
    );
    expect(screen.getByText('12.345s')).toBeInTheDocument();
  });

  it("shows the racer's confirmed leaderboard position and total entrant count", () => {
    render(
      <ActiveRaceStatsPanel
        currentRace={CURRENT_RACE}
        fastestLapMs={30_000}
        displayRankings={RANKINGS}
        leader={null}
      />,
    );
    // Alice's confirmed rank (from RANKINGS) is #2, independent of the fastestLapMs passed in —
    // confirmed position never changes based on the current live lap, only the projection does.
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('of 2')).toBeInTheDocument();
  });

  it('shows — for current position when the racer has no confirmed ranking yet', () => {
    const unrankedRacer = { ...CURRENT_RACE, racerName: 'Someone Else' };
    render(
      <ActiveRaceStatsPanel
        currentRace={unrankedRacer}
        fastestLapMs={47_000}
        displayRankings={RANKINGS}
        leader={null}
      />,
    );
    expect(screen.getAllByText('—')).not.toHaveLength(0);
  });

  it("projects the racer's position from their fastest lap against the confirmed leaderboard", () => {
    // Alice's 47_000ms fastest lap beats only Bob (46_000) is faster, so Alice would be #2.
    render(
      <ActiveRaceStatsPanel
        currentRace={CURRENT_RACE}
        fastestLapMs={47_000}
        displayRankings={RANKINGS}
        leader={null}
      />,
    );
    expect(screen.getByText('if race ended now')).toBeInTheDocument();
  });

  it('shows — for projected position when there is no fastest lap yet', () => {
    render(
      <ActiveRaceStatsPanel currentRace={CURRENT_RACE} fastestLapMs={null} displayRankings={RANKINGS} leader={null} />,
    );
    expect(screen.queryByText('if race ended now')).not.toBeInTheDocument();
  });

  it('shows — for projected position when there are no confirmed entrants at all', () => {
    render(
      <ActiveRaceStatsPanel currentRace={CURRENT_RACE} fastestLapMs={47_000} displayRankings={[]} leader={null} />,
    );
    expect(screen.queryByText('of 2')).not.toBeInTheDocument();
  });
});
