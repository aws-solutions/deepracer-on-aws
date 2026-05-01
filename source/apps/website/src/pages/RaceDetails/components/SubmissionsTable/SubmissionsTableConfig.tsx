// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Button from '@cloudscape-design/components/button';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { TableProps } from '@cloudscape-design/components/table';
import { Leaderboard, JobStatus, Submission } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import JobStatusIndicator from '#components/JobStatusIndicator';
import TableEmptyState from '#components/TableEmptyState';
import { PageId } from '#constants/pages.js';
import { millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';
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

enum SubmissionsTableColumn {
  MODEL_NAME = 'Model name',
  SUBMISSION_NUMBER = 'Submission number',
  STATUS = 'Status',
  TIME = 'Time',
  BEST_LAP_TIME = 'Best lap time',
  AVG_LAP_TIME = 'Average lap time',
  TOTAL_LAP_TIME = 'Total lap time',
  COMPLETED_LAPS = 'Completed laps',
  RESETS = 'Resets',
  AVG_RESETS = 'Average resets',
  OFF_TRACK = 'Off-track count',
  COLLISIONS = 'Collision count',
  DATE = 'Date submitted to race',
  VIDEO = 'Video',
}

export const useSubmissionsTableConfig = (submissions: Submission[], leaderboard: Leaderboard) => {
  const { t } = useTranslation('raceDetails');
  const navigate = useNavigate();
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null);

  const pageSizeOptions: CollectionPreferencesProps.PageSizeOption[] = [
    { value: 10, label: t('submissionsTable.collectionPreferences.pageSizeOptionsLabel', { count: 10 }) },
    { value: 20, label: t('submissionsTable.collectionPreferences.pageSizeOptionsLabel', { count: 20 }) },
    { value: 30, label: t('submissionsTable.collectionPreferences.pageSizeOptionsLabel', { count: 30 }) },
  ];

  const defaultPreferences: CollectionPreferencesProps.Preferences = {
    pageSize: 10,
    contentDisplay: [
      { id: SubmissionsTableColumn.SUBMISSION_NUMBER, visible: true },
      { id: SubmissionsTableColumn.MODEL_NAME, visible: true },
      { id: SubmissionsTableColumn.VIDEO, visible: true },
      { id: SubmissionsTableColumn.TIME, visible: true },
      { id: SubmissionsTableColumn.BEST_LAP_TIME, visible: false },
      { id: SubmissionsTableColumn.AVG_LAP_TIME, visible: false },
      { id: SubmissionsTableColumn.TOTAL_LAP_TIME, visible: false },
      { id: SubmissionsTableColumn.COMPLETED_LAPS, visible: false },
      { id: SubmissionsTableColumn.RESETS, visible: true },
      { id: SubmissionsTableColumn.OFF_TRACK, visible: false },
      { id: SubmissionsTableColumn.COLLISIONS, visible: false },
      { id: SubmissionsTableColumn.AVG_RESETS, visible: false },
      { id: SubmissionsTableColumn.STATUS, visible: true },
      { id: SubmissionsTableColumn.DATE, visible: true },
    ],
  };

  const [preferences, setPreferences] = useState(defaultPreferences);

  const { items, collectionProps, paginationProps, filteredItemsCount, filterProps } = useCollection(submissions, {
    filtering: {
      empty: (
        <TableEmptyState
          title={t('submissionsTable.emptyTitle')}
          subtitle={t('submissionsTable.emptySubtitle')}
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
          sortingField: 'submissionNumber',
        },
        isDescending: true,
      },
    },
    selection: {
      keepSelection: true,
    },
  });

  const columnDefinitions: TableProps.ColumnDefinition<Submission>[] = useMemo(
    () => [
      {
        id: SubmissionsTableColumn.MODEL_NAME,
        header: t('submissionsTable.header.modelName'),
        cell: (e) => (
          <Link
            href="#"
            onFollow={(event) => {
              event.preventDefault();
              navigate(getPath(PageId.MODEL_DETAILS, { modelId: e.modelId }));
            }}
          >
            {e.modelName}
          </Link>
        ),
        sortingField: 'modelName',
      },
      {
        id: SubmissionsTableColumn.TIME,
        header: t('submissionsTable.header.time'),
        cell: (e) => millisToMinutesAndSeconds(e.rankingScore),
        sortingComparator: (item1, item2) => {
          if (!item1.rankingScore) return 1;
          if (!item2.rankingScore) return -1;
          return item1.rankingScore - item2.rankingScore;
        },
      },
      {
        id: SubmissionsTableColumn.STATUS,
        header: t('submissionsTable.header.status'),
        cell: (e) => <JobStatusIndicator status={e.status} />,
        sortingField: 'status',
      },
      {
        id: SubmissionsTableColumn.SUBMISSION_NUMBER,
        header: t('submissionsTable.header.submissionNumber'),
        cell: (e) => e.submissionNumber,
        sortingField: 'submissionNumber',
        width: 40,
      },
      {
        id: SubmissionsTableColumn.BEST_LAP_TIME,
        header: t('submissionsTable.header.bestLapTime'),
        cell: (e) => (e.stats ? millisToMinutesAndSeconds(e.stats.bestLapTime) : '–'),
        sortingComparator: (item1, item2) => {
          if (!item1.stats) return 1;
          if (!item2.stats) return -1;
          return item1.stats.bestLapTime - item2.stats.bestLapTime;
        },
      },
      {
        id: SubmissionsTableColumn.AVG_LAP_TIME,
        header: t('submissionsTable.header.avgLapTime'),
        cell: (e) => (e.stats ? millisToMinutesAndSeconds(e.stats.avgLapTime) : '–'),
        sortingComparator: (item1, item2) => {
          if (!item1.stats) return 1;
          if (!item2.stats) return -1;
          return item1.stats.avgLapTime - item2.stats.avgLapTime;
        },
      },
      {
        id: SubmissionsTableColumn.TOTAL_LAP_TIME,
        header: t('submissionsTable.header.totalLapTime'),
        cell: (e) => (e.stats ? millisToMinutesAndSeconds(e.stats.totalLapTime) : '–'),
        sortingComparator: (item1, item2) => {
          if (!item1.stats) return 1;
          if (!item2.stats) return -1;
          return item1.stats.totalLapTime - item2.stats.totalLapTime;
        },
      },
      {
        id: SubmissionsTableColumn.COMPLETED_LAPS,
        header: t('submissionsTable.header.completedLaps'),
        cell: (e) => e.stats?.completedLapCount ?? '–',
        sortingComparator: (item1, item2) => {
          if (!item1.stats) return 1;
          if (!item2.stats) return -1;
          return item1.stats.completedLapCount - item2.stats.completedLapCount;
        },
      },
      {
        id: SubmissionsTableColumn.RESETS,
        header: t('submissionsTable.header.resets'),
        cell: (e) => e.stats?.resetCount ?? '–',
        sortingComparator: (item1, item2) => {
          if (!item1.stats) return 1;
          if (!item2.stats) return -1;
          return item1.stats.resetCount - item2.stats.resetCount;
        },
      },
      {
        id: SubmissionsTableColumn.AVG_RESETS,
        header: t('submissionsTable.header.avgResets'),
        cell: (e) => (e.stats ? e.stats.avgResets.toFixed(2) : '–'),
        sortingComparator: (item1, item2) => {
          if (!item1.stats) return 1;
          if (!item2.stats) return -1;
          return item1.stats.avgResets - item2.stats.avgResets;
        },
      },
      {
        id: SubmissionsTableColumn.OFF_TRACK,
        header: t('submissionsTable.header.offTrack'),
        cell: (e) => e.stats?.offTrackCount ?? '–',
        sortingComparator: (item1, item2) => {
          if (!item1.stats) return 1;
          if (!item2.stats) return -1;
          return item1.stats.offTrackCount - item2.stats.offTrackCount;
        },
      },
      {
        id: SubmissionsTableColumn.COLLISIONS,
        header: t('submissionsTable.header.collisions'),
        cell: (e) => e.stats?.collisionCount ?? '–',
        sortingComparator: (item1, item2) => {
          if (!item1.stats) return 1;
          if (!item2.stats) return -1;
          return item1.stats.collisionCount - item2.stats.collisionCount;
        },
      },
      {
        id: SubmissionsTableColumn.DATE,
        header: t('submissionsTable.header.date'),
        cell: (e) => e.submittedAt.toLocaleString(),
        sortingComparator: (item1, item2) => item1.submittedAt.getTime() - item2.submittedAt.getTime(),
      },
      {
        id: SubmissionsTableColumn.VIDEO,
        header: t('submissionsTable.header.video'),
        cell: (e) => {
          const available = e.status === JobStatus.COMPLETED && !!e.videoUrl;
          return (
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                iconName="play"
                ariaLabel={t('videoModal.watchVideo')}
                disabled={!available}
                onClick={() => setSelectedVideo({ url: e.videoUrl, title: `${e.modelName} #${e.submissionNumber}` })}
              />
              <Button
                variant="link"
                iconName="download"
                ariaLabel={t('videoModal.downloadVideo')}
                disabled={!available}
                onClick={() =>
                  void downloadVideo(
                    e.videoUrl,
                    `${sanitize(leaderboard.name)}_${sanitize(e.modelName)}_${e.submissionNumber}_${formatTimestamp(e.submittedAt)}.mp4`,
                  )
                }
              />
            </SpaceBetween>
          );
        },
      },
    ],
    [navigate, t, setSelectedVideo, leaderboard],
  );

  const SubmissionsTablePreferences = () => (
    <CollectionPreferences
      title={t('submissionsTable.collectionPreferences.title')}
      confirmLabel={t('submissionsTable.collectionPreferences.confirmLabel')}
      cancelLabel={t('submissionsTable.collectionPreferences.cancelLabel')}
      preferences={preferences}
      onConfirm={({ detail }) => setPreferences(detail)}
      pageSizePreference={{
        title: t('submissionsTable.collectionPreferences.pageSizeTitle'),
        options: pageSizeOptions,
      }}
      contentDisplayPreference={{
        title: t('submissionsTable.contentDisplay.title'),
        description: t('submissionsTable.contentDisplay.description'),
        options: [
          {
            id: SubmissionsTableColumn.MODEL_NAME,
            label: t('submissionsTable.header.modelName'),
            alwaysVisible: true,
          },
          {
            id: SubmissionsTableColumn.SUBMISSION_NUMBER,
            label: t('submissionsTable.header.submissionNumber'),
          },
          {
            id: SubmissionsTableColumn.VIDEO,
            label: t('submissionsTable.header.video'),
          },
          {
            id: SubmissionsTableColumn.TIME,
            label: t('submissionsTable.header.time'),
          },
          {
            id: SubmissionsTableColumn.BEST_LAP_TIME,
            label: t('submissionsTable.header.bestLapTime'),
          },
          {
            id: SubmissionsTableColumn.AVG_LAP_TIME,
            label: t('submissionsTable.header.avgLapTime'),
          },
          {
            id: SubmissionsTableColumn.TOTAL_LAP_TIME,
            label: t('submissionsTable.header.totalLapTime'),
          },
          {
            id: SubmissionsTableColumn.COMPLETED_LAPS,
            label: t('submissionsTable.header.completedLaps'),
          },
          {
            id: SubmissionsTableColumn.RESETS,
            label: t('submissionsTable.header.resets'),
          },
          {
            id: SubmissionsTableColumn.OFF_TRACK,
            label: t('submissionsTable.header.offTrack'),
          },
          {
            id: SubmissionsTableColumn.COLLISIONS,
            label: t('submissionsTable.header.collisions'),
          },
          {
            id: SubmissionsTableColumn.AVG_RESETS,
            label: t('submissionsTable.header.avgResets'),
          },
          {
            id: SubmissionsTableColumn.STATUS,
            label: t('submissionsTable.header.status'),
          },
          {
            id: SubmissionsTableColumn.DATE,
            label: t('submissionsTable.header.date'),
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
    SubmissionsTablePreferences,
    filteredItemsCount,
    filterProps,
    selectedVideo,
    setSelectedVideo,
  };
};
