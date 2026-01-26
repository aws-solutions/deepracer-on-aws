// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Popover from '@cloudscape-design/components/popover';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Tabs from '@cloudscape-design/components/tabs';
import { Evaluation, ModelStatus, AssetType } from '@deepracer-indy/typescript-client';
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
} from '#services/deepRacer/modelsApi';
import { displayInfoNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';
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

  const { modelId = '' } = useParams();
  const modelStatusRef = useRef<ModelStatus>();

  const { listModelResult } = modelsApi.endpoints.listModels.useQueryState(undefined, {
    selectFromResult: ({ data }) => ({ listModelResult: data?.find((m) => m.modelId === modelId) }),
  });

  const { data: getModelResult, isLoading: isGetModelLoading } = useGetModelQuery(
    { modelId },
    {
      pollingInterval: POLLING_INTERVAL_TIME,
      skipPollingIfUnfocused: true,
      skip: modelStatusRef.current === ModelStatus.ERROR || modelStatusRef.current === ModelStatus.READY,
    },
  );

  const model = getModelResult ?? listModelResult;

  const { data: evaluations = [], isLoading: isListEvaluationsLoading } = useListEvaluationsQuery({ modelId });

  const latestEvaluation: Evaluation | undefined = evaluations[0];

  // Poll latest evaluation until terminal. Result is patched into ListEvaluationsQuery cache in evaluationsApi.
  useGetEvaluationQuery(latestEvaluation ? { evaluationId: latestEvaluation.evaluationId, modelId } : skipToken, {
    pollingInterval: POLLING_INTERVAL_TIME,
    skipPollingIfUnfocused: true,
    skip: TERMINAL_EVALUATION_STATUSES.includes(latestEvaluation?.status),
  });

  const [deleteModel, { isLoading: isDeleteModelLoading }] = useDeleteModelMutation();
  useModelDetailsNotifications(model, latestEvaluation);

  useEffect(() => {
    modelStatusRef.current = model?.status;
  }, [model?.status]);

  const [getAssetUrl, { isLoading: isGetAssetUrlLoading }] = useGetAssetUrlMutation();
  const [isPollingVirtualModel, setIsPollingVirtualModel] = useState(false);

  useEffect(() => {
    let pollingInterval: number;

    if (isPollingVirtualModel) {
      pollingInterval = window.setInterval(async () => {
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
            window.clearInterval(pollingInterval);
          }
        } catch (error) {
          setIsPollingVirtualModel(false);
          window.clearInterval(pollingInterval);
        }
      }, POLLING_INTERVAL_TIME * 2); // 20 seconds
    }

    return () => {
      if (pollingInterval) {
        window.clearInterval(pollingInterval);
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
                      await deleteModel({ modelId })
                        .unwrap()
                        .then(() => {
                          dispatch(
                            displaySuccessNotification({
                              content: t('notifications.deleteModelSuccess', { modelName: model?.name }),
                            }),
                            navigate(getPath(PageId.MODELS)),
                          );
                        });
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
                    disabled: model.status !== ModelStatus.READY,
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
                  {
                    id: ActionButtonId.VIRTUALDOWNLOAD,
                    text: t('buttons.downloadVirtualModel'),
                    disabled: model.status !== ModelStatus.READY || isPollingVirtualModel,
                  },
                ]}
              >
                {t('buttons.actions')}
              </ButtonDropdown>
              <Button
                disabled={model.status !== ModelStatus.READY}
                onClick={() => navigate(getPath(PageId.SUBMIT_MODEL_TO_RACE, { modelId }))}
              >
                {t('buttons.submitModel')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween direction="horizontal" size="s" alignItems="center">
            {model.name}
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
          {
            id: 'evaluation',
            label: t('tabs.evaluation'),
            content: (
              <EvaluationTab evaluations={evaluations} isEvaluationsLoading={isListEvaluationsLoading} model={model} />
            ),
          },
        ]}
      />
    </ContentLayout>
  );
};

export default ModelDetails;
