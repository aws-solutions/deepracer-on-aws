// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Header from '@cloudscape-design/components/header';
import Table, { TableProps } from '@cloudscape-design/components/table';
import { EventStatus, Leaderboard } from '@deepracer-indy/typescript-client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { PageId } from '#constants/pages.js';
import { useListFleetsQuery } from '#services/deepRacer/fleetsApi.js';
import { getPath } from '#utils/pageUtils.js';

import { TimekeeperLinkCell } from './TimekeeperLinkCell';
import { TrackLinkCell } from './TrackLinkCell';

export interface LeaderboardsProps {
  eventId: string;
  tracks: Leaderboard[];
  eventStatus: EventStatus;
}

type LeaderboardRow = Leaderboard & {
  index: number;
  eventId: string;
  timekeepLinkText: string;
  leaderboardLinkText: string;
  streamingOverlayLinkText: string;
  eventStatus: EventStatus;
};

const TimekeeperCell = (row: LeaderboardRow) => (
  <TimekeeperLinkCell
    eventId={row.eventId}
    leaderboardId={row.leaderboardId}
    linkText={row.timekeepLinkText}
    eventStatus={row.eventStatus}
  />
);

/** Public, unauthenticated leaderboard view for venue monitors — scoped to this track. */
const LeaderboardLinkCell = (row: LeaderboardRow) => {
  const href = `${getPath(PageId.PUBLIC_LEADERBOARD, { eventId: row.eventId })}?track=${row.leaderboardId}`;
  return <TrackLinkCell href={href} linkText={row.leaderboardLinkText} />;
};

/** Transparent OBS/streaming overlay browser source — scoped to this event and track. */
const StreamingOverlayLinkCell = (row: LeaderboardRow) => {
  const href = `${getPath(PageId.STREAMING_OVERLAY)}?event=${row.eventId}&track=${row.leaderboardId}`;
  return <TrackLinkCell href={href} linkText={row.streamingOverlayLinkText} />;
};

const Leaderboards = ({ eventId, tracks, eventStatus }: LeaderboardsProps) => {
  const { t } = useTranslation('events');
  const timekeepLinkText = t('detail.tracks.table.timekeepLink');
  const leaderboardLinkText = t('detail.tracks.table.leaderboardLink');
  const streamingOverlayLinkText = t('detail.tracks.table.streamingOverlayLink');

  const { data: fleets = [] } = useListFleetsQuery({});
  const fleetIdToName = useMemo<Record<string, string>>(
    () => Object.fromEntries(fleets.map((fleet) => [fleet.fleetId, fleet.name])),
    [fleets],
  );

  const items: LeaderboardRow[] = tracks.map((track, index) => ({
    ...track,
    index: index + 1,
    eventId,
    timekeepLinkText,
    leaderboardLinkText,
    streamingOverlayLinkText,
    eventStatus,
  }));

  const columnDefinitions: TableProps.ColumnDefinition<LeaderboardRow>[] = [
    {
      id: 'index',
      header: t('detail.leaderboards.columnHeaders.track'),
      cell: (track) => track.index,
    },
    {
      id: 'fleetId',
      header: t('detail.leaderboards.columnHeaders.fleet'),
      cell: (track) => (track.fleetId ? (fleetIdToName[track.fleetId] ?? track.fleetId) : '-'),
    },
    {
      id: 'name',
      header: t('detail.leaderboards.columnHeaders.headerText'),
      cell: (track) => track.name || '-',
    },
    {
      id: 'leaderBoardFooter',
      header: t('detail.leaderboards.columnHeaders.footerText'),
      cell: (track) => track.leaderBoardFooter || '-',
    },
    {
      id: 'timekeeping',
      header: t('detail.tracks.table.timekeepLink'),
      cell: TimekeeperCell,
    },
    {
      id: 'leaderboardLink',
      header: t('detail.tracks.table.leaderboardLink'),
      cell: LeaderboardLinkCell,
    },
    {
      id: 'streamingOverlayLink',
      header: t('detail.tracks.table.streamingOverlayLink'),
      cell: StreamingOverlayLinkCell,
    },
  ];

  return (
    <Table
      header={<Header variant="h2">{t('detail.leaderboards.header')}</Header>}
      columnDefinitions={columnDefinitions}
      items={items}
      trackBy="leaderboardId"
      resizableColumns
      variant="embedded"
    />
  );
};

export default Leaderboards;
