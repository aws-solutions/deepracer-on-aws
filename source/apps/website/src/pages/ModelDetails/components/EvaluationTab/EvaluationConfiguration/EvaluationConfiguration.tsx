// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import { Evaluation } from '@deepracer-indy/typescript-client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getTrackById } from '../../../../../utils/trackUtils.js';

interface EvaluationConfigurationProps {
  evaluation: Evaluation;
}

const EvaluationConfiguration = ({ evaluation }: EvaluationConfigurationProps) => {
  const { t: commonT } = useTranslation('common');
  const { t } = useTranslation('modelDetails', { keyPrefix: 'evaluationConfiguration' });

  const {
    trackConfig: { trackDirection, trackId },
    maxLaps,
    objectAvoidanceConfig,
  } = evaluation.config;

  const track = useMemo(() => getTrackById(trackId), [trackId]);

  return (
    <Container header={<Header variant="h2">{t('header')}</Header>}>
      <ColumnLayout columns={objectAvoidanceConfig ? 2 : 1} variant="text-grid">
        <KeyValuePairs
          items={[
            {
              label: t('keyValueLabels.raceType'),
              value: commonT(`raceType.${evaluation.config.raceType}`),
            },
            {
              label: t('keyValueLabels.enviromentSimulation'),
              value: `${track.name} - ${commonT(`trackDirection.${trackDirection}`)}`,
            },
            {
              label: t('keyValueLabels.numberOfTrials'),
              value: maxLaps,
            },
          ]}
        />
        {/** TODO: Add object avoidance config key/value pairs */}
        <KeyValuePairs items={[]} />
      </ColumnLayout>
    </Container>
  );
};

export default EvaluationConfiguration;
