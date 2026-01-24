// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { AssetType, Evaluation, JobStatus, Model, ModelStatus } from '@deepracer-indy/typescript-client';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import VideoStreamPlayer from '#components/VideoStreamPlayer';
import { PageId } from '#constants/pages';
import EvaluationResultsTable from '#pages/ModelDetails/components/EvaluationTab/EvaluationResultsTable';
import StopEvaluationModal from '#pages/ModelDetails/components/EvaluationTab/StopEvaluationModal';
import SimulationVideoPlaceholder from '#pages/ModelDetails/components/SimulationVideoPlaceholder';
import { TERMINAL_EVALUATION_STATUSES } from '#pages/ModelDetails/constants';
import { useGetAssetUrlMutation, useStopModelMutation } from '#services/deepRacer/modelsApi';
import { getPath } from '#utils/pageUtils';

import '#pages/ModelDetails/styles.css';
import './styles.css';

interface EvaluationDetailsProps {
  evaluation?: Evaluation;
  model: Model;
}

const EvaluationDetails = ({ evaluation, model }: EvaluationDetailsProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation('modelDetails', { keyPrefix: 'evaluationDetails' });

  const [isStopEvaluationModalVisible, setIsStopEvaluationModalVisible] = useState(false);
  const [stopModel, { isLoading: isStopModelLoading }] = useStopModelMutation();
  const [getAssetUrl, { isLoading: isGetAssetUrlLoading }] = useGetAssetUrlMutation();

  const handleDownloadEvaluationLogsClick = async () => {
    if (evaluation) {
      const evaluationLogsUrl = await getAssetUrl({
        assetType: AssetType.EVALUATION_LOGS,
        evaluationId: evaluation.evaluationId,
        modelId: evaluation.modelId,
      }).unwrap();

      window.location.href = evaluationLogsUrl;
    }
  };

  return (
    <>
      <Container
        header={
          <Header
            variant="h2"
            actions={
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  disabled={evaluation?.status !== JobStatus.COMPLETED && evaluation?.status !== JobStatus.FAILED}
                  onClick={handleDownloadEvaluationLogsClick}
                  loading={isGetAssetUrlLoading}
                >
                  {t('actions.downloadLogs')}
                </Button>
                <Button
                  disabled={
                    !(
                      (model.status === ModelStatus.QUEUED && evaluation?.status === JobStatus.QUEUED) ||
                      (model.status === ModelStatus.EVALUATING && evaluation?.status === JobStatus.IN_PROGRESS)
                    )
                  }
                  onClick={() => {
                    setIsStopEvaluationModalVisible(true);
                  }}
                  loading={isStopModelLoading}
                >
                  {t('actions.stopEvaluation')}
                </Button>
                <Button
                  disabled={model.status !== ModelStatus.READY}
                  onClick={() => navigate(getPath(PageId.CREATE_EVALUATION, { modelId: model.modelId }))}
                >
                  {evaluation ? t('actions.startNewEvaluation') : t('actions.startEvaluation')}
                </Button>
              </SpaceBetween>
            }
          >
            {evaluation
              ? t('header.withEvaluation', { evaluationName: evaluation.config.evaluationName })
              : t('header.noEvaluation')}
          </Header>
        }
      >
        {evaluation ? (
          <ColumnLayout columns={2}>
            <div className="simulationVideoWrapper">
              <Box margin={{ bottom: 's' }}>
                <Header variant="h3">
                  {TERMINAL_EVALUATION_STATUSES.includes(evaluation.status)
                    ? t('simulationVideo.header.video')
                    : t('simulationVideo.header.stream')}
                </Header>
              </Box>

              {!TERMINAL_EVALUATION_STATUSES.includes(evaluation.status) && evaluation.videoStreamUrl ? (
                <VideoStreamPlayer src={evaluation.videoStreamUrl} />
              ) : evaluation.videoUrl ? (
                <video src={evaluation.videoUrl} controls className="videoPlayer" />
              ) : (
                <SimulationVideoPlaceholder
                  placeholderType={
                    evaluation.status === JobStatus.COMPLETED && !evaluation.metrics.length
                      ? 'evaluationNoCompletedLaps'
                      : 'evaluation'
                  }
                />
              )}
            </div>
            <EvaluationResultsTable evaluation={evaluation} />
          </ColumnLayout>
        ) : (
          <Box textAlign="center" color="text-status-inactive">
            <Box variant="p" color="inherit">
              <Trans
                t={t}
                i18nKey={
                  model.trainingStatus === JobStatus.COMPLETED
                    ? 'placeholder.title.trainingComplete'
                    : 'placeholder.title.trainingNotComplete'
                }
              />
            </Box>
            <Box variant="p" color="inherit" padding={{ bottom: 's' }}>
              <Trans t={t} i18nKey="placeholder.description" />
            </Box>
          </Box>
        )}
      </Container>
      <StopEvaluationModal
        isVisible={isStopEvaluationModalVisible}
        onDismiss={() => setIsStopEvaluationModalVisible(false)}
        onConfirm={async () => {
          setIsStopEvaluationModalVisible(false);
          await stopModel({ modelId: model.modelId });
        }}
      />
    </>
  );
};

export default EvaluationDetails;
