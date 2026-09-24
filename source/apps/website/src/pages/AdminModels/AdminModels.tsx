// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import PropertyFilter from '@cloudscape-design/components/property-filter';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import { AdminModelExtended, ModelSource, ModelStatus, OptimizationStatus } from '@deepracer-indy/typescript-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPropertyFilterI18nStrings } from '#components/PropertyFilterI18nStrings/index.js';
import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { LIST_MODELS_POLLING_INTERVAL_TIME, OPTIMIZE_TIMEOUT_MS } from '#pages/ModelDetails/constants.js';
import { useLazyGetAdminAssetUrlQuery, useListAdminModelsQuery } from '#services/deepRacer/adminApi.js';
import { usePackageModelMutation } from '#services/deepRacer/modelsApi.js';
import {
  displayErrorNotification,
  displayInfoNotification,
  displaySuccessNotification,
  displayWarningNotification,
} from '#store/notifications/notificationsSlice.js';

import { useAdminModelsTableConfig } from './components/AdminModelsTableConfig.js';
import CarUploadModal from './components/CarUploadModal.js';

/** Model is eligible for optimization if it's READY, not already optimized/in-progress, and not physical. */
const isEligibleForOptimize = (m: AdminModelExtended): boolean =>
  m.status === ModelStatus.READY &&
  m.optimizationStatus !== OptimizationStatus.OPTIMIZED &&
  m.optimizationStatus !== OptimizationStatus.IN_PROGRESS &&
  m.modelSource !== ModelSource.IMPORTED_PHYSICAL;

const AdminModels = () => {
  const { t } = useTranslation('adminModels');
  const { t: tCommon } = useTranslation('common');
  const dispatch = useAppDispatch();
  const [adminPollingInterval, setAdminPollingInterval] = useState(LIST_MODELS_POLLING_INTERVAL_TIME);
  const { data, isLoading, isFetching, isError, refetch } = useListAdminModelsQuery(
    {},
    {
      pollingInterval: adminPollingInterval,
      refetchOnFocus: true,
    },
  );
  const models = useMemo(() => data ?? [], [data]);
  const [triggerGetUrl] = useLazyGetAdminAssetUrlQuery();
  const [packageModel, { isLoading: isPackageModelLoading }] = usePackageModelMutation();
  const [selectedModels, setSelectedModels] = useState<AdminModelExtended[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [optimizingModelId, setOptimizingModelId] = useState<string | null>(null);

  useEffect(() => {
    const hasActive =
      optimizingModelId !== null ||
      models.some((m) => m.status === ModelStatus.IMPORTING || m.optimizationStatus === OptimizationStatus.IN_PROGRESS);
    setAdminPollingInterval(hasActive ? LIST_MODELS_POLLING_INTERVAL_TIME : 0);
  }, [models, optimizingModelId]);

  // Prune stale selections when models refetch (status may have changed)
  const pruneSelections = useCallback(
    (prev: AdminModelExtended[]): AdminModelExtended[] =>
      prev
        .map((s) => models.find((m) => m.modelId === s.modelId))
        .filter((m): m is AdminModelExtended => m !== undefined && m.status === ModelStatus.READY),
    [models],
  );

  useEffect(() => {
    setSelectedModels(pruneSelections);
  }, [pruneSelections]);

  // Clear optimizing lock once polling confirms the model has transitioned, and notify on completion
  useEffect(() => {
    if (!optimizingModelId) return;
    const model = models.find((m) => m.modelId === optimizingModelId);
    if (!model) return;

    if (model.optimizationStatus === OptimizationStatus.OPTIMIZED) {
      dispatch(displaySuccessNotification({ content: t('actions.optimizeComplete', { modelName: model.name }) }));
      setOptimizingModelId(null);
    } else if (model.optimizationStatus === OptimizationStatus.FAILED) {
      dispatch(displayErrorNotification({ content: t('actions.optimizeAsyncFailed', { modelName: model.name }) }));
      setOptimizingModelId(null);
    }
  }, [models, optimizingModelId, dispatch, t]);

  // Timeout fallback: if no status transition detected, notify admin and clear lock
  const modelsRef = useRef(models);
  modelsRef.current = models;

  useEffect(() => {
    if (!optimizingModelId) return;
    const timer = setTimeout(() => {
      const model = modelsRef.current.find((m) => m.modelId === optimizingModelId);
      const content = model
        ? t('actions.optimizeTimeout', { modelName: model.name })
        : t('actions.optimizeTimeoutGeneric');
      dispatch(displayWarningNotification({ content }));
      setOptimizingModelId(null);
    }, OPTIMIZE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [optimizingModelId, dispatch, t]);

  const eligibleForOptimize = selectedModels.filter((m) => isEligibleForOptimize(m) && m.modelId !== optimizingModelId);
  const isOptimizeDisabled = selectedModels.length !== 1 || eligibleForOptimize.length !== 1;

  const handleOptimize = async () => {
    if (eligibleForOptimize.length !== 1) return;

    const model = eligibleForOptimize[0];
    setOptimizingModelId(model.modelId);

    try {
      await packageModel({ modelId: model.modelId, profileId: model.profileId }).unwrap();
      dispatch(displayInfoNotification({ content: t('actions.optimizeStarted', { modelName: model.name }) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      console.error('[AdminModels] Optimize failed', { modelId: model.modelId, message });
      setOptimizingModelId(null);
      dispatch(displayErrorNotification({ content: t('actions.optimizeFailed', { modelName: model.name }) }));
    }
  };

  const handleDownload = useCallback(
    async (model: AdminModelExtended) => {
      setDownloadingId(model.modelId);
      try {
        const result = await triggerGetUrl({ modelId: model.modelId, profileId: model.profileId });
        if (result.data) {
          const a = document.createElement('a');
          a.href = result.data.url;
          a.download = result.data.filename;
          a.click();
          dispatch(displaySuccessNotification({ content: t('table.downloadSuccess', { modelName: model.name }) }));
        } else {
          dispatch(displayErrorNotification({ content: t('table.downloadFailed', { modelName: model.name }) }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : undefined;
        console.error('[AdminModels] Download failed', { modelId: model.modelId, message });
        dispatch(displayErrorNotification({ content: t('table.downloadFailed', { modelName: model.name }) }));
      } finally {
        setDownloadingId(null);
      }
    },
    [triggerGetUrl, dispatch, t],
  );

  const {
    items,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
    columnDefinitions,
    columnDisplay,
    preferences,
    adminModelsPreferences,
  } = useAdminModelsTableConfig(models, handleDownload, downloadingId);

  const isItemDisabled = (item: AdminModelExtended) => item.status !== ModelStatus.READY;

  const isUploadDisabled =
    selectedModels.length === 0 || !selectedModels.every((m) => m.optimizationStatus === OptimizationStatus.OPTIMIZED);

  return (
    <>
      {isError && (
        <Alert type="error" action={<Button onClick={() => refetch()}>{t('table.retry')}</Button>}>
          {t('table.error')}
        </Alert>
      )}
      <Table
        {...collectionProps}
        onSelectionChange={({ detail }) => setSelectedModels(detail.selectedItems)}
        selectedItems={selectedModels}
        selectionType="multi"
        isItemDisabled={isItemDisabled}
        columnDefinitions={columnDefinitions}
        items={items}
        loading={isLoading}
        loadingText={t('table.loading')}
        stripedRows={preferences.stripedRows}
        contentDensity={preferences.contentDensity}
        wrapLines={preferences.wrapLines}
        stickyHeader
        trackBy="modelId"
        resizableColumns
        header={
          <Header
            counter={`(${filteredItemsCount ?? models.length})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel={t('actions.refresh')}
                  loading={isFetching}
                  disabled={isFetching}
                  onClick={() => refetch()}
                />
                <Button disabled={selectedModels.length === 0} onClick={() => setSelectedModels([])}>
                  {t('actions.clearSelected')}
                </Button>
                <Button
                  disabled={isOptimizeDisabled}
                  disabledReason={t('actions.optimizeDisabledReason')}
                  loading={isPackageModelLoading}
                  onClick={handleOptimize}
                >
                  {t('actions.optimizeForCar')}
                </Button>
                <Button variant="primary" disabled={isUploadDisabled} onClick={() => setUploadModalVisible(true)}>
                  {t('actions.uploadToCar')}
                </Button>
              </SpaceBetween>
            }
          >
            {t('header')}
          </Header>
        }
        filter={
          <PropertyFilter
            {...propertyFilterProps}
            i18nStrings={getPropertyFilterI18nStrings(tCommon, 'models')}
            countText={`${filteredItemsCount ?? 0} ${t('filter.matches')}`}
            expandToViewport
          />
        }
        pagination={<Pagination {...paginationProps} />}
        columnDisplay={columnDisplay}
        preferences={adminModelsPreferences}
      />
      <CarUploadModal
        visible={uploadModalVisible}
        models={selectedModels}
        onDismiss={() => {
          setUploadModalVisible(false);
          void refetch(); // NOSONAR - void on Promise is the @typescript-eslint/no-floating-promises idiom; S3735 fix merged upstream (SonarJS#7489)
        }}
      />
    </>
  );
};

export default AdminModels;
