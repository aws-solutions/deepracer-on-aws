// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import { useTranslation } from 'react-i18next';

interface RaceProgressBarProps {
  completedModels: number;
  totalModels: number;
}

/**
 * Shows overall race progress — how many models have been evaluated out of the total.
 */
const RaceProgressBar = ({ completedModels, totalModels }: RaceProgressBarProps) => {
  const { t } = useTranslation('liveRace');

  const percentage = totalModels > 0 ? Math.round((completedModels / totalModels) * 100) : 0;

  return (
    <Box data-testid="race-progress-bar">
      <ProgressBar
        value={percentage}
        label={t('raceProgressBar.label')}
        description={t('raceProgressBar.description', { completed: completedModels, total: totalModels })}
      />
    </Box>
  );
};

export default RaceProgressBar;
