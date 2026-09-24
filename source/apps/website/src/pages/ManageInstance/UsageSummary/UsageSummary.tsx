// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Box, Container, Grid, Header, Icon, Popover, SpaceBetween } from '@cloudscape-design/components';
import { Profile } from '@deepracer-indy/typescript-client';
import { Trans, useTranslation } from 'react-i18next';

import { useGetGlobalSettingQuery } from '#services/deepRacer/settingsApi.js';

import {
  calculateModelCount,
  calculateModelStorageUsed,
  calculateTrainingAndEvaluationHoursUsed,
  convertMinutesToHours,
  formatValue,
} from './lib';

const UsageSummary = ({ profiles }: { profiles: Profile[] }) => {
  const { t } = useTranslation('manageInstance');

  const { data: globalComputeMinutesLimit } = useGetGlobalSettingQuery({
    key: 'usageQuotas.global.globalComputeMinutesLimit',
  });
  const { data: globalModelCountLimit } = useGetGlobalSettingQuery({ key: 'usageQuotas.global.globalModelCountLimit' });
  const { data: newUserComputeMinutesLimit } = useGetGlobalSettingQuery({
    key: 'usageQuotas.newUser.newUserComputeMinutesLimit',
  });
  const { data: newUserModelCountLimit } = useGetGlobalSettingQuery({
    key: 'usageQuotas.newUser.newUserModelCountLimit',
  });

  return (
    <Container header={<Header variant="h2">{t('usageSummary.header')}</Header>} data-testid="usage-summary">
      <SpaceBetween size="m">
        <Box color="text-body-secondary">{t('usageSummary.description')}</Box>
        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
          <div>
            <SpaceBetween size="s">
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">{t('usageSummary.trainingEvalHoursUsed.label')}</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={<Box padding="s">{t('usageSummary.trainingEvalHoursUsed.popover')}</Box>}
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p" data-testid="training-eval-hrs-used">
                  {calculateTrainingAndEvaluationHoursUsed(t, profiles)}
                </Box>
              </Box>
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">{t('usageSummary.modelsStored.label')}</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={<Box padding="s">{t('usageSummary.modelsStored.popover')}</Box>}
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p">{calculateModelCount(t, profiles)}</Box>
              </Box>
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">{t('usageSummary.storageUsed.label')}</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={<Box padding="s">{t('usageSummary.storageUsed.popover')}</Box>}
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p">{calculateModelStorageUsed(t, profiles)}</Box>
              </Box>
            </SpaceBetween>
          </div>

          <div>
            <SpaceBetween size="s">
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">{t('usageSummary.numberOfUsers.label')}</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={<Box padding="s">{t('usageSummary.numberOfUsers.popover')}</Box>}
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p" data-testid="number-of-users">
                  {formatValue(t, profiles.length, t('usageSummary.units.users'))}
                </Box>
              </Box>
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">{t('usageSummary.registrationMode.label')}</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={<Box padding="s">{t('usageSummary.registrationMode.popover')}</Box>}
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p">{t('usageSummary.registrationMode.value')}</Box>
              </Box>
            </SpaceBetween>
          </div>

          <div>
            <SpaceBetween size="s">
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">{t('usageSummary.globalComputeLimit.label')}</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={<Box padding="s">{t('usageSummary.globalComputeLimit.popover')}</Box>}
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p">
                  {formatValue(t, globalComputeMinutesLimit, t('usageSummary.units.hours'), convertMinutesToHours)}
                </Box>
              </Box>
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">{t('usageSummary.globalModelLimit.label')}</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={<Box padding="s">{t('usageSummary.globalModelLimit.popover')}</Box>}
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p">{formatValue(t, globalModelCountLimit, t('usageSummary.units.models'))}</Box>
              </Box>
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">{t('usageSummary.newUserComputeLimit.label')}</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={
                      <Box padding="s">
                        <Trans t={t} i18nKey="usageSummary.newUserComputeLimit.popover" />
                      </Box>
                    }
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p" data-testid="new-user-compute-usage-limit">
                  {formatValue(t, newUserComputeMinutesLimit, t('usageSummary.units.hours'), convertMinutesToHours)}
                </Box>
              </Box>
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">{t('usageSummary.newUserModelLimit.label')}</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={
                      <Box padding="s">
                        <Trans t={t} i18nKey="usageSummary.newUserModelLimit.popover" />
                      </Box>
                    }
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p">{formatValue(t, newUserModelCountLimit, t('usageSummary.units.models'))}</Box>
              </Box>
            </SpaceBetween>
          </div>
        </Grid>
      </SpaceBetween>
    </Container>
  );
};

export default UsageSummary;
