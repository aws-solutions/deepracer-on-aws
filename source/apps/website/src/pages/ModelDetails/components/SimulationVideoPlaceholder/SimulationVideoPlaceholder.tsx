// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import { Trans, useTranslation } from 'react-i18next';

import simulationVideoPlaceholder from '../../../../assets/images/simulationVideoPlaceholder.svg';
import './styles.css';

interface SimulationVideoPlaceholderProps {
  placeholderType: 'evaluation' | 'evaluationNoCompletedLaps' | 'training';
}

const SimulationVideoPlaceholder = ({ placeholderType }: SimulationVideoPlaceholderProps) => {
  const { t } = useTranslation('modelDetails', { keyPrefix: 'simulationVideoPlaceholder' });

  return (
    <div className="simulationVideoPlaceholder">
      <Box margin={{ top: 'xl', bottom: 'xl' }}>
        <img src={simulationVideoPlaceholder} alt={t('alt')} />
        <Box fontSize="heading-m" margin={{ top: 'xl' }}>
          <Trans t={t} i18nKey={placeholderType} />
        </Box>
      </Box>
    </div>
  );
};

export default SimulationVideoPlaceholder;
