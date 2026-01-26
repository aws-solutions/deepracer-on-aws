// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Control } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';

import InputField from '#components/FormFields/InputField';
import { CreateModelFormValues } from '#pages/CreateModel/types';

interface StopConditionProps {
  control: Control<CreateModelFormValues>;
}

const StopCondition = ({ control }: StopConditionProps) => {
  const { t } = useTranslation('createModel', { keyPrefix: 'stopCondition' });

  return (
    <Container header={<Header variant="h2">{t('title')}</Header>}>
      <SpaceBetween size="m">
        <Trans t={t} i18nKey="content1" />
        <Box>{t('content2')}</Box>
        <Box>
          <Grid gridDefinition={[{ colspan: 2 }]}>
            <InputField
              control={control}
              label={t('maximumTimeLabel')}
              name="trainingConfig.maxTimeInMinutes"
              type="number"
            />
          </Grid>
          <Box color="text-status-inactive" fontSize="body-s" padding={{ top: 'xxs' }}>
            {t('maximumTimeInfo')}
          </Box>
        </Box>
      </SpaceBetween>
    </Container>
  );
};

export default StopCondition;
