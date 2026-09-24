// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCollection } from '@cloudscape-design/collection-hooks';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Checkbox from '@cloudscape-design/components/checkbox';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import { AdminModelExtended, DeploymentStatus, DeploymentSummary, Device } from '@deepracer-indy/typescript-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { useLocalStorage } from '#hooks/useLocalStorage.js';
import { DEPLOYMENT_POLLING_INTERVAL_TIME } from '#pages/ModelDetails/constants.js';
import { useClearDeviceModelsMutation, useListDevicesQuery } from '#services/deepRacer/devicesApi.js';
import { useListEventsQuery } from '#services/deepRacer/eventsApi.js';
import { useDeployModelMutation, useListDeploymentsByBatchQuery } from '#services/deepRacer/modelsApi.js';
import { displayErrorNotification, displayWarningNotification } from '#store/notifications/notificationsSlice.js';
import { generateResourceId } from '#utils/resourceUtils.js';

const TERMINAL_STATUSES = new Set<DeploymentStatus>([DeploymentStatus.COMPLETED, DeploymentStatus.FAILED]);

interface CarUploadModalProps {
  visible: boolean;
  models: AdminModelExtended[];
  onDismiss: () => void;
}

type ModalView = 'selectCar' | 'confirmClear' | 'progress';

const CarUploadModal = ({ visible, models, onDismiss }: CarUploadModalProps) => {
  const { t } = useTranslation('adminModels', { keyPrefix: 'upload' });
  const { data: cars = [], isLoading: isCarsLoading } = useListDevicesQuery(
    { deviceType: 'CAR', status: 'ONLINE' },
    { skip: !visible },
  );
  const { data: events = [] } = useListEventsQuery({}, { skip: !visible });

  const eventOptions: SelectProps.Option[] = useMemo(
    () => events.map((e) => ({ value: e.eventId, label: e.name })),
    [events],
  );

  const [selectedCar, setSelectedCar] = useState<Device[]>([]);
  const [persistedEventId, setPersistedEventId] = useLocalStorage<string | null>(
    'deepracer-admin-models-selected-event',
    null,
  );
  const selectedEvent = useMemo(
    () => eventOptions.find((o) => o.value === persistedEventId) ?? null,
    [eventOptions, persistedEventId],
  );
  const [clearFirst, setClearFirst] = useState(true);
  const [view, setView] = useState<ModalView>('selectCar');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);

  const [deployModel] = useDeployModelMutation();
  const [clearDeviceModels] = useClearDeviceModelsMutation();
  const dispatch = useAppDispatch();

  // Poll batch deployments at 3s while deploying; stop when all terminal
  const { data: deployments = [] } = useListDeploymentsByBatchQuery(
    { batchId: batchId ?? '' },
    {
      skip: !batchId,
      pollingInterval: isDeploying ? DEPLOYMENT_POLLING_INTERVAL_TIME : 0,
      skipPollingIfUnfocused: true,
      refetchOnFocus: true,
    },
  );

  const [expectedCount, setExpectedCount] = useState(0);

  const completedCount = deployments.filter((d) => TERMINAL_STATUSES.has(d.status)).length;
  const failedCount = deployments.filter((d) => d.status === DeploymentStatus.FAILED).length;
  const progress = expectedCount > 0 ? Math.round((completedCount / expectedCount) * 100) : 0;
  const allTerminal = expectedCount > 0 && completedCount >= expectedCount && deployments.length >= expectedCount;

  // Stop polling when all terminal
  useEffect(() => {
    if (allTerminal) {
      setIsDeploying(false);
    }
  }, [allTerminal]);

  // Timeout fallback: stop polling after 10 minutes if not all deployments completed
  useEffect(() => {
    if (!isDeploying) return;
    const timer = setTimeout(
      () => {
        setIsDeploying(false);
        dispatch(displayWarningNotification({ content: t('deployTimeout') }));
      },
      10 * 60 * 1000,
    );
    return () => clearTimeout(timer);
  }, [isDeploying, dispatch, t]);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setSelectedCar([]);
      setClearFirst(true);
      setView('selectCar');
      setBatchId(null);
      setIsDeploying(false);
      setExpectedCount(0);
    }
  }, [visible]);

  const handleDeploy = useCallback(async () => {
    if (selectedCar.length === 0 || !selectedEvent?.value) return;
    const car = selectedCar[0];
    const newBatchId = generateResourceId();
    setBatchId(newBatchId);
    setIsDeploying(true);
    setView('progress');

    // If clear first: await the clear (handler polls SSM to completion), then deploy
    if (clearFirst) {
      try {
        await clearDeviceModels({ instanceId: car.instanceId }).unwrap();
      } catch {
        dispatch(displayErrorNotification({ content: t('clearFailed') }));
        setIsDeploying(false);
        setView('selectCar');
        setBatchId(null);
        return;
      }
    }

    // All models in parallel
    const results = await Promise.allSettled(
      models.map((model) =>
        deployModel({
          modelId: model.modelId,
          profileId: model.profileId,
          carInstanceId: car.instanceId,
          eventId: selectedEvent?.value ?? '',
          batchId: newBatchId,
        }).unwrap(),
      ),
    );

    // Notify on dispatch failures
    const failed = results.map((r, i) => (r.status === 'rejected' ? models[i].name : null)).filter(Boolean);
    const dispatched = models.length - failed.length;
    setExpectedCount(dispatched);

    if (failed.length > 0) {
      const content =
        clearFirst && dispatched === 0
          ? t('clearSucceededButAllDeploysFailed', { models: failed.join(', ') })
          : t('deployDispatchFailed', { models: failed.join(', ') });
      dispatch(displayErrorNotification({ content }));
    }
    // If no dispatches succeeded, no records will ever exist — stop polling and reset view
    if (dispatched === 0) {
      setIsDeploying(false);
      setView('selectCar');
      setBatchId(null);
    }
  }, [selectedCar, selectedEvent, models, deployModel, clearDeviceModels, clearFirst, dispatch, t]);

  const handleOk = useCallback(async () => {
    if (selectedCar.length === 0 || !selectedEvent?.value) return;
    if (clearFirst) {
      setView('confirmClear');
    } else {
      await handleDeploy();
    }
  }, [selectedCar, selectedEvent, clearFirst, handleDeploy]);

  const { items, collectionProps } = useCollection(cars, {
    sorting: { defaultState: { sortingColumn: { sortingField: 'name' } } },
    selection: {},
  });

  // ── Car Selector View ──────────────────────────────────────────────────────
  const carSelectorContent = (
    <SpaceBetween size="m">
      <FormField label={t('event')}>
        <Select
          selectedOption={selectedEvent}
          onChange={({ detail }) => setPersistedEventId(detail.selectedOption.value ?? null)}
          options={eventOptions}
          placeholder={t('selectEvent')}
          loadingText={t('loadingEvents')}
        />
      </FormField>
      <Table
        {...collectionProps}
        onSelectionChange={({ detail }) => setSelectedCar(detail.selectedItems)}
        selectedItems={selectedCar}
        selectionType="single"
        items={items}
        loading={isCarsLoading}
        loadingText={t('loadingCars')}
        trackBy="instanceId"
        variant="embedded"
        empty={
          <Box textAlign="center" padding="l">
            <Box variant="strong">{t('noCars')}</Box>
            <Box color="text-body-secondary">{t('noCarsDescription')}</Box>
          </Box>
        }
        columnDefinitions={[
          { id: 'name', header: t('columns.name'), cell: (d) => d.name, sortingField: 'name' },
          { id: 'ipAddress', header: t('columns.ipAddress'), cell: (d) => d.ipAddress ?? '—' },
          { id: 'fleetId', header: t('columns.fleet'), cell: (d) => d.fleetId ?? '—' },
          { id: 'status', header: t('columns.status'), cell: (d) => d.status },
        ]}
      />
      <Checkbox checked={clearFirst} onChange={({ detail }) => setClearFirst(detail.checked)}>
        {t('clearFirst')}
      </Checkbox>
    </SpaceBetween>
  );

  // ── Confirm Clear View ─────────────────────────────────────────────────────
  const confirmClearContent = (
    <SpaceBetween size="m">
      <Box>{t('confirmClear.message')}</Box>
      <Box variant="strong">{selectedCar[0]?.name}</Box>
    </SpaceBetween>
  );

  // ── Progress View ──────────────────────────────────────────────────────────
  const renderDeploymentStatus = (d: DeploymentSummary) => {
    switch (d.status) {
      case DeploymentStatus.COMPLETED:
        return <StatusIndicator type="success">{t('deployStatus.completed')}</StatusIndicator>;
      case DeploymentStatus.IN_PROGRESS:
        return <StatusIndicator type="in-progress">{t('deployStatus.inProgress')}</StatusIndicator>;
      case DeploymentStatus.FAILED:
        return (
          <StatusIndicator type="error">
            {d.errorMessage ? `${t('deployStatus.failed')}: ${d.errorMessage}` : t('deployStatus.failed')}
          </StatusIndicator>
        );
      default:
        return <StatusIndicator type="pending">{t('deployStatus.pending')}</StatusIndicator>;
    }
  };

  let progressStatus: 'error' | 'success' | undefined;
  let progressResultText: string | undefined;
  if (allTerminal && failedCount > 0) {
    progressStatus = 'error';
    progressResultText = t('deployResult.failed', { failedCount, expectedCount });
  } else if (allTerminal) {
    progressStatus = 'success';
    progressResultText = t('deployResult.completed', { expectedCount });
  }

  const progressContent = (
    <SpaceBetween size="m">
      <ProgressBar
        value={progress}
        label={t('progress')}
        status={progressStatus}
        resultText={progressResultText}
        additionalInfo={allTerminal && failedCount > 0 ? t('deployStatus.failed') : undefined}
      />
      <Table
        items={deployments}
        trackBy="deploymentId"
        variant="embedded"
        columnDefinitions={[
          {
            id: 'status',
            header: t('progressColumns.status'),
            cell: renderDeploymentStatus,
          },
          { id: 'modelName', header: t('progressColumns.modelName'), cell: (d) => d.modelName ?? d.modelId },
          { id: 'carName', header: t('progressColumns.carName'), cell: (d) => d.carName ?? '—' },
          {
            id: 'duration',
            header: t('progressColumns.duration'),
            cell: (d) => {
              if (!d.uploadStartedAt || !d.completedAt) return '—';
              const duration = (new Date(d.completedAt).getTime() - new Date(d.uploadStartedAt).getTime()) / 1000;
              return `${duration.toFixed(1)}s`;
            },
          },
        ]}
      />
    </SpaceBetween>
  );

  const modalHeader = (() => {
    switch (view) {
      case 'confirmClear':
        return t('confirmClear.header');
      case 'progress':
        return t('progressHeader');
      default:
        return t('header');
    }
  })();

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={modalHeader}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            {view === 'selectCar' && (
              <>
                <Button onClick={onDismiss}>{t('cancel')}</Button>
                <Button
                  variant="primary"
                  disabled={selectedCar.length === 0 || !selectedEvent?.value || isDeploying}
                  onClick={handleOk}
                >
                  {t('confirm')}
                </Button>
              </>
            )}
            {view === 'confirmClear' && (
              <>
                <Button onClick={() => setView('selectCar')}>{t('cancel')}</Button>
                <Button variant="primary" onClick={handleDeploy} disabled={isDeploying}>
                  {t('confirmClear.confirm')}
                </Button>
              </>
            )}
            {view === 'progress' && (
              <Button variant="primary" onClick={onDismiss}>
                {t('close')}
              </Button>
            )}
          </SpaceBetween>
        </Box>
      }
    >
      {view === 'selectCar' && carSelectorContent}
      {view === 'confirmClear' && confirmClearContent}
      {view === 'progress' && progressContent}
    </Modal>
  );
};

export default CarUploadModal;
