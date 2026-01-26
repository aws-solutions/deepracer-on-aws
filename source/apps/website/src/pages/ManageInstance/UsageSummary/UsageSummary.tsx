// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Box, Container, Grid, Header, Icon, Popover, SpaceBetween } from '@cloudscape-design/components';
import { Profile } from '@deepracer-indy/typescript-client';

import { useGetGlobalSettingQuery } from '#services/deepRacer/settingsApi.js';

import {
  calculateModelCount,
  calculateModelStorageUsed,
  calculateTrainingAndEvaluationHoursUsed,
  convertMinutesToHours,
  formatValue,
} from './lib';

const UsageSummary = ({ profiles }: { profiles: Profile[] }) => {
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
    <Container header={<Header variant="h2">Usage summary</Header>} data-testid="usage-summary">
      <SpaceBetween size="m">
        <Box color="text-body-secondary">
          Summarizes the current usage of your deployment, including compute resources, model storage, and any limits
          that have been configured.
        </Box>
        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
          <div>
            <SpaceBetween size="s">
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">Training and evaluation hours used</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={
                      <Box padding="s">
                        This shows the number of hours that have been spent on training and evaluating machine learning
                        users on your deployment.
                      </Box>
                    }
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p" data-testid="training-eval-hrs-used">
                  {calculateTrainingAndEvaluationHoursUsed(profiles)}
                </Box>
              </Box>
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">Models stored</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={
                      <Box padding="s">
                        This shows the total number of models currently stored on your deployment across all users.
                      </Box>
                    }
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p">{calculateModelCount(profiles)}</Box>
              </Box>
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">Storage used</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={
                      <Box padding="s">
                        This shows the total amount of storage space used by all models across all users on your
                        deployment.
                      </Box>
                    }
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p">{calculateModelStorageUsed(profiles)}</Box>
              </Box>
            </SpaceBetween>
          </div>

          <div>
            <SpaceBetween size="s">
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">Number of users</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={
                      <Box padding="s">This shows the total number of users who are registered on your deployment.</Box>
                    }
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p" data-testid="number-of-users">
                  {formatValue(profiles.length, 'users')}
                </Box>
              </Box>
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">Registration mode</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={
                      <Box padding="s">
                        This indicates how new users join your deployment. "Invite only" means users must be explicitly
                        invited by an administrator.
                      </Box>
                    }
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p">Invite only</Box>
              </Box>
            </SpaceBetween>
          </div>

          <div>
            <SpaceBetween size="s">
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">Global compute usage limit</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={
                      <Box padding="s">
                        This shows the maximum total compute hours that can be used across all users in your deployment
                        for training and evaluation.
                      </Box>
                    }
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p">{formatValue(globalComputeMinutesLimit, 'hours', convertMinutesToHours)}</Box>
              </Box>
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">Global model count limit</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={
                      <Box padding="s">
                        This shows the maximum total number of models that can be stored across all users in your
                        deployment.
                      </Box>
                    }
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p">{formatValue(globalModelCountLimit, 'models')}</Box>
              </Box>
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">New user compute usage limit</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={
                      <Box padding="s">
                        This shows the default compute usage limit that will be assigned to new users. To change this,
                        click <i>New user quotas</i> and update <i>New user compute usage limit</i>.
                      </Box>
                    }
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p" data-testid="new-user-compute-usage-limit">
                  {formatValue(newUserComputeMinutesLimit, 'hours', convertMinutesToHours)}
                </Box>
              </Box>
              <Box>
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <Box variant="awsui-key-label">New user model count limit</Box>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="medium"
                    triggerType="custom"
                    content={
                      <Box padding="s">
                        This shows the default model count limit that will be assigned to new users. To change this,
                        click <i>New user quotas</i> and update <i>New user model count limit</i>.
                      </Box>
                    }
                  >
                    <Icon name="status-info" size="medium" />
                  </Popover>
                </SpaceBetween>
                <Box variant="p">{formatValue(newUserModelCountLimit, 'models')}</Box>
              </Box>
            </SpaceBetween>
          </div>
        </Grid>
      </SpaceBetween>
    </Container>
  );
};

export default UsageSummary;
