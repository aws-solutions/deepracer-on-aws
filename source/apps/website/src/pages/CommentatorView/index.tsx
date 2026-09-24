// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import { EventStatus } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';

import { ConnectionStatus, useRaceTopicMqtt } from '#hooks/useRaceTopicMqtt';
import { mapEventStatusToRaceStatus } from '#pages/PhysicalRace/mapEventStatusToRaceStatus';
import type { LeaderboardRankingEntry, OverlayUpdateEvent, PhysicalRaceEvent } from '#pages/PhysicalRace/types/events';
import { useListEventTracksQuery, useListEventsQuery } from '#services/deepRacer/eventsApi';
import { useGetEventLeaderboardQuery } from '#services/deepRacer/raceManagementApi';

import { ActiveRaceStatsPanel } from './ActiveRaceStatsPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatLapTime = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const m = ms % 1000;
  return `${s}.${m.toString().padStart(3, '0')}s`;
};

// Human-readable labels for the live race status. RACE_FINISHED marks a run's laps as complete
// (before submission); RACE_SUBMITTED marks the result as posted to the leaderboard.
const RACE_STATUS_LABELS: Record<string, string> = {
  NO_RACER_SELECTED: 'No racer selected',
  READY_TO_START: 'Ready to start',
  RACE_IN_PROGRESS: 'In progress',
  RACE_PAUSED: 'Paused',
  RACE_FINISHED: 'Lap complete',
  RACE_SUBMITTED: 'Lap submitted',
};

// Fall back to a de-underscored form for any status not in the map.
const formatRaceStatus = (status: string): string => RACE_STATUS_LABELS[status] ?? status.replaceAll('_', ' ');

// ── Connection badge ──────────────────────────────────────────────────────────

const ConnectionBadge = ({ status }: { status: ConnectionStatus }) => {
  if (status === ConnectionStatus.CONNECTED) return <StatusIndicator type="success">Connected</StatusIndicator>;
  if (status === ConnectionStatus.ERROR) return <StatusIndicator type="error">Connection error</StatusIndicator>;
  return <StatusIndicator type="loading">Connecting</StatusIndicator>;
};

// ── Column definitions (extracted outside parent to avoid re-creation on render) ──

type LapEntry = { lapNumber: number; lapTimeMs: number; isValid: boolean };

const buildLapColumnDefs = (fastestLapMs: number | null) => [
  { id: 'lap', header: 'Lap', cell: (item: LapEntry) => item.lapNumber, width: 80 },
  {
    id: 'time',
    header: 'Time',
    cell: (item: LapEntry) => {
      const isFastest = item.lapTimeMs === fastestLapMs;
      const lapTimeColor = isFastest ? 'text-status-success' : 'inherit';
      return (
        <Box fontWeight={isFastest ? 'bold' : 'normal'} color={item.isValid ? lapTimeColor : 'text-status-error'}>
          {formatLapTime(item.lapTimeMs)}
          {isFastest && ' ★'}
        </Box>
      );
    },
  },
  {
    id: 'valid',
    header: 'Valid',
    cell: (item: LapEntry) => (
      <StatusIndicator type={item.isValid ? 'success' : 'error'}>{item.isValid ? 'Valid' : 'Invalid'}</StatusIndicator>
    ),
    width: 120,
  },
];

const rankLabel = (rank: number): string => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
};

const LEADERBOARD_COLUMN_DEFS = [
  {
    id: 'rank',
    header: 'Pos',
    cell: (item: LeaderboardRankingEntry) => (
      <Box fontWeight={item.rank <= 3 ? 'bold' : 'normal'}>{rankLabel(item.rank)}</Box>
    ),
    width: 70,
  },
  { id: 'name', header: 'Racer', cell: (item: LeaderboardRankingEntry) => item.participantName },
  {
    id: 'country',
    header: 'Country',
    cell: (item: LeaderboardRankingEntry) => item.country ?? '—',
    width: 100,
  },
  {
    id: 'time',
    header: 'Best lap',
    cell: (item: LeaderboardRankingEntry) => (
      <Box fontWeight={item.rank === 1 ? 'bold' : 'normal'}>{formatLapTime(item.bestLapTimeMilliseconds)}</Box>
    ),
    width: 130,
  },
];

interface LiveEventHandlers {
  setRankings: (rankings: LeaderboardRankingEntry[]) => void;
  setCurrentRace: (race: OverlayUpdateEvent | null) => void;
  setRaceStatus: (status: string) => void;
  setLapHistory: (updater: (prev: LapEntry[]) => LapEntry[]) => void;
  lapHistoryLength: number;
  currentRacerName: string | undefined;
}

const handleRaceTopicEvent = (event: PhysicalRaceEvent, handlers: LiveEventHandlers): void => {
  const { setRankings, setCurrentRace, setRaceStatus, setLapHistory, lapHistoryLength, currentRacerName } = handlers;

  if (event.eventType === 'LEADERBOARD_UPDATED') {
    setRankings(event.rankings);
    return;
  }

  if (event.eventType === 'OVERLAY_UPDATE') {
    // RACE_STATUS_CHANGED tracks the event's status, not the current racer — a facilitator runs
    // many racers back-to-back while it stays IN_PROGRESS. A changed racerName is the only signal
    // a new racer started, so lap history must reset here too, not just on that path below.
    const isNewRacer = currentRacerName !== undefined && event.racerName !== currentRacerName;
    setCurrentRace(event);
    setRaceStatus(event.raceStatus);
    if (isNewRacer || event.laps.length > lapHistoryLength) {
      setLapHistory(() =>
        event.laps.map((l: { lapNumber: number; lapTimeMilliseconds: number; isValid: boolean }) => ({
          lapNumber: l.lapNumber,
          lapTimeMs: l.lapTimeMilliseconds,
          isValid: l.isValid,
        })),
      );
    }
    return;
  }

  if (event.eventType === 'RACE_STATUS_CHANGED') {
    const mappedStatus = mapEventStatusToRaceStatus(event.status as EventStatus);
    setRaceStatus(mappedStatus);
    if (mappedStatus === 'RACE_IN_PROGRESS') {
      setLapHistory(() => []);
    } else {
      setCurrentRace(null);
    }
    return;
  }

  if (event.eventType === 'LAP_CAPTURED') {
    setLapHistory((prev) => {
      const exists = prev.some((l) => l.lapNumber === event.lapNumber);
      if (exists) return prev;
      return [...prev, { lapNumber: event.lapNumber, lapTimeMs: event.lapTimeMilliseconds, isValid: event.isValid }];
    });
  }
};

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Commentator view — read-only real-time race data for race commentators.
 * PRD 4.2.1: fastest lap, current position, live commentary stats.
 * No data modification — view only.
 */
const CommentatorView = () => {
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);
  const [selectedLeaderboardId, setSelectedLeaderboardId] = useState<string | undefined>(undefined);
  const [activeEventId, setActiveEventId] = useState('');
  const [activeTrackId, setActiveTrackId] = useState('');
  const [rankings, setRankings] = useState<LeaderboardRankingEntry[]>([]);
  const [currentRace, setCurrentRace] = useState<OverlayUpdateEvent | null>(null);
  const [raceStatus, setRaceStatus] = useState<string>('');
  const [lapHistory, setLapHistory] = useState<{ lapNumber: number; lapTimeMs: number; isValid: boolean }[]>([]);

  const { data: events = [], isLoading: isLoadingEvents } = useListEventsQuery({});
  const { data: tracks = [], isLoading: isLoadingTracks } = useListEventTracksQuery(
    { eventId: selectedEventId ?? '' },
    { skip: !selectedEventId },
  );

  const eventOptions: SelectProps.Options = useMemo(
    () => events.map((event) => ({ label: event.name, value: event.eventId })),
    [events],
  );
  const trackOptions: SelectProps.Options = useMemo(
    () => tracks.map((track) => ({ label: track.name, value: track.leaderboardId })),
    [tracks],
  );

  const isSubscribed = !!activeTrackId;

  const { connectionStatus } = useRaceTopicMqtt(activeEventId, activeTrackId, {
    onEvent: (event) =>
      handleRaceTopicEvent(event, {
        setRankings,
        setCurrentRace,
        setRaceStatus,
        setLapHistory,
        lapHistoryLength: lapHistory.length,
        currentRacerName: currentRace?.racerName,
      }),
    onReconnect: () => {
      // S3 refresh handled via API query skip logic
    },
  });

  // Hydrate initial leaderboard from API — 404 is expected when no track exists yet
  // (notification suppressed in raceManagementApi via displayNotificationOnError: false)
  const { data: apiLeaderboard } = useGetEventLeaderboardQuery(
    { eventId: activeEventId, trackId: activeTrackId },
    { skip: !activeTrackId || rankings.length > 0 },
  );

  const displayRankings = rankings.length > 0 ? rankings : (apiLeaderboard?.rankings ?? []);

  const handleSubscribe = () => {
    setRankings([]);
    setCurrentRace(null);
    setRaceStatus('');
    setLapHistory([]);
    setActiveEventId(selectedEventId ?? '');
    setActiveTrackId(selectedLeaderboardId ?? '');
  };

  const handleEventChange = (eventIdValue: string | undefined) => {
    setSelectedEventId(eventIdValue);
    setSelectedLeaderboardId(undefined);
  };

  const isRacing = raceStatus === 'RACE_IN_PROGRESS';
  const validLaps = lapHistory.filter((l) => l.isValid);
  const fastestLapMs = validLaps.length > 0 ? Math.min(...validLaps.map((l) => l.lapTimeMs)) : null;
  const leader = displayRankings[0] ?? null;

  const pageHeaderDescription = isSubscribed ? undefined : 'Subscribe to a track to start receiving live data';
  const leaderboardCounter = displayRankings.length ? `(${displayRankings.length})` : undefined;
  const leaderboardDescription = leader
    ? `Leader: ${leader.participantName} — ${formatLapTime(leader.bestLapTimeMilliseconds)}`
    : undefined;
  const leaderboardEmptyText = isSubscribed
    ? 'No rankings yet — waiting for race results.'
    : 'Select a track and click Subscribe to start.';
  const connectionBadge = isSubscribed ? <ConnectionBadge status={connectionStatus} /> : undefined;
  const eventSelectStatus = isLoadingEvents ? 'loading' : 'finished';
  const trackSelectPlaceholder = isLoadingTracks ? 'Loading tracks' : 'Select a track';
  const trackSelectStatus = isLoadingTracks ? 'loading' : 'finished';

  return (
    <ContentLayout
      header={
        <Header variant="h1" description={pageHeaderDescription}>
          Commentator view
        </Header>
      }
    >
      <SpaceBetween direction="vertical" size="l">
        {/* Track selector */}
        <Container
          header={
            <Header variant="h2" actions={connectionBadge}>
              Track selection
            </Header>
          }
        >
          <SpaceBetween direction="vertical" size="m">
            <ColumnLayout columns={2}>
              <FormField label="Event">
                <Select
                  selectedOption={eventOptions.find((option) => option.value === selectedEventId) ?? null}
                  onChange={({ detail }) => handleEventChange(detail.selectedOption.value)}
                  options={eventOptions}
                  placeholder="Select an event"
                  loadingText="Loading events"
                  statusType={eventSelectStatus}
                  filteringType="auto"
                  data-testid="event-select"
                />
              </FormField>
              <FormField label="Track">
                <Select
                  selectedOption={trackOptions.find((option) => option.value === selectedLeaderboardId) ?? null}
                  onChange={({ detail }) => setSelectedLeaderboardId(detail.selectedOption.value)}
                  options={trackOptions}
                  placeholder={trackSelectPlaceholder}
                  loadingText="Loading tracks"
                  statusType={trackSelectStatus}
                  disabled={!selectedEventId || isLoadingTracks}
                  filteringType="auto"
                  data-testid="track-select"
                />
              </FormField>
            </ColumnLayout>
            <Box float="right">
              <Button variant="primary" onClick={handleSubscribe} disabled={!selectedLeaderboardId || !selectedEventId}>
                Subscribe
              </Button>
            </Box>
          </SpaceBetween>
        </Container>

        {/* Connection error */}
        {isSubscribed && connectionStatus === ConnectionStatus.ERROR && (
          <Alert type="error">Unable to connect to live race data. Check your permissions and try again.</Alert>
        )}

        {/* Active race stats — shown during a live race */}
        {isRacing && currentRace && (
          <ActiveRaceStatsPanel
            currentRace={currentRace}
            fastestLapMs={fastestLapMs}
            displayRankings={displayRankings}
            leader={leader}
          />
        )}

        {/* Race status when subscribed but not active */}
        {isSubscribed && !isRacing && raceStatus && (
          <Container>
            <Box>
              <Box variant="awsui-key-label">Race status</Box>
              <Box fontSize="heading-m">{formatRaceStatus(raceStatus)}</Box>
            </Box>
          </Container>
        )}

        {/* Lap breakdown for current race */}
        {lapHistory.length > 0 && (
          <Container header={<Header variant="h2">Current race laps</Header>}>
            <Table
              columnDefinitions={buildLapColumnDefs(fastestLapMs)}
              items={[...lapHistory].reverse()}
              variant="embedded"
            />
          </Container>
        )}

        {/* Live leaderboard */}
        <Container
          header={
            <Header variant="h2" counter={leaderboardCounter} description={leaderboardDescription}>
              Live leaderboard
            </Header>
          }
        >
          <Table<LeaderboardRankingEntry>
            columnDefinitions={[
              ...LEADERBOARD_COLUMN_DEFS,
              {
                id: 'gap',
                header: 'Gap to leader',
                cell: (item: LeaderboardRankingEntry) => {
                  if (leader === null || item.rank === 1) return '—';
                  const gapMs = item.bestLapTimeMilliseconds - leader.bestLapTimeMilliseconds;
                  return `+${formatLapTime(gapMs)}`;
                },
                width: 140,
              },
            ]}
            items={displayRankings}
            empty={leaderboardEmptyText}
            variant="embedded"
            stickyHeader
          />
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default CommentatorView;
