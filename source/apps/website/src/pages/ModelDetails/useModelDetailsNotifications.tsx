// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Evaluation, JobStatus, Model, ModelStatus } from '@deepracer-indy/typescript-client';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '../../hooks/useAppDispatch.js';
import {
  displayErrorNotification,
  displayInfoNotification,
  displaySuccessNotification,
  removeNotification,
} from '../../store/notifications/notificationsSlice.js';

const EVALUATION_IN_PROGRESS_NOTIFICATION_ID = 'evaluation-in-progress';
const EVALUATION_INITIALIZING_NOTIFICATION_ID = 'evaluation-initializing';
const EVALUATION_STOPPING_NOTIFICATION_ID = 'evaluation-stopping';
const TRAINING_IN_PROGRESS_NOTIFICATION_ID = 'training-in-progress';
const TRAINING_INITIALIZING_NOTIFICATION_ID = 'training-initializing';
const TRAINING_STOPPING_NOTIFICATION_ID = 'training-stopping';
const IMPORT_ERROR_NOTIFICATION_ID = 'import-error';

export const useModelDetailsNotifications = (model?: Model, latestEvaluation?: Evaluation) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('modelDetails', { keyPrefix: 'notifications' });
  const { t: tModels } = useTranslation('models');

  useEffect(() => {
    if (model?.trainingStatus === JobStatus.INITIALIZING) {
      dispatch(
        displayInfoNotification({
          header: t('trainingInitializing.header'),
          content: t('trainingInitializing.content'),
          id: TRAINING_INITIALIZING_NOTIFICATION_ID,
          loading: true,
          dismissible: false,
        }),
      );
    }

    return () => {
      dispatch(removeNotification({ id: TRAINING_INITIALIZING_NOTIFICATION_ID }));
    };
  }, [dispatch, model?.trainingStatus, model?.trainingConfig.maxTimeInMinutes, t]);

  useEffect(() => {
    if (model?.trainingStatus === JobStatus.IN_PROGRESS) {
      dispatch(
        displayInfoNotification({
          header: t('trainingInProgress.header'),
          content: t('trainingInProgress.content', { minutes: model.trainingConfig.maxTimeInMinutes }),
          id: TRAINING_IN_PROGRESS_NOTIFICATION_ID,
          loading: true,
          dismissible: false,
        }),
      );
    }

    return () => {
      dispatch(removeNotification({ id: TRAINING_IN_PROGRESS_NOTIFICATION_ID }));
    };
  }, [dispatch, model?.trainingStatus, model?.trainingConfig.maxTimeInMinutes, t]);

  useEffect(() => {
    if (model?.trainingStatus === JobStatus.STOPPING) {
      dispatch(
        displayInfoNotification({
          header: t('trainingStopping.header'),
          content: t('trainingStopping.content'),
          id: TRAINING_STOPPING_NOTIFICATION_ID,
          loading: true,
          dismissible: false,
        }),
      );
    }

    return () => {
      dispatch(removeNotification({ id: TRAINING_STOPPING_NOTIFICATION_ID }));
    };
  }, [dispatch, model?.trainingStatus, t]);

  // TODO: set up notifications to allow for react components
  // useEffect(() => {
  //   if (model?.trainingStatus === JobStatus.COMPLETED) {
  //     dispatch(
  //       displaySuccessNotification({
  //         header: t('trainingComplete.header'),
  //         content: t('trainingComplete.content'),
  //         id: TRAINING_COMPLETE_NOTIFICATION_ID,
  //         action: (
  //           <Button onClick={() => navigate(getPath(PageId.CREATE_EVALUATION, { modelId: model.modelId }))}>
  //             {t('trainingComplete.action')}
  //           </Button>
  //         ),
  //       }),
  //     );
  //   }

  //   return () => {
  //     dispatch(removeNotification({ id: TRAINING_COMPLETE_NOTIFICATION_ID }));
  //   };
  // }, [dispatch, model?.modelId, model?.trainingStatus, navigate, t]);

  useEffect(() => {
    if (model?.status === ModelStatus.EVALUATING && latestEvaluation?.status === JobStatus.INITIALIZING) {
      dispatch(
        displayInfoNotification({
          id: EVALUATION_INITIALIZING_NOTIFICATION_ID,
          header: t('evaluationInitializing.header'),
          content: t('evaluationInitializing.content'),
          loading: true,
          dismissible: false,
        }),
      );
    }

    return () => {
      dispatch(removeNotification({ id: EVALUATION_INITIALIZING_NOTIFICATION_ID }));
    };
  }, [dispatch, model?.status, latestEvaluation?.status, t]);

  useEffect(() => {
    if (model?.status === ModelStatus.EVALUATING && latestEvaluation?.status === JobStatus.IN_PROGRESS) {
      dispatch(
        displayInfoNotification({
          id: EVALUATION_IN_PROGRESS_NOTIFICATION_ID,
          header: t('evaluationInProgress.header'),
          content: t('evaluationInProgress.content'),
          loading: true,
          dismissible: false,
        }),
      );
    }

    return () => {
      dispatch(removeNotification({ id: EVALUATION_IN_PROGRESS_NOTIFICATION_ID }));
    };
  }, [dispatch, model?.status, latestEvaluation?.status, t]);

  useEffect(() => {
    if (model?.status === ModelStatus.EVALUATING && latestEvaluation?.status === JobStatus.STOPPING) {
      dispatch(
        displayInfoNotification({
          id: EVALUATION_STOPPING_NOTIFICATION_ID,
          header: t('evaluationStopping.header'),
          content: t('evaluationStopping.content'),
          loading: true,
          dismissible: false,
        }),
      );
    }

    return () => {
      dispatch(removeNotification({ id: EVALUATION_STOPPING_NOTIFICATION_ID }));
    };
  }, [dispatch, model?.status, latestEvaluation?.status, t]);

  useEffect(() => {
    if (model?.status === ModelStatus.ERROR && model?.importErrorMessage) {
      dispatch(
        displayErrorNotification({
          id: IMPORT_ERROR_NOTIFICATION_ID,
          header: 'Import Error',
          content: model.importErrorMessage,
          dismissible: true,
        }),
      );
    }

    return () => {
      dispatch(removeNotification({ id: IMPORT_ERROR_NOTIFICATION_ID }));
    };
  }, [dispatch, model?.status, model?.importErrorMessage, t]);

  const IMPORT_SUCCESS_NOTIFICATION_ID = 'import-success';
  const modelStatusRef = useRef<ModelStatus>();

  useEffect(() => {
    const previousStatus = modelStatusRef.current;
    const currentStatus = model?.status;

    if (previousStatus === ModelStatus.IMPORTING && currentStatus === ModelStatus.READY) {
      dispatch(
        displaySuccessNotification({
          id: IMPORT_SUCCESS_NOTIFICATION_ID,
          content: tModels('notifications.statusTransitions.IMPORTING.toReady', { modelName: model?.name }),
          dismissible: true,
        }),
      );
    }

    modelStatusRef.current = currentStatus;

    return () => {
      dispatch(removeNotification({ id: IMPORT_SUCCESS_NOTIFICATION_ID }));
    };
  }, [dispatch, model?.status, model?.name, tModels]);
};
