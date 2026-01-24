// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Checkbox from '@cloudscape-design/components/checkbox';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { AgentAlgorithm, CameraSensor, LidarSensor, LossType } from '@deepracer-indy/typescript-client';
import { Control, UseFormSetValue, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import carGarageFrontDefault from '#assets/images/carCamera.png';
import carGarageFrontLidarDefault from '#assets/images/carCameraLidar.png';
import carGarageStereo from '#assets/images/carStereo.png';
import carGarageStereoLidar from '#assets/images/carStereoLidar.png';
import InputField from '#components/FormFields/InputField';
import RadioGroupField from '#components/FormFields/RadioGroupField/RadioGroupField';
import { DEFAULT_PPO_HYPERPARAMETERS, DEFAULT_SAC_HYPERPARAMETERS } from '#pages/CreateModel/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';

import './styles.css';

interface VehicleInfoProps {
  control: Control<CreateModelFormValues>;
  setValue: UseFormSetValue<CreateModelFormValues>;
}

const VehicleInfo = ({ control, setValue }: VehicleInfoProps) => {
  const { t } = useTranslation('createModel');

  const agentAlgorithm = useWatch({ control, name: 'metadata.agentAlgorithm' });
  const cameraSensor = useWatch({ control, name: 'metadata.sensors.camera' });
  const lidarSensor = useWatch({ control, name: 'metadata.sensors.lidar' });
  const preTrainedModelId = useWatch({ control, name: 'preTrainedModelId' });

  const isClonedModel = !!preTrainedModelId;
  const isPPOAlgorithm = agentAlgorithm === AgentAlgorithm.PPO;

  const renderSpecImage = () => {
    if (cameraSensor === CameraSensor.FRONT_FACING_CAMERA) {
      return lidarSensor ? carGarageFrontLidarDefault : carGarageFrontDefault;
    }
    if (cameraSensor === CameraSensor.STEREO_CAMERAS) {
      return lidarSensor ? carGarageStereoLidar : carGarageStereo;
    }
    return carGarageFrontDefault;
  };

  return (
    <SpaceBetween direction="vertical" size="l">
      <Container
        data-testid={t('vehicleInfo.configureVehicleHeader')}
        header={
          <Header variant="h2" description={t('vehicleInfo.configureVehicleDescription')}>
            {t('vehicleInfo.configureVehicleHeader')}
          </Header>
        }
      >
        <ColumnLayout columns={2}>
          <Box>
            <Box>
              <RadioGroupField
                control={control}
                name="metadata.sensors.camera"
                label={t('vehicleInfo.sensorModification')}
                description={
                  <Box color="inherit" margin={{ bottom: 'xs' }}>
                    {t('vehicleInfo.sensorModificationDescription')}
                  </Box>
                }
                items={[
                  {
                    label: t('vehicleInfo.camera'),
                    description: (
                      <>
                        <Box color="inherit">{t('vehicleInfo.cameraSensorDescription')}</Box>
                        <ExpandableSection headerText={t('vehicleInfo.cameraSensorExpandableHeader')}>
                          <Box variant="p" color="inherit">
                            <Box variant="small">{t('vehicleInfo.frontFacingCameraContent')}</Box>
                          </Box>
                        </ExpandableSection>
                      </>
                    ),
                    value: CameraSensor.FRONT_FACING_CAMERA,
                  },
                  {
                    label: t('vehicleInfo.stereoCamera'),
                    description: (
                      <>
                        <Box color="inherit">{t('vehicleInfo.stereoCameraDescription')}</Box>
                        <ExpandableSection headerText={t('vehicleInfo.stereoCameraExpandableHeader')}>
                          <Box variant="p" color="inherit">
                            <Box variant="small">{t('vehicleInfo.stereoCameraContent')}</Box>
                          </Box>
                        </ExpandableSection>
                      </>
                    ),
                    value: CameraSensor.STEREO_CAMERAS,
                  },
                ]}
              />
              <hr />
            </Box>
            <FormField label={t('vehicleInfo.addOnSensor')}>
              <Checkbox
                checked={!!lidarSensor}
                onChange={({ detail }) => {
                  if (detail.checked) {
                    setValue('metadata.sensors.lidar', LidarSensor.SECTOR_LIDAR);
                  } else {
                    setValue('metadata.sensors.lidar', undefined);
                  }
                }}
              >
                <>
                  <Box>{t('vehicleInfo.lidar')}</Box>
                  <Box variant="p" color="text-body-secondary">
                    {t('vehicleInfo.lidarDescription')}
                  </Box>
                </>
              </Checkbox>
            </FormField>
          </Box>
          <Box>
            <img alt="Spec" className="carImageSpec" src={renderSpecImage()} />
          </Box>
        </ColumnLayout>
      </Container>
      <Container
        data-testid={t('vehicleInfo.hyperparametersHeader')}
        header={<Header>{t('vehicleInfo.hyperparametersHeader')}</Header>}
        footer={
          <ExpandableSection
            className="algorithm-settings"
            variant="footer"
            headerText={t('vehicleInfo.hyperparametersLabel')}
          >
            <SpaceBetween direction="vertical" size="l">
              <RadioGroupField
                control={control}
                name="metadata.hyperparameters.batch_size"
                label={t('vehicleInfo.gradientDescent')}
                type="number"
                items={[
                  {
                    label: '32',
                    value: 32,
                  },
                  {
                    label: '64',
                    value: 64,
                  },
                  {
                    label: '128',
                    value: 128,
                  },
                  {
                    label: '256',
                    value: 256,
                  },
                  {
                    label: '512',
                    value: 512,
                  },
                ]}
              />
              {isPPOAlgorithm && (
                <InputField
                  control={control}
                  name="metadata.hyperparameters.num_epochs"
                  label={t('vehicleInfo.numberOfEpochs')}
                  constraintText={t('vehicleInfo.numberOfEpochsDescription')}
                  type="number"
                />
              )}
              <InputField
                control={control}
                name="metadata.hyperparameters.lr"
                label={t('vehicleInfo.learningRate')}
                constraintText={t('vehicleInfo.learningRateDescription')}
                type="number"
                step={0.00001}
              />
              {isPPOAlgorithm && (
                <InputField
                  control={control}
                  name="metadata.hyperparameters.beta_entropy"
                  label={t('vehicleInfo.entropy')}
                  constraintText={t('vehicleInfo.entropyDescription')}
                  type="number"
                  step={0.01}
                />
              )}
              {!isPPOAlgorithm && (
                <InputField
                  control={control}
                  name="metadata.hyperparameters.sac_alpha"
                  label={t('vehicleInfo.sacAlpha')}
                  constraintText={t('vehicleInfo.sacAlphaDescription')}
                  type="number"
                  step={0.1}
                />
              )}
              <InputField
                control={control}
                name="metadata.hyperparameters.discount_factor"
                label={t('vehicleInfo.discountFactor')}
                constraintText={t('vehicleInfo.discountFactorDescription')}
                type="number"
                step={0.01}
              />
              <RadioGroupField
                control={control}
                name="metadata.hyperparameters.loss_type"
                label={t('vehicleInfo.lossType')}
                items={[
                  {
                    label: t('vehicleInfo.meanSquaredError'),
                    value: LossType.MEAN_SQUARED_ERROR,
                  },
                  {
                    label: t('vehicleInfo.huber'),
                    value: LossType.HUBER,
                  },
                ]}
              />
              {isPPOAlgorithm && (
                <InputField
                  control={control}
                  name="metadata.hyperparameters.num_episodes_between_training"
                  label={t('vehicleInfo.numberOfEpisodes')}
                  constraintText={t('vehicleInfo.numberOfEpisodesDescription')}
                  type="number"
                />
              )}
            </SpaceBetween>
          </ExpandableSection>
        }
      >
        <RadioGroupField
          control={control}
          name="metadata.agentAlgorithm"
          items={[
            {
              label: t('vehicleInfo.ppo'),
              description: t('vehicleInfo.ppoDescription'),
              disabled: isClonedModel,
              value: AgentAlgorithm.PPO,
            },
            {
              label: t('vehicleInfo.sac'),
              description: t('vehicleInfo.sacDescription'),
              disabled: isClonedModel,
              value: AgentAlgorithm.SAC,
            },
          ]}
          onChange={({ detail }) => {
            if (detail.value === AgentAlgorithm.PPO) {
              setValue('metadata.hyperparameters', DEFAULT_PPO_HYPERPARAMETERS);
            } else {
              setValue('metadata.hyperparameters', DEFAULT_SAC_HYPERPARAMETERS);
            }
          }}
        />
      </Container>
    </SpaceBetween>
  );
};

export default VehicleInfo;
