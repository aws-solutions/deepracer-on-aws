// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Tabs from '@cloudscape-design/components/tabs';
import { UserGroups, type CarLogAsset } from '@deepracer-indy/typescript-client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCarLogsMqtt } from '#hooks/useCarLogsMqtt.js';
import { useListCarLogAssetsQuery, useListCarLogFetchesQuery } from '#services/deepRacer/carLogsApi.js';
import { useGetProfileQuery } from '#services/deepRacer/profileApi.js';
import { getUserGroups } from '#utils/authUtils.js';
import { canManageCarLogJobs, resolveCarLogsAccess } from '#utils/carLogsAccess.js';

import CarLogAssetsTable from './components/CarLogAssetsTable.js';
import CarLogProcessingTable from './components/CarLogProcessingTable.js';
import DeleteCarLogAssetsModal from './components/DeleteCarLogAssetsModal.js';
import DownloadCarLogAssetsModal from './components/DownloadCarLogAssetsModal.js';
import UploadCarLogsModal from './components/UploadCarLogsModal.js';
import { isCarLogFetchActive } from './utils.js';

const CAR_LOGS_POLLING_INTERVAL_MS = 15000;

interface CarLogsProps {
  /** `all` lists every racer's logs (Model Management); `mine` lists only the caller's own. */
  scope: 'all' | 'mine';
}

const CarLogs = ({ scope }: CarLogsProps) => {
  const { t } = useTranslation('carLogs');
  const [groups, setGroups] = useState<UserGroups[] | null>(null);
  const [downloadAssets, setDownloadAssets] = useState<CarLogAsset[] | null>(null);
  const [deleteAssets, setDeleteAssets] = useState<CarLogAsset[] | null>(null);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [jobsPollingInterval, setJobsPollingInterval] = useState(0);

  useEffect(() => {
    let isMounted = true;
    getUserGroups()
      .then((resolvedGroups) => {
        if (isMounted) setGroups(resolvedGroups);
      })
      .catch(() => {
        if (isMounted) setGroups([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const roleAccess = groups === null ? undefined : resolveCarLogsAccess(groups);
  const isAllScope = scope === 'all' && (roleAccess === 'manager' || roleAccess === 'viewer');
  // In the own-logs view everyone acts as the owner of the listed assets.
  const access = roleAccess === undefined ? undefined : isAllScope ? roleAccess : 'racer';
  const isManager = isAllScope && canManageCarLogJobs(roleAccess);
  const { data: profile } = useGetProfileQuery(undefined, { skip: groups === null || isAllScope });

  const fetchesQuery = useListCarLogFetchesQuery(undefined, {
    skip: !isManager,
    pollingInterval: jobsPollingInterval,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnMountOrArgChange: true,
  });
  const jobs = useMemo(() => fetchesQuery.data ?? [], [fetchesQuery.data]);
  const hasActiveJobs = jobs.some((job) => isCarLogFetchActive(job.status));
  useEffect(() => {
    setJobsPollingInterval(isManager && hasActiveJobs ? CAR_LOGS_POLLING_INTERVAL_MS : 0);
  }, [hasActiveJobs, isManager]);

  const {
    data: assets = [],
    isLoading: isLoadingAssets,
    isFetching: isFetchingAssets,
    refetch: refetchAssets,
  } = useListCarLogAssetsQuery(isAllScope ? undefined : { profileId: profile?.profileId }, {
    skip: groups === null || (!isAllScope && !profile),
    pollingInterval: hasActiveJobs ? CAR_LOGS_POLLING_INTERVAL_MS : 0,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnMountOrArgChange: true,
  });

  useCarLogsMqtt(scope);

  const tabs = useMemo(
    () => [
      {
        id: 'assets',
        label: t('tabs.assets'),
        content: (
          <CarLogAssetsTable
            access={access}
            showUserColumn={isAllScope}
            assets={assets}
            isFetching={isFetchingAssets}
            isLoading={isLoadingAssets}
            onRefresh={() => void refetchAssets()}
            onRequestDelete={(selectedAssets) => setDeleteAssets(selectedAssets)}
            onRequestDownload={(selectedAssets) => setDownloadAssets(selectedAssets)}
            onRequestUpload={() => setIsUploadModalVisible(true)}
          />
        ),
      },
      ...(isManager
        ? [
            {
              id: 'processing',
              label: t('tabs.processing'),
              content: (
                <CarLogProcessingTable
                  jobs={fetchesQuery.data ?? jobs}
                  isFetching={fetchesQuery.isFetching}
                  isLoading={fetchesQuery.isLoading}
                  onRefresh={() => void fetchesQuery.refetch()}
                />
              ),
            },
          ]
        : []),
    ],
    [access, assets, fetchesQuery, isAllScope, isFetchingAssets, isLoadingAssets, isManager, jobs, refetchAssets, t],
  );

  const pageDescription =
    access === 'manager'
      ? t('page.description.manager')
      : access === 'viewer'
        ? t('page.description.viewer')
        : t('page.description.racer');

  return (
    <>
      <ContentLayout
        header={
          <Header description={pageDescription} variant="h1">
            {t('page.header')}
          </Header>
        }
      >
        <Tabs tabs={tabs} variant="container" />
      </ContentLayout>
      {downloadAssets && (
        <DownloadCarLogAssetsModal assets={downloadAssets} isVisible onDismiss={() => setDownloadAssets(null)} />
      )}
      {deleteAssets && (
        <DeleteCarLogAssetsModal assets={deleteAssets} isVisible onDismiss={() => setDeleteAssets(null)} />
      )}
      {isUploadModalVisible && <UploadCarLogsModal isVisible onDismiss={() => setIsUploadModalVisible(false)} />}
    </>
  );
};

export default CarLogs;
