// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button } from '@cloudscape-design/components';
import Alert from '@cloudscape-design/components/alert';
import CollectionPreferences, {
  type CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Pagination from '@cloudscape-design/components/pagination';
import PropertyFilter, { type PropertyFilterProps } from '@cloudscape-design/components/property-filter';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator, { type StatusIndicatorProps } from '@cloudscape-design/components/status-indicator';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import { Run, RunStatus, RunTransitionAction } from '@deepracer-indy/typescript-client';
import { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPropertyFilterI18nStrings } from '#components/PropertyFilterI18nStrings/index.js';
import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { useTimekeepingContext } from '#hooks/useTimekeepingContext.js';
import { useTimekeepingLaps, useTimekeepingSessionActions } from '#hooks/useTimekeepingSession.js';
import { useListAdminProfilesQuery } from '#services/deepRacer/adminApi.js';
import { useStartCarLogFetchMutation } from '#services/deepRacer/carLogsApi.js';
import { useGetEventQuery } from '#services/deepRacer/eventsApi.js';
import { useCreateRunMutation, useListRunsQuery, useTransitionRunStatusMutation } from '#services/deepRacer/runsApi.js';
import { displayWarningNotification } from '#store/notifications/notificationsSlice.js';

import { ACTIVE_RUN_STATUS_INDICATOR } from './activeRunStatusIndicator';
import { RunSetupModal, type RunSetupSelection } from './RunSetupModal';

interface RunTableItem extends Run {
  racerName: string;
  racedByProxyText: string;
  startedText: string;
  statusText: string;
}

const STATUS_INDICATOR_TYPE: Record<RunStatus, StatusIndicatorProps.Type> = {
  [RunStatus.READY]: 'pending',
  [RunStatus.IN_PROGRESS]: 'in-progress',
  [RunStatus.PAUSED]: 'warning',
  [RunStatus.FINISHED]: 'info',
  [RunStatus.SUBMITTED]: 'success',
  [RunStatus.DISCARDED]: 'error',
};

const getColumnDefinitions = (t: TFunction<'timekeeping'>): TableProps.ColumnDefinition<RunTableItem>[] => [
  { id: 'racer', header: t('runs.columnHeaders.racer'), cell: (run) => run.racerName },
  {
    id: 'status',
    header: t('runs.columnHeaders.status'),
    cell: (run) => <StatusIndicator type={STATUS_INDICATOR_TYPE[run.runStatus]}>{run.statusText}</StatusIndicator>,
  },
  { id: 'started', header: t('runs.columnHeaders.started'), cell: (run) => run.startedText },
  { id: 'racedByProxy', header: t('runs.columnHeaders.racedByProxy'), cell: (run) => run.racedByProxyText },
];

export const RunsTable = () => {
  const { t } = useTranslation('timekeeping');
  const { t: tCommon } = useTranslation('common');
  const dispatch = useAppDispatch();

  const { registerActiveRun, registerCreatedRun } = useTimekeepingSessionActions();
  const { laps = [] } = useTimekeepingLaps();
  const { fetchCarLogsOnRunFinish, selectedEventId, selectedLeaderboardId } = useTimekeepingContext();

  const [isRunSetupModalVisible, setIsRunSetupModalVisible] = useState(false);
  const [runSetupError, setRunSetupError] = useState<string | undefined>(undefined);
  const [runTransitionError, setRunTransitionError] = useState<string | undefined>(undefined);
  const [preferences, setPreferences] = useState<CollectionPreferencesProps.Preferences>({ pageSize: 10 });
  const [createRun, { isLoading: isCreatingRun }] = useCreateRunMutation();
  const [startCarLogFetch] = useStartCarLogFetchMutation();

  const [transitionRunStatus, { isLoading: isTransitioning }] = useTransitionRunStatusMutation();

  const hasRunContext = Boolean(selectedEventId && selectedLeaderboardId);
  const { data: runs = [], isLoading } = useListRunsQuery(
    { eventId: selectedEventId ?? '', leaderboardId: selectedLeaderboardId ?? '' },
    { skip: !hasRunContext },
  );
  const { data: profiles = [] } = useListAdminProfilesQuery();
  const racerOptions = useMemo(
    () => profiles.map((profile) => ({ label: profile.alias, value: profile.profileId })),
    [profiles],
  );
  const { data: event } = useGetEventQuery({ eventId: selectedEventId ?? '' }, { skip: !selectedEventId });
  const completedRacesByProfileId = useMemo(() => {
    const completedRaces: Record<string, number> = {};
    for (const run of runs) {
      if (run.runStatus === RunStatus.SUBMITTED) {
        completedRaces[run.profileId] = (completedRaces[run.profileId] ?? 0) + 1;
      }
    }
    return completedRaces;
  }, [runs]);
  const pageSizeOptions: CollectionPreferencesProps.PageSizeOption[] = [
    { value: 5, label: t('runs.preferences.pageSizeOptionsLabel', { count: 5 }) },
    { value: 10, label: t('runs.preferences.pageSizeOptionsLabel', { count: 10 }) },
    { value: 15, label: t('runs.preferences.pageSizeOptionsLabel', { count: 15 }) },
    { value: 25, label: t('runs.preferences.pageSizeOptionsLabel', { count: 25 }) },
    { value: 50, label: t('runs.preferences.pageSizeOptionsLabel', { count: 50 }) },
    { value: 100, label: t('runs.preferences.pageSizeOptionsLabel', { count: 100 }) },
  ];
  const items = useMemo<RunTableItem[]>(() => {
    const aliases = Object.fromEntries(profiles.map((profile) => [profile.profileId, profile.alias]));
    return runs
      .map((run) => ({
        ...run,
        racerName: aliases[run.profileId] ?? run.profileId,
        statusText: t(`runStatus.${run.runStatus}`),
        racedByProxyText: run.racedByProxy ? t('runs.proxy.yes') : t('runs.proxy.no'),
        startedText: run.createdAt.toLocaleString(),
      }))
      .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime());
  }, [profiles, runs, t]);
  const filteringProperties = useMemo<PropertyFilterProps.FilteringProperty[]>(
    () => [
      {
        key: 'racerName',
        groupValuesLabel: '',
        propertyLabel: t('runs.columnHeaders.racer'),
        operators: [':', '!:', '=', '!='],
      },
      {
        key: 'statusText',
        groupValuesLabel: '',
        propertyLabel: t('runs.columnHeaders.status'),
        operators: ['=', '!='],
      },
      {
        key: 'racedByProxyText',
        groupValuesLabel: '',
        propertyLabel: t('runs.columnHeaders.racedByProxy'),
        operators: ['=', '!='],
      },
      {
        key: 'startedText',
        groupValuesLabel: '',
        propertyLabel: t('runs.columnHeaders.started'),
        operators: [':', '!:'],
      },
    ],
    [t],
  );
  const {
    items: paginatedItems,
    filteredItemsCount,
    propertyFilterProps,
    collectionProps,
    paginationProps,
  } = useCollection(items, {
    propertyFiltering: { filteringProperties },
    pagination: { pageSize: preferences.pageSize },
  });
  const activeRun =
    items.find((run) => run.runStatus === RunStatus.IN_PROGRESS) ??
    items.find((run) => run.runStatus === RunStatus.PAUSED) ??
    items.find((run) => run.runStatus === RunStatus.READY) ??
    items[0];
  const activeRunStatusIndicator = activeRun ? ACTIVE_RUN_STATUS_INDICATOR[activeRun.runStatus] : undefined;

  useEffect(() => {
    if (isLoading || !activeRun) return;

    const profile = profiles.find((candidate) => candidate.profileId === activeRun.profileId);
    registerActiveRun(activeRun, {
      selectedRacer: {
        label: profile?.alias ?? activeRun.profileId,
        value: activeRun.profileId,
      },
      racedByProxy: activeRun.racedByProxy ?? false,
    });
  }, [activeRun, isLoading, profiles, registerActiveRun]);

  const handleRunSetupDismiss = () => {
    setRunSetupError(undefined);
    setIsRunSetupModalVisible(false);
  };

  const handleRunSetupNext = async (selection: RunSetupSelection) => {
    const profileId = selection.selectedRacer.value;
    if (!selectedEventId || !selectedLeaderboardId || !profileId) return;

    setRunSetupError(undefined);
    try {
      const run = await createRun({
        eventId: selectedEventId,
        leaderboardId: selectedLeaderboardId,
        profileId,
        racedByProxy: selection.racedByProxy,
      }).unwrap();
      registerCreatedRun(run, selection);
      setIsRunSetupModalVisible(false);
    } catch {
      setRunSetupError(t('errors.startRun'));
    }
  };

  const handleStartNewRun = useCallback(() => {
    setRunTransitionError(undefined);
    setRunSetupError(undefined);
    setIsRunSetupModalVisible(true);
  }, []);

  const handleRunTransition = useCallback(
    async (action: RunTransitionAction) => {
      if (!activeRun || !selectedEventId || !selectedLeaderboardId) return;

      setRunTransitionError(undefined);
      try {
        await transitionRunStatus({
          eventId: selectedEventId,
          leaderboardId: selectedLeaderboardId,
          runId: activeRun.runId,
          action,
        }).unwrap();
      } catch {
        setRunTransitionError(t('errors.transitionRun'));
      }
    },
    [activeRun, selectedEventId, selectedLeaderboardId, t, transitionRunStatus],
  );

  const handleDiscardRun = useCallback(async () => {
    if (!activeRun || !selectedEventId || !selectedLeaderboardId) return;

    setRunTransitionError(undefined);
    try {
      let runToDiscard: Run = activeRun;
      if (activeRun.runStatus === RunStatus.IN_PROGRESS || activeRun.runStatus === RunStatus.PAUSED) {
        const { run } = await transitionRunStatus({
          eventId: selectedEventId,
          leaderboardId: selectedLeaderboardId,
          runId: activeRun.runId,
          action: RunTransitionAction.FINISH,
        }).unwrap();
        runToDiscard = run;
      }
      await transitionRunStatus({
        eventId: selectedEventId,
        leaderboardId: selectedLeaderboardId,
        runId: runToDiscard.runId,
        action: RunTransitionAction.DISCARD,
      }).unwrap();
      if (fetchCarLogsOnRunFinish) {
        void (async () => {
          const deviceIds = [
            ...new Set(laps.map((lap) => lap.deviceId).filter((deviceId): deviceId is string => Boolean(deviceId))),
          ];
          if (deviceIds.length === 0) {
            dispatch(displayWarningNotification({ content: t('warnings.carLogFetchMissingDevice') }));
            return;
          }

          const racerName = profiles.find((profile) => profile.profileId === runToDiscard.profileId)?.alias;
          const results = await Promise.all(
            deviceIds.map(async (instanceId) => {
              try {
                await startCarLogFetch({
                  leaderboardId: selectedLeaderboardId,
                  runId: runToDiscard.runId,
                  instanceId,
                  laterThan: runToDiscard.createdAt,
                  ...(racerName ? { racerName } : {}),
                }).unwrap();
                return true;
              } catch {
                return false;
              }
            }),
          );

          if (results.some((result) => !result)) {
            dispatch(displayWarningNotification({ content: t('warnings.carLogFetchFailed') }));
          }
        })();
      }
      registerActiveRun(undefined);
    } catch {
      setRunTransitionError(t('errors.transitionRun'));
    }
  }, [
    activeRun,
    dispatch,
    fetchCarLogsOnRunFinish,
    laps,
    profiles,
    registerActiveRun,
    selectedEventId,
    selectedLeaderboardId,
    startCarLogFetch,
    t,
    transitionRunStatus,
  ]);

  const headerActions = (() => {
    if (!activeRun || activeRun.runStatus === RunStatus.SUBMITTED || activeRun.runStatus === RunStatus.DISCARDED) {
      return (
        <Button
          data-testid="start-new-run-button"
          disabled={!hasRunContext || isCreatingRun}
          loading={isCreatingRun}
          onClick={handleStartNewRun}
        >
          {t('actions.startNewRun')}
        </Button>
      );
    }

    if (activeRun.runStatus === RunStatus.READY) {
      return (
        <Button
          data-testid="discard-run-button"
          disabled={isTransitioning}
          loading={isTransitioning}
          onClick={() => handleDiscardRun()}
        >
          {t('actions.discardRun')}
        </Button>
      );
    }

    if (activeRun.runStatus === RunStatus.IN_PROGRESS || activeRun.runStatus === RunStatus.PAUSED) {
      return (
        <Button
          data-testid="discard-run-button"
          disabled={isTransitioning}
          loading={isTransitioning}
          onClick={() => handleDiscardRun()}
        >
          {t('actions.discardRun')}
        </Button>
      );
    }

    if (activeRun.runStatus === RunStatus.FINISHED) {
      return (
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            data-testid="resume-run-button"
            disabled={isTransitioning}
            loading={isTransitioning}
            onClick={() => handleRunTransition(RunTransitionAction.RESUME_FROM_FINISHED)}
          >
            {t('actions.RESUME_FROM_FINISHED')}
          </Button>
          <Button
            data-testid="discard-run-button"
            disabled={isTransitioning}
            loading={isTransitioning}
            onClick={() => handleDiscardRun()}
          >
            {t('actions.discardRun')}
          </Button>
          <Button
            data-testid="submit-run-button"
            disabled={isTransitioning}
            loading={isTransitioning}
            onClick={() => handleRunTransition(RunTransitionAction.SUBMIT)}
            variant="primary"
          >
            {t('actions.submitRun')}
          </Button>
        </SpaceBetween>
      );
    }

    return undefined;
  })();

  return (
    <ExpandableSection
      data-id="RunsTable"
      data-testid="runs-workflow"
      headerInfo={
        <StatusIndicator data-testid="active-run-status" type={activeRunStatusIndicator?.type ?? 'info'}>
          {activeRunStatusIndicator ? t(activeRunStatusIndicator.textKey) : t('runs.noRunInProgress')}
        </StatusIndicator>
      }
      headerActions={headerActions}
      headerCounter={`(${filteredItemsCount ?? items.length})`}
      headerText={t('runs.header')}
      variant="container"
    >
      {runTransitionError && (
        <Alert dismissible type="error" onDismiss={() => setRunTransitionError(undefined)}>
          {runTransitionError}
        </Alert>
      )}
      <Table<RunTableItem>
        {...collectionProps}
        columnDefinitions={getColumnDefinitions(t)}
        data-testid="runs-table"
        items={paginatedItems}
        loading={isLoading}
        trackBy="runId"
        variant="embedded"
        pagination={
          <Pagination
            {...paginationProps}
            ariaLabels={{
              nextPageLabel: t('runs.pagination.nextPageLabel'),
              previousPageLabel: t('runs.pagination.previousPageLabel'),
              pageLabel: (pageNumber: number) => t('runs.pagination.pageLabel', { pageNumber }),
            }}
          />
        }
        preferences={
          <CollectionPreferences
            title={t('runs.preferences.title')}
            confirmLabel={t('runs.preferences.confirmLabel')}
            cancelLabel={t('runs.preferences.cancelLabel')}
            preferences={preferences}
            onConfirm={({ detail }) => setPreferences(detail)}
            pageSizePreference={{
              title: t('runs.preferences.pageSizeTitle'),
              options: pageSizeOptions,
            }}
          />
        }
        filter={
          <PropertyFilter
            {...propertyFilterProps}
            i18nStrings={getPropertyFilterI18nStrings(tCommon, 'runs')}
            countText={`${filteredItemsCount ?? 0} ${t('runs.header')}`}
          />
        }
      />
      <RunSetupModal
        isVisible={isRunSetupModalVisible}
        isSubmitting={isCreatingRun}
        error={runSetupError}
        onDismiss={handleRunSetupDismiss}
        onNext={handleRunSetupNext}
        racerOptions={racerOptions}
        completedRacesByProfileId={completedRacesByProfileId}
        maxRaces={event?.maxRunsPerRacer}
      />
    </ExpandableSection>
  );
};
