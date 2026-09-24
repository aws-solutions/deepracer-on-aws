// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Modal } from '@cloudscape-design/components';
import Alert from '@cloudscape-design/components/alert';
import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Flashbar from '@cloudscape-design/components/flashbar';
import Header from '@cloudscape-design/components/header';
import Popover from '@cloudscape-design/components/popover';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Tabs from '@cloudscape-design/components/tabs';
import { Evaluation, ModelSource, ModelStatus, AssetType, Model } from '@deepracer-indy/typescript-client';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { PageId } from '#constants/pages';
import { useAppDispatch } from '#hooks/useAppDispatch';
import { createCloneModelFormValues } from '#pages/Models/utils';
import { useGetEvaluationQuery, useListEvaluationsQuery } from '#services/deepRacer/evaluationsApi';
import {
  modelsApi,
  useDeleteModelMutation,
  useGetAssetUrlMutation,
  useGetModelQuery,
  useRetryTrainingMutation,
} from '#services/deepRacer/modelsApi';
import { useGetProfileQuery } from '#services/deepRacer/profileApi.js';
import {
  displayErrorNotification,
  displayInfoNotification,
  displaySuccessNotification,
} from '#store/notifications/notificationsSlice';
import { getPath } from '#utils/pageUtils';

import EvaluationTab from './components/EvaluationTab';
import TrainingTab from './components/TrainingTab';
import { POLLING_INTERVAL_TIME, TERMINAL_EVALUATION_STATUSES } from './constants';
import { useModelDetailsNotifications } from './useModelDetailsNotifications';

enum ActionButtonId {
  CLONE = 'clone',
  DELETE = 'delete',
  DOWNLOAD = 'download',
  VIRTUALDOWNLOAD = 'virtualDownload',
}

const getStatusIndicatorType = (status: ModelStatus) => {
  switch (status) {
    case ModelStatus.READY:
      return 'success';
    case ModelStatus.ERROR:
      return 'error';
    case ModelStatus.QUEUED:
      return 'pending';
    // Distinct from QUEUED: no workflow message is queued and the job will not start until the user
    // retries it.
    case ModelStatus.WAITING_FOR_CAPACITY:
      return 'warning';
    case ModelStatus.IMPORTING:
      return 'info';
    default:
      return 'in-progress';
  }
};

const ModelDetails = () => {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation('modelDetails');
  const { t: tCommon } = useTranslation('common', { keyPrefix: 'modelStatus' });
  const [activeTabId, setActiveTabId] = useState(location.state?.activeTabId ?? 'training');
  const [successMessage, setSuccessMessage] = useState(() => {
    const msg = location.state?.successMessage;
    if (msg) window.history.replaceState({}, '');
    return msg;
  });
  const [showModal, setShowModal] = useState(false);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<Model>();

  const { modelId = '' } = useParams();
  useGetProfileQuery();
  const modelStatusRef = useRef<ModelStatus>();

  const { listModelResult } = modelsApi.endpoints.listModels.useQueryState(undefined, {
    selectFromResult: ({ data }) => ({ listModelResult: data?.find((m) => m.modelId === modelId) }),
  });

  const { data: getModelResult, isLoading: isGetModelLoading } = useGetModelQuery(
    { modelId },
    {
      pollingInterval: POLLING_INTERVAL_TIME,
      skipPollingIfUnfocused: true,
      skip:
        !successMessage &&
        (modelStatusRef.current === ModelStatus.ERROR || modelStatusRef.current === ModelStatus.READY),
    },
  );

  const model = getModelResult ?? listModelResult;
  const isPhysicalModel = model?.modelSource === ModelSource.IMPORTED_PHYSICAL;

  const { data: evaluations = [], isLoading: isListEvaluationsLoading } = useListEvaluationsQuery({ modelId });

  const latestEvaluation: Evaluation | undefined = evaluations[0];

  // Poll latest evaluation until terminal. Result is patched into ListEvaluationsQuery cache in evaluationsApi.
  useGetEvaluationQuery(latestEvaluation ? { evaluationId: latestEvaluation.evaluationId, modelId } : skipToken, {
    pollingInterval: POLLING_INTERVAL_TIME,
    skipPollingIfUnfocused: true,
    skip: TERMINAL_EVALUATION_STATUSES.includes(latestEvaluation?.status),
  });

  const [deleteModel, { isLoading: isDeleteModelLoading }] = useDeleteModelMutation();
  const [retryTraining, { isLoading: isRetryTrainingLoading }] = useRetryTrainingMutation();
  useModelDetailsNotifications(model, latestEvaluation);

  const isWaitingForCapacity = model?.status === ModelStatus.WAITING_FOR_CAPACITY;

  const onRetryTraining = async () => {
    try {
      const response = await retryTraining({ modelId }).unwrap();

      if (response.status === ModelStatus.QUEUED) {
        dispatch(
          displaySuccessNotification({
            content: response.message ?? t('notifications.retryTrainingQueued', { modelName: model?.name }),
          }),
        );
      } else {
        // Capacity is still unavailable (or could not be verified). The model stays
        // WAITING_FOR_CAPACITY and the user can retry again later.
        dispatch(
          displayInfoNotification({
            content: response.message ?? t('notifications.retryTrainingStillWaiting'),
          }),
        );
      }
    } catch {
      dispatch(displayErrorNotification({ content: t('notifications.retryTrainingError') }));
    } finally {
      setShowRetryModal(false);
    }
  };

  useEffect(() => {
    modelStatusRef.current = model?.status;
  }, [model?.status]);

  const [getAssetUrl, { isLoading: isGetAssetUrlLoading }] = useGetAssetUrlMutation();
  const [isPollingVirtualModel, setIsPollingVirtualModel] = useState(false);

  useEffect(() => {
    let downloadPollTimer: ReturnType<typeof setInterval>;

    if (isPollingVirtualModel) {
      downloadPollTimer = globalThis.setInterval(async () => {
        try {
          const response = await getAssetUrl({
            modelId,
            assetType: AssetType.VIRTUAL_MODEL,
          }).unwrap();

          if (response && response !== ModelStatus.QUEUED) {
            window.location.href = response;
            setIsPollingVirtualModel(false);
            dispatch(
              displaySuccessNotification({
                content: t('notifications.virtualDownloadModelSuccess', { modelName: model?.name }),
              }),
            );
            globalThis.clearInterval(downloadPollTimer);
          }
        } catch (error) {
          setIsPollingVirtualModel(false);
          globalThis.clearInterval(downloadPollTimer);
        }
      }, POLLING_INTERVAL_TIME * 2); // 20 seconds
    }

    return () => {
      if (downloadPollTimer) {
        globalThis.clearInterval(downloadPollTimer);
      }
    };
  }, [isPollingVirtualModel, modelId, getAssetUrl, dispatch, t, model?.name]);

  useEffect(() => {
    return () => {
      setIsPollingVirtualModel(false);
    };
  }, []);

  if (!model && isGetModelLoading) {
    return <Spinner data-testid="model-loading-spinner" />;
  }

  if (!model) {
    return (
      <Box textAlign="center" variant="pre">
        {t('modelDoesNotExist')}
      </Box>
    );
  }

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <ButtonDropdown
                // TODO: Add additional loading states from other mutations
                loading={isDeleteModelLoading || isGetAssetUrlLoading || isPollingVirtualModel}
                onItemClick={async ({ detail }) => {
                  switch (detail.id) {
                    case ActionButtonId.CLONE:
                      navigate(getPath(PageId.CREATE_MODEL), {
                        state: {
                          clonedModelFormValues: createCloneModelFormValues(model),
                        },
                      });
                      break;
                    case ActionButtonId.DELETE:
                      setModelToDelete(model);
                      setShowModal(true);
                      break;
                    case ActionButtonId.DOWNLOAD:
                      await getAssetUrl({
                        modelId,
                        assetType: 'PHYSICAL_CAR_MODEL',
                      })
                        .unwrap()
                        .then((url: string) => {
                          window.location.href = url;
                          dispatch(
                            displaySuccessNotification({
                              content: t('notifications.physicalDownloadModelSuccess', { modelName: model?.name }),
                            }),
                          );
                        });
                      break;
                    case ActionButtonId.VIRTUALDOWNLOAD:
                      try {
                        const response = await getAssetUrl({
                          modelId,
                          assetType: 'VIRTUAL_MODEL',
                        }).unwrap();

                        if (response === ModelStatus.QUEUED) {
                          setIsPollingVirtualModel(true);
                          dispatch(
                            displayInfoNotification({
                              content: t('notifications.virtualDownloadModelPackaging', { modelName: model?.name }),
                            }),
                          );
                        } else {
                          window.location.href = response;
                          dispatch(
                            displaySuccessNotification({
                              content: t('notifications.virtualDownloadModelSuccess', { modelName: model?.name }),
                            }),
                          );
                        }
                      } catch (error) {
                        setIsPollingVirtualModel(false);
                      }
                      break;
                    default:
                      break;
                  }
                }}
                items={[
                  {
                    id: ActionButtonId.CLONE,
                    text: t('buttons.cloneModel'),
                    disabled: model.status !== ModelStatus.READY || isPhysicalModel,
                  },
                  {
                    id: ActionButtonId.DELETE,
                    text: t('buttons.deleteModel'),
                    disabled: model.status !== ModelStatus.READY && model.status !== ModelStatus.ERROR,
                  },
                  {
                    id: ActionButtonId.DOWNLOAD,
                    text: t('buttons.downloadModel'),
                    disabled: model.status !== ModelStatus.READY,
                  },
                  ...(isPhysicalModel
                    ? []
                    : [
                        {
                          id: ActionButtonId.VIRTUALDOWNLOAD,
                          text: t('buttons.downloadVirtualModel'),
                          disabled: model.status !== ModelStatus.READY || isPollingVirtualModel,
                        },
                      ]),
                ]}
              >
                {t('buttons.actions')}
              </ButtonDropdown>
              {!isPhysicalModel && (
                <Button
                  disabled={model.status !== ModelStatus.READY}
                  onClick={() => navigate(getPath(PageId.SUBMIT_MODEL_TO_RACE, { modelId }))}
                >
                  {t('buttons.submitModel')}
                </Button>
              )}
              {isWaitingForCapacity && (
                <Button variant="primary" loading={isRetryTrainingLoading} onClick={() => setShowRetryModal(true)}>
                  {t('buttons.retryTraining')}
                </Button>
              )}
            </SpaceBetween>
          }
        >
          <SpaceBetween direction="horizontal" size="s" alignItems="center">
            {model.name}
            {isPhysicalModel && <Badge color="grey">Physical</Badge>}
            <StatusIndicator type={getStatusIndicatorType(model.status)}>
              {model.status === ModelStatus.ERROR && model.importErrorMessage ? (
                <Popover header="Import Error" size="large" dismissButton={false} content={model.importErrorMessage}>
                  <Box display="inline" color="inherit" fontWeight="heavy" fontSize="heading-s">
                    {tCommon(model.status)}
                  </Box>
                </Popover>
              ) : (
                <Box display="inline" color="inherit" fontWeight="heavy" fontSize="heading-s">
                  {tCommon(model.status)}
                </Box>
              )}
            </StatusIndicator>
          </SpaceBetween>
        </Header>
      }
    >
      {isWaitingForCapacity && (
        <Alert type="warning" header={t('capacityWaiting.header')}>
          {model.statusMessage ?? t('capacityWaiting.content')}
        </Alert>
      )}
      {successMessage && (
        <Flashbar
          items={[
            {
              type: 'success',
              content: successMessage,
              dismissible: true,
              id: 'submission-success',
              onDismiss: () => setSuccessMessage(undefined),
            },
          ]}
        />
      )}
      <Tabs
        activeTabId={activeTabId}
        onChange={({ detail }) => {
          setActiveTabId(detail.activeTabId);
        }}
        tabs={[
          {
            id: 'training',
            label: t('tabs.training'),
            content: <TrainingTab model={model} />,
          },
          ...(isPhysicalModel
            ? []
            : [
                {
                  id: 'evaluation',
                  label: t('tabs.evaluation'),
                  content: (
                    <EvaluationTab
                      evaluations={evaluations}
                      isEvaluationsLoading={isListEvaluationsLoading}
                      model={model}
                    />
                  ),
                },
              ]),
        ]}
      />
      <Modal
        onDismiss={() => setShowModal(false)}
        visible={showModal}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowModal(false)}>
                {t('deleteModal.cancelButton')}
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    await deleteModel({ modelId: modelToDelete?.modelId ?? '' }).unwrap();
                    dispatch(
                      displaySuccessNotification({
                        content: t('notifications.deleteModelSuccess', { modelName: modelToDelete?.name }),
                      }),
                    );
                    navigate(getPath(PageId.MODELS));
                  } catch {
                    dispatch(
                      displayErrorNotification({
                        content: t('notifications.deleteModelError', { modelName: modelToDelete?.name }),
                      }),
                    );
                  } finally {
                    setShowModal(false);
                  }
                }}
              >
                {t('deleteModal.deleteButton')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('deleteModal.header')}
      >
        {t('deleteModal.content', { modelName: modelToDelete?.name })}
      </Modal>
      <Modal
        onDismiss={() => setShowRetryModal(false)}
        visible={showRetryModal}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowRetryModal(false)}>
                {t('retryTrainingModal.cancelButton')}
              </Button>
              <Button variant="primary" loading={isRetryTrainingLoading} onClick={onRetryTraining}>
                {t('retryTrainingModal.confirmButton')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('retryTrainingModal.header')}
      >
        {t('retryTrainingModal.content', { modelName: model.name })}
      </Modal>
    </ContentLayout>
  );
};

export default ModelDetails;
