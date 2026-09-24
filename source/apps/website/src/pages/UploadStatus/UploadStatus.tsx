// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import BarChart from '@cloudscape-design/components/bar-chart';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import PropertyFilter from '@cloudscape-design/components/property-filter';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import { DeploymentStatus } from '@deepracer-indy/typescript-client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPropertyFilterI18nStrings } from '#components/PropertyFilterI18nStrings/index.js';
import { useLocalStorage } from '#hooks/useLocalStorage.js';
import { DEPLOYMENT_POLLING_INTERVAL_TIME } from '#pages/ModelDetails/constants.js';
import { useListEventsQuery } from '#services/deepRacer/eventsApi.js';
import { useListDeploymentsByEventQuery } from '#services/deepRacer/modelsApi.js';

import { useUploadStatusTableConfig } from './components/UploadStatusTableConfig.js';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#687078',
  IN_PROGRESS: '#0972d3',
  COMPLETED: '#037f0c',
  FAILED: '#d91515',
};

const UploadStatus = () => {
  const { t } = useTranslation('uploadStatus');
  const { t: tCommon } = useTranslation('common');

  const { data: events = [] } = useListEventsQuery({});
  const eventOptions: SelectProps.Option[] = useMemo(
    () => events.map((e) => ({ value: e.eventId, label: e.name })),
    [events],
  );

  const [persistedEventId, setPersistedEventId] = useLocalStorage<string | null>(
    'deepracer-admin-models-selected-event',
    null,
  );
  const selectedEvent = useMemo(
    () => eventOptions.find((o) => o.value === persistedEventId) ?? null,
    [eventOptions, persistedEventId],
  );

  const [deploymentPollingInterval, setDeploymentPollingInterval] = useState(DEPLOYMENT_POLLING_INTERVAL_TIME);

  const {
    data: deployments = [],
    isLoading,
    isFetching,
    refetch,
  } = useListDeploymentsByEventQuery(
    { eventId: persistedEventId ?? '' },
    {
      skip: !persistedEventId,
      pollingInterval: deploymentPollingInterval,
      skipPollingIfUnfocused: true,
      refetchOnFocus: true,
    },
  );

  useEffect(() => {
    const hasActive = deployments.some(
      (d) => d.status === DeploymentStatus.PENDING || d.status === DeploymentStatus.IN_PROGRESS,
    );
    setDeploymentPollingInterval(hasActive ? DEPLOYMENT_POLLING_INTERVAL_TIME : 0);
  }, [deployments]);

  const {
    items,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
    columnDefinitions,
    columnDisplay,
    preferences,
    uploadStatusPreferences,
  } = useUploadStatusTableConfig(deployments);

  // ── Summary chart: horizontal stacked bars (Status + Car + Job rows) ─────
  const summaryChartSeries = useMemo(() => {
    const statusCounts = deployments.reduce<Record<string, number>>((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {});

    const carCounts = deployments.reduce<Record<string, number>>((acc, d) => {
      const name = d.carName ?? 'Unknown';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    const jobCounts = deployments.reduce<Record<string, number>>((acc, d) => {
      const job = d.batchId ?? d.deploymentId;
      acc[job] = (acc[job] || 0) + 1;
      return acc;
    }, {});

    return [
      ...Object.entries(statusCounts).map(([key, value]) => ({
        title: key,
        type: 'bar' as const,
        data: [{ x: 'Status', y: value }],
        color: STATUS_COLORS[key] ?? '#687078',
      })),
      ...Object.entries(carCounts).map(([key, value]) => ({
        title: key,
        type: 'bar' as const,
        data: [{ x: 'Car', y: value }],
      })),
      ...Object.entries(jobCounts).map(([key, value]) => ({
        title: key.slice(0, 8),
        type: 'bar' as const,
        data: [{ x: 'Job', y: value }],
      })),
    ];
  }, [deployments]);

  // ── Duration BarChart data (upload time over time) ──────────────────────
  const durationBarData = useMemo(() => {
    return deployments
      .filter(
        (d): d is typeof d & { uploadStartedAt: Date; completedAt: Date } =>
          d.uploadStartedAt != null && d.completedAt != null,
      )
      .map((d) => {
        const start = new Date(d.uploadStartedAt);
        return {
          x: start.toISOString(),
          y: (new Date(d.completedAt).getTime() - start.getTime()) / 1000,
        };
      })
      .sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());
  }, [deployments]);

  const maxDuration = useMemo(() => {
    if (durationBarData.length === 0) return 30;
    return Math.ceil(Math.max(...durationBarData.map((d) => d.y))) + 5;
  }, [durationBarData]);

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              iconName="refresh"
              ariaLabel={t('actions.refresh')}
              loading={isFetching}
              onClick={() => refetch()}
            />
          </SpaceBetween>
        }
      >
        {t('header')}
      </Header>

      <Select
        selectedOption={selectedEvent}
        onChange={({ detail }) => setPersistedEventId(detail.selectedOption.value ?? null)}
        options={eventOptions}
        placeholder={t('eventSelector.placeholder')}
        empty={t('eventSelector.empty')}
      />

      {!persistedEventId && (
        <Box textAlign="center" color="text-body-secondary" padding="l">
          {t('eventSelector.hint')}
        </Box>
      )}

      {persistedEventId && (
        <>
          <ColumnLayout columns={2}>
            <Container
              header={
                <Header variant="h3" description={t('charts.summary.subtitle')}>
                  {t('charts.summary.header')}
                </Header>
              }
            >
              <BarChart
                series={summaryChartSeries}
                height={250}
                hideFilter
                hideLegend
                horizontalBars
                stackedBars
                xScaleType="categorical"
                xTitle=" "
                empty={
                  <Box textAlign="center" color="inherit">
                    <b>{t('charts.empty')}</b>
                  </Box>
                }
              />
            </Container>
            <Container
              header={
                <Header variant="h3" description={t('charts.duration.subtitle')}>
                  {t('charts.duration.header')}
                </Header>
              }
            >
              <BarChart
                series={[{ title: t('charts.duration.seriesTitle'), type: 'bar', data: durationBarData }]}
                height={250}
                hideFilter
                hideLegend
                xScaleType="categorical"
                xTickFormatter={(iso) =>
                  new Date(iso).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: false,
                  })
                }
                yDomain={[0, maxDuration]}
                xTitle={`${t('charts.duration.xTitle')} (${new Date().toLocaleTimeString(undefined, { timeZoneName: 'short' }).split(' ').pop()})`}
                i18nStrings={{
                  yTickFormatter: (e) => `${e}s`,
                }}
                empty={
                  <Box textAlign="center" color="inherit">
                    <b>{t('charts.empty')}</b>
                  </Box>
                }
              />
            </Container>
          </ColumnLayout>

          <Table
            {...collectionProps}
            columnDefinitions={columnDefinitions}
            items={items}
            loading={isLoading}
            loadingText={t('table.loading')}
            stickyHeader
            trackBy="deploymentId"
            resizableColumns
            header={<Header counter={`(${filteredItemsCount ?? deployments.length})`}>{t('table.header')}</Header>}
            filter={
              <PropertyFilter
                {...propertyFilterProps}
                i18nStrings={getPropertyFilterI18nStrings(tCommon, 'deployments')}
                countText={`${filteredItemsCount ?? 0} ${t('table.matches')}`}
                expandToViewport
              />
            }
            pagination={<Pagination {...paginationProps} />}
            stripedRows={preferences.stripedRows}
            wrapLines={preferences.wrapLines}
            contentDensity={preferences.contentDensity}
            columnDisplay={columnDisplay}
            preferences={uploadStatusPreferences}
          />
        </>
      )}
    </SpaceBetween>
  );
};

export default UploadStatus;
