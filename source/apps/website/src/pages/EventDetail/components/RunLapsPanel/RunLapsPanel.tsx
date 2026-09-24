// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { TableProps } from '@cloudscape-design/components/table';
import { Lap, Leaderboard } from '@deepracer-indy/typescript-client';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { useListProfilesQuery } from '#services/deepRacer/profileApi.js';
import { useGetRunQuery, useListRunsQuery, useUpdateLapMutation } from '#services/deepRacer/runsApi.js';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';
import { formatTimestampWithTimeZone, millisToMinutesAndSeconds } from '#utils/dateTimeUtils.js';

import LapEditModal, { LapEditFormValues } from './LapEditModal';

interface RunLapsPanelProps {
  eventId: string;
  tracks: Leaderboard[];
  isAdmin: boolean;
}

/**
 * Builds the lap table's column definitions. Declared outside the component body (and taking
 * every value it needs as an argument) so the `cell` renderers — including the ones returning
 * JSX — are plain module-scope functions rather than components nested inside `RunLapsPanel`'s
 * render body, and are not re-created on every render.
 */
const buildLapTableColumnDefinitions = (
  t: TFunction<'events'>,
  isAdmin: boolean,
  onEditLap: (lap: Lap) => void,
): TableProps.ColumnDefinition<Lap>[] => [
  {
    id: 'lapNumber',
    header: t('detail.runs.lapTable.columns.lapNumber'),
    cell: (lap) => lap.lapNumber,
  },
  {
    id: 'lapTimeMs',
    header: t('detail.runs.lapTable.columns.lapTimeMs'),
    cell: (lap) => millisToMinutesAndSeconds(lap.lapTimeMs),
  },
  {
    id: 'isValid',
    header: t('detail.runs.lapTable.columns.isValid'),
    cell: (lap) => (
      <StatusIndicator type={lap.isValid ? 'success' : 'error'}>
        {lap.isValid ? t('detail.runs.lapTable.valid') : t('detail.runs.lapTable.invalid')}
      </StatusIndicator>
    ),
  },
  {
    id: 'editHistory',
    header: t('detail.runs.lapTable.columns.editHistory'),
    cell: (lap) =>
      lap.originalLapTimeMs === undefined ? '—' : t('detail.runs.lapTable.editedBy', { editedBy: lap.editedBy ?? '—' }),
  },
  ...(isAdmin
    ? [
        {
          id: 'actions',
          header: '',
          cell: (lap: Lap) => (
            <Button variant="inline-link" onClick={() => onEditLap(lap)}>
              {t('detail.runs.lapTable.editButton')}
            </Button>
          ),
        },
      ]
    : []),
];

/** Looks up a Run by its track (leaderboardId) and runId, then displays its recorded laps. */
const RunLapsPanel = ({ eventId, tracks, isAdmin }: RunLapsPanelProps) => {
  const { t } = useTranslation('events');
  const dispatch = useAppDispatch();

  const [selectedLeaderboardId, setSelectedLeaderboardId] = useState<string | undefined>(undefined);
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(undefined);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(undefined);
  const [editingLap, setEditingLap] = useState<Lap | undefined>(undefined);

  const trackOptions: SelectProps.Options = useMemo(
    () => tracks.map((track) => ({ value: track.leaderboardId, label: track.name || track.leaderboardId })),
    [tracks],
  );
  const selectedTrackOption = trackOptions.find((option) => option.value === selectedLeaderboardId) ?? null;

  const {
    data: runs = [],
    isFetching: isRunsLoading,
    isError: isRunsError,
  } = useListRunsQuery(selectedLeaderboardId ? { eventId, leaderboardId: selectedLeaderboardId } : skipToken);

  // ListRuns has no profileId filter and there's no per-track "distinct racers" endpoint, so
  // the Racer selector is derived client-side: instance-wide profiles (ListProfiles), narrowed
  // to only those with at least one Run already returned for the selected track. This keeps
  // the Racer list scoped to "racers with runs on this track" without any API contract change.
  const { data: profiles = [] } = useListProfilesQuery();
  const profileIdToAlias = useMemo<Record<string, string>>(
    () => Object.fromEntries(profiles.map((profile) => [profile.profileId, profile.alias])),
    [profiles],
  );
  const racerProfileIds = useMemo(() => new Set(runs.map((run) => run.profileId)), [runs]);
  const racerOptions: SelectProps.Options = useMemo(
    () =>
      [...racerProfileIds].map((profileId) => ({
        value: profileId,
        label: profileIdToAlias[profileId] ?? profileId,
      })),
    [racerProfileIds, profileIdToAlias],
  );
  const selectedRacerOption = racerOptions.find((option) => option.value === selectedProfileId) ?? null;

  const runsForSelectedRacer = useMemo(
    () => (selectedProfileId ? runs.filter((run) => run.profileId === selectedProfileId) : []),
    [runs, selectedProfileId],
  );

  const runOptions: SelectProps.Options = useMemo(
    () =>
      runsForSelectedRacer.map((run) => ({
        value: run.runId,
        label: t('detail.runs.lookup.runOptionLabel', {
          createdAt: formatTimestampWithTimeZone(run.createdAt),
          runStatus: t(`detail.runStatus.${run.runStatus}`),
        }),
      })),
    [runsForSelectedRacer, t],
  );
  const selectedRunOption = runOptions.find((option) => option.value === selectedRunId) ?? null;

  const {
    data,
    isFetching: isRunLoading,
    isError: isRunError,
  } = useGetRunQuery(
    selectedLeaderboardId && selectedRunId
      ? { eventId, leaderboardId: selectedLeaderboardId, runId: selectedRunId }
      : skipToken,
  );
  const [updateLap, { isLoading: isSavingLapEdit }] = useUpdateLapMutation();

  const handleTrackChange = (leaderboardId: string | undefined) => {
    setSelectedLeaderboardId(leaderboardId);
    setSelectedProfileId(undefined);
    setSelectedRunId(undefined);
  };

  const handleRacerChange = (profileId: string | undefined) => {
    setSelectedProfileId(profileId);
    setSelectedRunId(undefined);
  };

  const handleSaveLapEdit = async (values: LapEditFormValues) => {
    if (!selectedLeaderboardId || !selectedRunId || !editingLap) return;

    try {
      await updateLap({
        eventId,
        leaderboardId: selectedLeaderboardId,
        runId: selectedRunId,
        lapNumber: editingLap.lapNumber,
        lapTimeMs: values.lapTimeMs,
        editReason: values.editReason,
      }).unwrap();
      dispatch(displaySuccessNotification({ content: t('detail.runs.lapEdit.saveSuccess') }));
      setEditingLap(undefined);
    } catch (err: unknown) {
      console.error('Failed to update lap', err);
      dispatch(displayErrorNotification({ content: t('detail.runs.lapEdit.saveError') }));
    }
  };

  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h3">{t('detail.runs.lookup.header')}</Header>}>
        <SpaceBetween direction="horizontal" size="s">
          <Select
            selectedOption={selectedTrackOption}
            onChange={({ detail }) => handleTrackChange(detail.selectedOption.value)}
            options={trackOptions}
            placeholder={t('detail.runs.lookup.trackPlaceholder')}
            ariaLabel={t('detail.runs.lookup.trackPlaceholder')}
            empty={t('detail.runs.lookup.noTracks')}
            data-testid="track-select"
          />
          <Select
            selectedOption={selectedRacerOption}
            onChange={({ detail }) => handleRacerChange(detail.selectedOption.value)}
            options={racerOptions}
            placeholder={t('detail.runs.lookup.racerPlaceholder')}
            ariaLabel={t('detail.runs.lookup.racerPlaceholder')}
            disabled={!selectedLeaderboardId}
            statusType={isRunsLoading ? 'loading' : 'finished'}
            empty={t('detail.runs.lookup.noRacers')}
            data-testid="racer-select"
          />
          <Select
            selectedOption={selectedRunOption}
            onChange={({ detail }) => setSelectedRunId(detail.selectedOption.value)}
            options={runOptions}
            placeholder={t('detail.runs.lookup.runPlaceholder')}
            ariaLabel={t('detail.runs.lookup.runPlaceholder')}
            disabled={!selectedProfileId}
            statusType={isRunsLoading ? 'loading' : 'finished'}
            empty={t('detail.runs.lookup.noRuns')}
            data-testid="run-select"
          />
        </SpaceBetween>
      </Container>

      {selectedLeaderboardId && isRunsError && <Alert type="error">{t('detail.runs.lookup.runsLoadError')}</Alert>}

      {selectedRunId && isRunLoading && (
        <Container>
          <Box textAlign="center" padding="xl">
            <Spinner />
          </Box>
        </Container>
      )}

      {selectedRunId && !isRunLoading && isRunError && <Alert type="error">{t('detail.runs.lookup.notFound')}</Alert>}

      {selectedRunId && !isRunLoading && !isRunError && data && (
        <Container
          header={
            <Header
              variant="h3"
              description={<StatusIndicator type="info">{t(`detail.runStatus.${data.run.runStatus}`)}</StatusIndicator>}
            >
              {t('detail.runs.lapTable.header', { runId: data.run.runId })}
            </Header>
          }
        >
          <Table
            items={data.laps}
            trackBy="lapNumber"
            empty={<Box textAlign="center">{t('detail.runs.lapTable.empty')}</Box>}
            columnDefinitions={buildLapTableColumnDefinitions(t, isAdmin, setEditingLap)}
          />
        </Container>
      )}

      {editingLap && (
        <LapEditModal
          lap={editingLap}
          isSubmitting={isSavingLapEdit}
          onSubmit={handleSaveLapEdit}
          onDismiss={() => setEditingLap(undefined)}
        />
      )}
    </SpaceBetween>
  );
};

export default RunLapsPanel;
