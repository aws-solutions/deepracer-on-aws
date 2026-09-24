// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import CodeView from '@cloudscape-design/code-view/code-view';
import pythonHighlight from '@cloudscape-design/code-view/highlight/python';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Modal from '@cloudscape-design/components/modal';
import Table from '@cloudscape-design/components/table';
import { DEFAULT_MIN_EVAL_TRIALS } from '@deepracer-indy/config';
import { Hyperparameters, Model, ModelSource } from '@deepracer-indy/typescript-client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Track, TRACKS } from '#constants/tracks.js';
import { Entries } from '#types/index.js';

import ActionSpaceDisplay from './ActionSpaceDisplay';

interface TrainingConfigurationProps {
  model: Model;
}

const TrainingConfiguration = ({ model }: TrainingConfigurationProps) => {
  const { t: commonT } = useTranslation();
  const { t } = useTranslation('modelDetails', { keyPrefix: 'trainingConfiguration' });
  const [isRewardFunctionModalVisible, setIsRewardFunctionModalVisible] = useState(false);

  const isPhysicalModel = model.modelSource === ModelSource.IMPORTED_PHYSICAL;
  const { metadata, trainingConfig } = model;
  const { agentAlgorithm, hyperparameters, rewardFunction, sensors } = metadata ?? {};
  const { continous, discrete } = metadata?.actionSpace ?? {};
  const { maxTimeInMinutes, trackConfig, raceType } = trainingConfig ?? {};
  const { trackDirection, trackId } = trackConfig ?? {};

  const track = useMemo(() => TRACKS.find((tr) => tr.trackId === trackId) as Track, [trackId]);

  const trackDirectionLabel = trackDirection ? commonT(`trackDirection.${trackDirection}`) : '';
  const trackLabel = track ? `${track.name} - ${trackDirectionLabel}` : '-';
  const lidarLabel = sensors?.lidar ? commonT(`sensors.lidar.${sensors.lidar}`) : '';
  const cameraLabel = sensors?.camera ? commonT(`sensors.camera.${sensors.camera}`) : '';
  const sensorsLabel = [lidarLabel, cameraLabel].filter(Boolean).join(', ');

  return (
    <>
      <Container header={<Header variant="h2">{t('header')}</Header>}>
        <ColumnLayout columns={isPhysicalModel ? 1 : 3} borders="vertical" variant="text-grid">
          {!isPhysicalModel && (
            <KeyValuePairs
              items={[
                {
                  label: t('keyValueLabels.raceType'),
                  value: commonT(`raceType.${raceType}`),
                },
                {
                  label: t('keyValueLabels.enviromentSimulation'),
                  value: trackLabel,
                },
                {
                  label: t('keyValueLabels.rewardFunction'),
                  value: (
                    <Button onClick={() => setIsRewardFunctionModalVisible(true)}>
                      {t('showRewardFunctionButton')}
                    </Button>
                  ),
                },
                {
                  label: t('keyValueLabels.sensors'),
                  value: sensorsLabel,
                },
                {
                  label: t('keyValueLabels.totalTrainingTime'),
                  value: t('totalTrainingTime', { count: maxTimeInMinutes }),
                },
                {
                  label: t('keyValueLabels.minEvalTrials'),
                  value: trainingConfig?.minEvalTrials ?? DEFAULT_MIN_EVAL_TRIALS,
                },
              ]}
            />
          )}
          {metadata && agentAlgorithm && (
            <KeyValuePairs
              items={[
                {
                  label: t('keyValueLabels.actionSpaceType'),
                  value: commonT(`actionSpaceType.${continous ? 'CONTINUOUS' : 'DISCRETE'}`),
                },
                {
                  label: t('keyValueLabels.actionSpace'),
                  value: <ActionSpaceDisplay continuousActionSpace={continous} discreteActionSpace={discrete} />,
                },
                {
                  label: t('keyValueLabels.framework'),
                  value: t('tensorflow'),
                },
                {
                  label: t('keyValueLabels.reinforcementLearningAlgorithm'),
                  value: agentAlgorithm,
                },
              ]}
            />
          )}
          {!isPhysicalModel && hyperparameters && (
            <Table<{ key: keyof Hyperparameters; value: Hyperparameters[keyof Hyperparameters] }>
              wrapLines
              columnDefinitions={[
                {
                  header: t('hyperparameterTable.columnHeaders.hyperparameter'),
                  cell: (e) => t(`hyperparameterTable.hyperparameters.${e.key}`),
                },
                { header: t('hyperparameterTable.columnHeaders.value'), cell: (e) => e.value },
              ]}
              items={(Object.entries(hyperparameters) as Entries<Hyperparameters>).map(([key, value]) => ({
                key,
                value,
              }))}
            />
          )}
        </ColumnLayout>
      </Container>
      {!isPhysicalModel && (
        <Modal
          header={t('keyValueLabels.rewardFunction')}
          visible={isRewardFunctionModalVisible}
          onDismiss={() => setIsRewardFunctionModalVisible(false)}
          size="large"
        >
          <CodeView
            lineNumbers
            content={rewardFunction}
            highlight={pythonHighlight}
            actions={
              <CopyToClipboard
                textToCopy={rewardFunction}
                copySuccessText={t('rewardFunctionModal.copySuccess')}
                copyErrorText={t('rewardFunctionModal.copyError')}
              />
            }
          />
        </Modal>
      )}
    </>
  );
};

export default TrainingConfiguration;
