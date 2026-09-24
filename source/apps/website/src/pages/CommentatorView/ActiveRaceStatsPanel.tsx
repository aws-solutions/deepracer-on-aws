// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import StatusIndicator from '@cloudscape-design/components/status-indicator';

import type { LeaderboardRankingEntry, OverlayUpdateEvent } from '#pages/PhysicalRace/types/events';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatLapTime = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const m = ms % 1000;
  return `${s}.${m.toString().padStart(3, '0')}s`;
};

const formatCountdown = (ms: number): string => {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/** Where the racer currently ranks on the confirmed leaderboard, or '—' if not found. */
const currentPosition = (displayRankings: LeaderboardRankingEntry[], racerName: string | undefined): string => {
  const pos = displayRankings.findIndex((r) => r.participantName === racerName);
  return pos >= 0 ? `#${pos + 1}` : '—';
};

/**
 * Where the racer would rank if the race ended now, based on their current fastest lap vs the
 * confirmed leaderboard. '—' if there's no fastest lap yet or no confirmed entrants to compare.
 */
const projectedPosition = (
  displayRankings: LeaderboardRankingEntry[],
  racerName: string | undefined,
  fastestLapMs: number | null,
): string => {
  if (fastestLapMs === null || displayRankings.length === 0) return '—';
  // Count how many confirmed entrants (excluding this racer) have a faster best lap.
  const fasterCount = displayRankings.filter(
    (r) => r.participantName !== racerName && r.bestLapTimeMilliseconds < fastestLapMs,
  ).length;
  return `#${fasterCount + 1}`;
};

// ── KPI card (read-only stat for commentator) ─────────────────────────────────

const Stat = ({ label, value, description }: { label: string; value: string | number; description?: string }) => (
  <div>
    <Box variant="awsui-key-label">{label}</Box>
    <Box variant="awsui-value-large">{value}</Box>
    {description && (
      <Box color="text-body-secondary" fontSize="body-s">
        {description}
      </Box>
    )}
  </div>
);

interface ActiveRaceStatsPanelProps {
  currentRace: OverlayUpdateEvent;
  fastestLapMs: number | null;
  displayRankings: LeaderboardRankingEntry[];
  leader: LeaderboardRankingEntry | null;
}

/**
 * Live KPI grid shown for the duration of an active race — time remaining, laps, fastest lap,
 * current lap, and this racer's confirmed/projected leaderboard position. Extracted out of
 * CommentatorView so its own set of display-formatting branches (SonarQube S3776) don't count
 * against that component's cognitive complexity.
 */
export const ActiveRaceStatsPanel = ({
  currentRace,
  fastestLapMs,
  displayRankings,
  leader,
}: ActiveRaceStatsPanelProps) => {
  const fastestLapDescription =
    fastestLapMs !== null && leader !== null && fastestLapMs <= leader.bestLapTimeMilliseconds
      ? '🟣 Event best'
      : undefined;
  const timeRemainingDescription = currentRace.timeLeftMilliseconds < 30_000 ? '⚠ Under 30 seconds' : undefined;
  const fastestLapValue = fastestLapMs === null ? '—' : formatLapTime(fastestLapMs);
  const currentPositionValue = currentPosition(displayRankings, currentRace.racerName);
  const currentPositionDescription = displayRankings.length > 0 ? `of ${displayRankings.length}` : undefined;
  const projectedPositionValue = projectedPosition(displayRankings, currentRace.racerName, fastestLapMs);
  const projectedPositionDescription = fastestLapMs === null ? undefined : 'if race ended now';

  return (
    <Container
      header={
        <Header variant="h2" actions={<StatusIndicator type="success">Race in progress</StatusIndicator>}>
          {currentRace.racerName}
        </Header>
      }
    >
      <ColumnLayout columns={6} variant="text-grid">
        <Stat
          label="Time remaining"
          value={formatCountdown(currentRace.timeLeftMilliseconds)}
          description={timeRemainingDescription}
        />
        <Stat
          label="Laps completed"
          value={currentRace.laps.length}
          description={`${currentRace.laps.filter((l) => l.isValid).length} valid`}
        />
        <Stat label="Fastest lap" value={fastestLapValue} description={fastestLapDescription} />
        <Stat label="Current lap" value={formatLapTime(currentRace.currentLapTimeMilliseconds)} />
        <Stat label="Current position" value={currentPositionValue} description={currentPositionDescription} />
        <Stat label="Projected position" value={projectedPositionValue} description={projectedPositionDescription} />
      </ColumnLayout>
    </Container>
  );
};
