// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TextContent from '@cloudscape-design/components/text-content';
import { AssetType, JobStatus, Model, ModelStatus } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import JobStatusIndicator from '#components/JobStatusIndicator';
import VideoStreamPlayer from '#components/VideoStreamPlayer';
import SimulationVideoPlaceholder from '#pages/ModelDetails/components/SimulationVideoPlaceholder';
import {
  useGetAssetUrlMutation,
  useGetTrainingMetricsQuery,
  useStopModelMutation,
} from '#services/deepRacer/modelsApi';

import RewardGraph from './RewardGraph';

import './styles.css';

interface TrainingDetailsProps {
  model: Model;
}

const TrainingDetails = ({ model }: TrainingDetailsProps) => {
  const { t } = useTranslation('modelDetails', { keyPrefix: 'trainingDetails' });

  const [isStopTrainingModalVisible, setIsStopTrainingModalVisible] = useState(false);
  const [isTrainingExpanded, setIsTrainingExpanded] = useState(model.status === ModelStatus.TRAINING);

  // Auto-expand when training becomes active
  useEffect(() => {
    if (model.status === ModelStatus.TRAINING) {
      setIsTrainingExpanded(true);
    }
  }, [model.status]);

  // Only fetch metrics when training is in progress or completed
  const shouldFetchMetrics =
    model.trainingStatus === JobStatus.IN_PROGRESS || model.trainingStatus === JobStatus.COMPLETED;

  const { data: trainingMetrics = [], isLoading: isTrainingMetricsLoading } = useGetTrainingMetricsQuery(
    model.trainingMetricsUrl,
    { skip: !shouldFetchMetrics },
  );
  const [stopModel, { isLoading: isStopModelLoading }] = useStopModelMutation();
  const [getAssetUrl, { isLoading: isGetAssetUrlLoading }] = useGetAssetUrlMutation();

  const handleDownloadTrainingLogsClick = async () => {
    const trainingLogsUrl = await getAssetUrl({
      assetType: AssetType.TRAINING_LOGS,
      modelId: model.modelId,
    }).unwrap();

    window.location.href = trainingLogsUrl;
  };

  return (
    <>
      <ExpandableSection
        variant="container"
        expanded={isTrainingExpanded}
        onChange={({ detail }) => setIsTrainingExpanded(detail.expanded)}
        headerText={t('header')}
        headerActions={
          <SpaceBetween size="xs" direction="horizontal" alignItems="center">
            <Button
              disabled={model.trainingStatus !== JobStatus.COMPLETED && model.trainingStatus !== JobStatus.FAILED}
              onClick={handleDownloadTrainingLogsClick}
              loading={isGetAssetUrlLoading}
            >
              {t('actionButtons.downloadLogs')}
            </Button>
            <Button
              loading={isStopModelLoading}
              disabled={model.trainingStatus !== JobStatus.QUEUED && model.trainingStatus !== JobStatus.IN_PROGRESS}
              onClick={() => setIsStopTrainingModalVisible(true)}
            >
              {t('actionButtons.stopTraining')}
            </Button>
            <JobStatusIndicator status={model.trainingStatus} fontSize="heading-s" fontWeight="heavy" />
          </SpaceBetween>
        }
      >
        {model.trainingStatus === JobStatus.INITIALIZING ? (
          <TextContent>
            <Box textAlign="center" margin={{ top: 's' }}>
              <Trans t={t} i18nKey="initializingPlaceholder" />
            </Box>
          </TextContent>
        ) : (
          <>
            <Box variant="p" color="text-body-secondary" margin={{ bottom: 's' }}>
              {t('description')}
            </Box>
            <ColumnLayout columns={2}>
              <div>
                <Box margin={{ bottom: 's' }}>
                  <Header variant="h3">{t('rewardGraph.header')}</Header>
                </Box>

                <RewardGraph
                  isLoading={isTrainingMetricsLoading}
                  iterationSize={model.metadata.hyperparameters.num_episodes_between_training}
                  trainingMetrics={trainingMetrics}
                />
              </div>
              <div className="simulationVideoWrapper">
                <Box margin={{ bottom: 's' }}>
                  <Header variant="h3">{t('simulationVideo.header')}</Header>
                </Box>

                {model.trainingVideoStreamUrl ? (
                  <VideoStreamPlayer src={model.trainingVideoStreamUrl} />
                ) : (
                  <SimulationVideoPlaceholder placeholderType="training" />
                )}
              </div>
            </ColumnLayout>
          </>
        )}
      </ExpandableSection>
      <Modal
        visible={isStopTrainingModalVisible}
        onDismiss={() => setIsStopTrainingModalVisible(false)}
        header={t('stopTrainingModal.header')}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setIsStopTrainingModalVisible(false)}>
                {t('stopTrainingModal.cancel')}
              </Button>
              <Button
                variant="primary"
                loading={isStopModelLoading}
                onClick={async () => {
                  await stopModel({ modelId: model.modelId });
                  setIsStopTrainingModalVisible(false);
                }}
              >
                {t('stopTrainingModal.confirm')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <TextContent>
          <Trans t={t} i18nKey="stopTrainingModal.content" />
        </TextContent>
      </Modal>
    </>
  );
};

export default TrainingDetails;
