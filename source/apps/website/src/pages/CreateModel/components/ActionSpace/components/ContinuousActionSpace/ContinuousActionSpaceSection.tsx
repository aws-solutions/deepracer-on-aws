// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Icon from '@cloudscape-design/components/icon';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useCallback, useEffect, useState } from 'react';
import { Control, UseFormResetField, UseFormSetValue, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import actionSpaceCarBackground from '#assets/images/carGraph.png';
import InputField from '#components/FormFields/InputField';
import { CreateModelFormValues } from '#pages/CreateModel/types';

import '../../styles.css';
import ContinuousGraph from './ContinuousGraph';

interface LastContinuousState {
  maxAngle: number;
  minAngle: number;
  maxSpeedCurrent: number;
  minSpeedCurrent: number;
}

interface ContinuousActionSpaceSectionProps {
  control: Control<CreateModelFormValues>;
  resetField: UseFormResetField<CreateModelFormValues>;
  setValue: UseFormSetValue<CreateModelFormValues>;
}

const ContinuousActionSpaceSection = ({ control, resetField, setValue }: ContinuousActionSpaceSectionProps) => {
  const { t } = useTranslation('createModel', { keyPrefix: 'actionSpace' });

  const continousSteeringAngleHigh = useWatch({ control, name: 'metadata.actionSpace.continous.highSteeringAngle' });
  const continousSteeringAngleLow = useWatch({ control, name: 'metadata.actionSpace.continous.lowSteeringAngle' });
  const continousSpeedHigh = useWatch({ control, name: 'metadata.actionSpace.continous.highSpeed' });
  const continousSpeedLow = useWatch({ control, name: 'metadata.actionSpace.continous.lowSpeed' });

  const [lastContinuousState, setLastContinuousState] = useState<LastContinuousState | null>(null);
  const [maxAngle, setMaxAngle] = useState<number>(lastContinuousState?.maxAngle ?? continousSteeringAngleHigh);
  const [minAngle, setMinAngle] = useState<number>(lastContinuousState?.minAngle ?? continousSteeringAngleLow);
  const [maxSpeedCurrent, setMaxSpeedCurrent] = useState<number>(
    lastContinuousState?.maxSpeedCurrent ?? continousSpeedHigh,
  );
  const [minSpeedCurrent, setMinSpeedCurrent] = useState<number>(
    lastContinuousState?.minSpeedCurrent ?? continousSpeedLow,
  );
  const saveLastContinuousState = useCallback(
    (maAngle: number, miAngle: number, maSpeedCurrent: number, miSpeedCurrent: number) => {
      const lastState: LastContinuousState = {
        maxAngle: maAngle,
        minAngle: miAngle,
        maxSpeedCurrent: maSpeedCurrent,
        minSpeedCurrent: miSpeedCurrent,
      };
      setLastContinuousState(lastState);
    },
    [],
  );

  useEffect(() => {
    if (
      continousSpeedHigh !== lastContinuousState?.maxSpeedCurrent ||
      continousSpeedLow !== lastContinuousState?.minSpeedCurrent ||
      continousSteeringAngleHigh !== lastContinuousState?.maxAngle ||
      continousSteeringAngleLow !== lastContinuousState?.minAngle
    ) {
      saveLastContinuousState(maxAngle, minAngle, maxSpeedCurrent, minSpeedCurrent);
      setMaxSpeedCurrent(continousSpeedHigh);
      setMinSpeedCurrent(continousSpeedLow);
      setMaxAngle(continousSteeringAngleHigh);
      setMinAngle(continousSteeringAngleLow);
    }
  }, [
    continousSpeedHigh,
    continousSpeedLow,
    continousSteeringAngleHigh,
    continousSteeringAngleLow,
    lastContinuousState?.maxAngle,
    lastContinuousState?.maxSpeedCurrent,
    lastContinuousState?.minAngle,
    lastContinuousState?.minSpeedCurrent,
    maxAngle,
    maxSpeedCurrent,
    minAngle,
    minSpeedCurrent,
    saveLastContinuousState,
  ]);

  return (
    <Container header={<Header>{t('continuousSection.defineHeader')}</Header>}>
      <Box variant="p">{t('continuousSection.continuousDescription')}</Box>
      <ColumnLayout columns={2}>
        <SpaceBetween direction="vertical" size="l">
          <Box margin={{ top: 'l' }}>
            <Box tagOverride="h3" variant="h4">
              {t('continuousSection.steeringAngle')}
            </Box>
            <Box variant="p">{t('continuousSection.steeringAngleDescription')}</Box>
          </Box>
          <Box>
            <SpaceBetween direction="vertical" size="m">
              <InputField
                control={control}
                name="metadata.actionSpace.continous.highSteeringAngle"
                label={t('continuousSection.leftSteeringAngle')}
                constraintText={t('continuousSection.leftSteeringAngleConstraintText')}
                type="number"
              />
              <InputField
                control={control}
                name="metadata.actionSpace.continous.lowSteeringAngle"
                label={t('continuousSection.rightSteeringAngle')}
                constraintText={t('continuousSection.rightSteeringAngleConstraintText')}
                type="number"
              />
            </SpaceBetween>
          </Box>
          <Box>
            <Box tagOverride="h3" variant="h4">
              {t('continuousSection.speed')}
            </Box>
            <Box variant="p">{t('continuousSection.speedDescription')}</Box>
          </Box>
          <SpaceBetween direction="vertical" size="m">
            <InputField
              control={control}
              name="metadata.actionSpace.continous.lowSpeed"
              label={t('continuousSection.minimumSpeed')}
              constraintText={t('continuousSection.speedConstraintText')}
              type="number"
              step={0.1}
            />
            <InputField
              control={control}
              name="metadata.actionSpace.continous.highSpeed"
              label={t('continuousSection.maximumSpeed')}
              constraintText={t('continuousSection.speedConstraintText')}
              type="number"
              step={0.1}
            />
          </SpaceBetween>
          <Button
            variant="normal"
            onClick={() => {
              resetField('metadata.actionSpace.continous.highSpeed');
              resetField('metadata.actionSpace.continous.lowSpeed');
              resetField('metadata.actionSpace.continous.highSteeringAngle');
              resetField('metadata.actionSpace.continous.lowSteeringAngle');
            }}
          >
            {t('continuousSection.resetButton')}
          </Button>
        </SpaceBetween>
        <div className="dynamicSectorGraph">
          <Box tagOverride="h3" variant="h4">
            {t('continuousSection.graphLabel')}
          </Box>
          <div className="interactiveGraphImgContainer">
            <div className="interactiveGraphContainer">
              <svg
                className="action_space_svg"
                viewBox={'0 0 360 60'}
                height="100%"
                width="100%"
                preserveAspectRatio="xMidYMin"
              >
                <g id="action_space_arrows_group" fill="none" fillRule="evenodd" transform-box="fill-box">
                  <ContinuousGraph
                    xOrigin={180}
                    yOrigin={148}
                    maxRadius={138}
                    maxAngle={maxAngle}
                    minAngle={minAngle}
                    maxSpeedCurrent={maxSpeedCurrent}
                    minSpeedCurrent={minSpeedCurrent}
                    control={control}
                    setValue={setValue}
                  />
                </g>
              </svg>
              <img
                alt={t('continuousSection.graphImageAlt')}
                src={actionSpaceCarBackground}
                width="100%"
                max-width="420px"
              />
            </div>
            <div className="modify_graph_hint">
              <Icon name="status-info" size="normal" variant="normal" />
              <div className="graphHelpText">{t('continuousSection.graphHelpText')}</div>
            </div>
          </div>
        </div>
      </ColumnLayout>
    </Container>
  );
};

export default ContinuousActionSpaceSection;
