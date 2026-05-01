// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Button from '@cloudscape-design/components/button';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { TableProps } from '@cloudscape-design/components/table';
import { Ranking, Leaderboard } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import AvatarDisplay from '#components/Avatar/AvatarDisplay';
import TableEmptyState from '#components/TableEmptyState/TableEmptyState.js';
import { PageId } from '#constants/pages.js';
import { getRacingTimeGap, millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';
import { getPath } from '#utils/pageUtils.js';

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9-_]/g, '_');

const formatTimestamp = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;

const downloadVideo = async (url: string, filename: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
};

export interface SelectedVideo {
  url: string;
  title: string;
}

enum RaceLeaderboardTableColumn {
  RANK = 'Rank',
  RACER = 'Racer',
  TIME = 'Time',
  GAP_TO_FIRST = 'Gap to 1st',
  OFF_TRACK = 'Off-track',
  BEST_LAP_TIME = 'Best lap time',
  AVG_LAP_TIME = 'Average lap time',
  TOTAL_LAP_TIME = 'Total lap time',
  COMPLETED_LAPS = 'Completed laps',
  RESETS = 'Resets',
  AVG_RESETS = 'Average resets',
  COLLISIONS = 'Collision count',
  DATE = 'Date submitted to race',
  VIDEO = 'Video',
}

export const useRaceLeaderboardTableConfig = (rankings: Ranking[], leaderboard: Leaderboard) => {
  const { t } = useTranslation('raceDetails');
  const navigate = useNavigate();
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null);

  const pageSizeOptions: CollectionPreferencesProps.PageSizeOption[] = [
    { value: 10, label: t('raceLeaderboardTable.collectionPreferences.pageSizeOptionsLabel', { count: 10 }) },
    { value: 20, label: t('raceLeaderboardTable.collectionPreferences.pageSizeOptionsLabel', { count: 20 }) },
    { value: 30, label: t('raceLeaderboardTable.collectionPreferences.pageSizeOptionsLabel', { count: 30 }) },
  ];

  const defaultPreferences: CollectionPreferencesProps.Preferences = {
    pageSize: 10,
    contentDisplay: [
      { id: RaceLeaderboardTableColumn.RANK, visible: true },
      { id: RaceLeaderboardTableColumn.RACER, visible: true },
      { id: RaceLeaderboardTableColumn.VIDEO, visible: true },
      { id: RaceLeaderboardTableColumn.TIME, visible: true },
      { id: RaceLeaderboardTableColumn.GAP_TO_FIRST, visible: true },
      { id: RaceLeaderboardTableColumn.BEST_LAP_TIME, visible: false },
      { id: RaceLeaderboardTableColumn.AVG_LAP_TIME, visible: false },
      { id: RaceLeaderboardTableColumn.TOTAL_LAP_TIME, visible: false },
      { id: RaceLeaderboardTableColumn.COMPLETED_LAPS, visible: false },
      { id: RaceLeaderboardTableColumn.RESETS, visible: true },
      { id: RaceLeaderboardTableColumn.OFF_TRACK, visible: false },
      { id: RaceLeaderboardTableColumn.COLLISIONS, visible: false },
      { id: RaceLeaderboardTableColumn.AVG_RESETS, visible: false },
      { id: RaceLeaderboardTableColumn.DATE, visible: false },
    ],
  };

  const [preferences, setPreferences] = useState(defaultPreferences);

  const { items, collectionProps, paginationProps, filteredItemsCount, filterProps } = useCollection(rankings, {
    filtering: {
      empty: (
        <TableEmptyState
          title={t('raceLeaderboardTable.emptyTitle')}
          subtitle={t('raceLeaderboardTable.emptySubtitle')}
          action={
            <Button
              onClick={() => navigate(getPath(PageId.ENTER_RACE, { leaderboardId: leaderboard.leaderboardId }))}
              disabled={leaderboard.openTime > new Date() || leaderboard.closeTime <= new Date()}
            >
              {t('enterRace')}
            </Button>
          }
        />
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {
      defaultState: {
        sortingColumn: {
          sortingField: 'rank',
        },
        isDescending: false,
      },
    },
    selection: {
      keepSelection: true,
    },
  });

  const columnDefinitions: TableProps.ColumnDefinition<Ranking>[] = useMemo(
    () => [
      {
        id: RaceLeaderboardTableColumn.RANK,
        header: t('raceLeaderboardTable.header.rank'),
        cell: (e) => e.rank,
        sortingField: 'rank',
        width: 40,
      },
      {
        id: RaceLeaderboardTableColumn.RACER,
        header: t('raceLeaderboardTable.header.racer'),
        cell: (e) => (
          <SpaceBetween direction="horizontal" size="xs" alignItems="center">
            <AvatarDisplay avatarConfig={e.userProfile.avatar} displaySize={32} />
            <span>{e.userProfile.alias}</span>
          </SpaceBetween>
        ),
        sortingComparator: (item1, item2) => item1.userProfile.alias.localeCompare(item2.userProfile.alias),
      },
      {
        id: RaceLeaderboardTableColumn.TIME,
        header: t('raceLeaderboardTable.header.time'),
        cell: (e) => millisToMinutesAndSeconds(e.rankingScore),
        sortingField: 'rankingScore',
      },
      {
        id: RaceLeaderboardTableColumn.GAP_TO_FIRST,
        header: t('raceLeaderboardTable.header.gapToFirst'),
        cell: (e) => getRacingTimeGap(rankings[0].rankingScore, e.rankingScore),
        sortingField: 'rankingScore',
      },
      {
        id: RaceLeaderboardTableColumn.OFF_TRACK,
        header: t('raceLeaderboardTable.header.offtrack'),
        cell: (e) => e.stats.offTrackCount,
        sortingComparator: (item1, item2) => item1.stats.offTrackCount - item2.stats.offTrackCount,
      },
      {
        id: RaceLeaderboardTableColumn.BEST_LAP_TIME,
        header: t('raceLeaderboardTable.header.bestLapTime'),
        cell: (e) => millisToMinutesAndSeconds(e.stats.bestLapTime),
        sortingComparator: (item1, item2) => item1.stats.bestLapTime - item2.stats.bestLapTime,
      },
      {
        id: RaceLeaderboardTableColumn.AVG_LAP_TIME,
        header: t('raceLeaderboardTable.header.avgLapTime'),
        cell: (e) => millisToMinutesAndSeconds(e.stats.avgLapTime),
        sortingComparator: (item1, item2) => item1.stats.avgLapTime - item2.stats.avgLapTime,
      },
      {
        id: RaceLeaderboardTableColumn.TOTAL_LAP_TIME,
        header: t('raceLeaderboardTable.header.totalLapTime'),
        cell: (e) => millisToMinutesAndSeconds(e.stats.totalLapTime),
        sortingComparator: (item1, item2) => item1.stats.totalLapTime - item2.stats.totalLapTime,
      },
      {
        id: RaceLeaderboardTableColumn.COMPLETED_LAPS,
        header: t('raceLeaderboardTable.header.completedLaps'),
        cell: (e) => e.stats.completedLapCount,
        sortingComparator: (item1, item2) => item1.stats.completedLapCount - item2.stats.completedLapCount,
      },
      {
        id: RaceLeaderboardTableColumn.RESETS,
        header: t('raceLeaderboardTable.header.resets'),
        cell: (e) => e.stats.resetCount,
        sortingComparator: (item1, item2) => item1.stats.resetCount - item2.stats.resetCount,
      },
      {
        id: RaceLeaderboardTableColumn.AVG_RESETS,
        header: t('raceLeaderboardTable.header.avgResets'),
        cell: (e) => e.stats.avgResets.toFixed(2),
        sortingComparator: (item1, item2) => item1.stats.avgResets - item2.stats.avgResets,
      },
      {
        id: RaceLeaderboardTableColumn.COLLISIONS,
        header: t('raceLeaderboardTable.header.collisions'),
        cell: (e) => e.stats.collisionCount,
        sortingComparator: (item1, item2) => item1.stats.collisionCount - item2.stats.collisionCount,
      },
      {
        id: RaceLeaderboardTableColumn.DATE,
        header: t('raceLeaderboardTable.header.date'),
        cell: (e) => e.submittedAt.toLocaleString(),
        sortingComparator: (item1, item2) => item1.submittedAt.getTime() - item2.submittedAt.getTime(),
      },
      {
        id: RaceLeaderboardTableColumn.VIDEO,
        header: t('raceLeaderboardTable.header.video'),
        cell: (e) => (
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              iconName="play"
              ariaLabel={t('videoModal.watchVideo')}
              disabled={!e.videoUrl}
              onClick={() => setSelectedVideo({ url: e.videoUrl, title: e.userProfile.alias })}
            />
            <Button
              variant="link"
              iconName="download"
              ariaLabel={t('videoModal.downloadVideo')}
              disabled={!e.videoUrl}
              onClick={() =>
                void downloadVideo(
                  e.videoUrl,
                  `${sanitize(leaderboard.name)}_${sanitize(e.userProfile.alias)}_${e.submissionNumber}_${formatTimestamp(e.submittedAt)}.mp4`,
                )
              }
            />
          </SpaceBetween>
        ),
      },
    ],
    [rankings, t, setSelectedVideo, leaderboard],
  );

  const RaceLeaderboardTablePreferences = () => (
    <CollectionPreferences
      title={t('raceLeaderboardTable.collectionPreferences.title')}
      confirmLabel={t('raceLeaderboardTable.collectionPreferences.confirmLabel')}
      cancelLabel={t('raceLeaderboardTable.collectionPreferences.cancelLabel')}
      preferences={preferences}
      onConfirm={({ detail }) => setPreferences(detail)}
      pageSizePreference={{
        title: t('raceLeaderboardTable.collectionPreferences.pageSizeTitle'),
        options: pageSizeOptions,
      }}
      contentDisplayPreference={{
        title: t('raceLeaderboardTable.contentDisplay.title'),
        description: t('raceLeaderboardTable.contentDisplay.description'),
        options: [
          {
            id: RaceLeaderboardTableColumn.RANK,
            label: t('raceLeaderboardTable.header.rank'),
            alwaysVisible: true,
          },
          {
            id: RaceLeaderboardTableColumn.RACER,
            label: t('raceLeaderboardTable.header.racer'),
          },
          {
            id: RaceLeaderboardTableColumn.VIDEO,
            label: t('raceLeaderboardTable.header.video'),
          },
          {
            id: RaceLeaderboardTableColumn.TIME,
            label: t('raceLeaderboardTable.header.time'),
          },
          {
            id: RaceLeaderboardTableColumn.GAP_TO_FIRST,
            label: t('raceLeaderboardTable.header.gapToFirst'),
          },
          {
            id: RaceLeaderboardTableColumn.BEST_LAP_TIME,
            label: t('raceLeaderboardTable.header.bestLapTime'),
          },
          {
            id: RaceLeaderboardTableColumn.AVG_LAP_TIME,
            label: t('raceLeaderboardTable.header.avgLapTime'),
          },
          {
            id: RaceLeaderboardTableColumn.TOTAL_LAP_TIME,
            label: t('raceLeaderboardTable.header.totalLapTime'),
          },
          {
            id: RaceLeaderboardTableColumn.COMPLETED_LAPS,
            label: t('raceLeaderboardTable.header.completedLaps'),
          },
          {
            id: RaceLeaderboardTableColumn.RESETS,
            label: t('raceLeaderboardTable.header.resets'),
          },
          {
            id: RaceLeaderboardTableColumn.OFF_TRACK,
            label: t('raceLeaderboardTable.header.offtrack'),
          },
          {
            id: RaceLeaderboardTableColumn.COLLISIONS,
            label: t('raceLeaderboardTable.header.collisions'),
          },
          {
            id: RaceLeaderboardTableColumn.AVG_RESETS,
            label: t('raceLeaderboardTable.header.avgResets'),
          },
          {
            id: RaceLeaderboardTableColumn.DATE,
            label: t('raceLeaderboardTable.header.date'),
          },
        ],
      }}
    />
  );

  return {
    collectionProps,
    columnDefinitions,
    columnDisplay: preferences.contentDisplay,
    items,
    paginationProps,
    selectedItems: collectionProps.selectedItems,
    RaceLeaderboardTablePreferences,
    filteredItemsCount,
    filterProps,
    selectedVideo,
    setSelectedVideo,
  };
};
