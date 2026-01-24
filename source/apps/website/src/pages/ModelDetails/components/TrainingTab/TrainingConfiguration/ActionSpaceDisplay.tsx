// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Table from '@cloudscape-design/components/table';
import { ContinuousActionSpace, DiscreteActionSpaceItem } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

interface ActionSpaceDisplayProps {
  continuousActionSpace?: ContinuousActionSpace;
  discreteActionSpace?: DiscreteActionSpaceItem[];
}

interface IndexedDiscreteActionSpaceItem extends DiscreteActionSpaceItem {
  index: number;
}

const ActionSpaceDisplay = ({ continuousActionSpace, discreteActionSpace }: ActionSpaceDisplayProps) => {
  const { t } = useTranslation('modelDetails', { keyPrefix: 'trainingConfiguration.actionSpaceDisplay' });

  if (continuousActionSpace) {
    return (
      <>
        <Box>
          {t('speed')}
          <Box
            display="inline"
            variant="awsui-key-label"
          >{`[ ${continuousActionSpace.lowSpeed} : ${continuousActionSpace.highSpeed} ] m/s`}</Box>
        </Box>
        <Box>
          {t('steeringAngle')}
          <Box
            display="inline"
            variant="awsui-key-label"
          >{`[ ${continuousActionSpace.lowSteeringAngle} : ${continuousActionSpace.highSteeringAngle} ] °`}</Box>
        </Box>
      </>
    );
  }

  if (discreteActionSpace) {
    return (
      <Box padding={{ top: 'xxs' }}>
        <Table<IndexedDiscreteActionSpaceItem>
          items={discreteActionSpace.map((item, index) => ({ ...item, index }))}
          columnDefinitions={[
            { header: t('discreteTable.columnHeaders.number'), cell: (e) => e.index },
            { header: t('discreteTable.columnHeaders.steeringAngle'), cell: (e) => e.steeringAngle.toFixed(1) },
            { header: t('discreteTable.columnHeaders.speed'), cell: (e) => e.speed.toFixed(2) },
          ]}
        />
      </Box>
    );
  }

  return null;
};

export default ActionSpaceDisplay;
