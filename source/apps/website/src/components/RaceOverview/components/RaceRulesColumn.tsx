// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Grid from '@cloudscape-design/components/grid';
import { Leaderboard } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import RuleLabelWithPopover from './RuleLabelWithPopover';

interface RaceRulesColumnProps {
  leaderboard: Leaderboard;
}

const RaceRulesColumn = ({ leaderboard }: RaceRulesColumnProps) => {
  const { timingMethod, resettingBehaviorConfig, submissionTerminationConditions } = leaderboard;

  const { t } = useTranslation('raceDetails');

  return (
    <>
      <Box fontWeight="bold">{t('raceRulesColumn.header')}</Box>
      <Grid gridDefinition={[{ colspan: { xxs: 3, default: 6 } }, { colspan: { xxs: 9, default: 6 } }]}>
        <div>
          <RuleLabelWithPopover
            content={t(`raceRulesColumn.rankingMethodPopoverContents.${timingMethod}`)}
            header={t(`raceRulesColumn.timingMethodLabels.${timingMethod}`)}
          >
            {t('raceRulesColumn.rankingMethod')}
          </RuleLabelWithPopover>
          <Box margin={{ bottom: 'xxxs' }}>{t('raceRulesColumn.style')}</Box>
          <Box margin={{ bottom: 'xxxs' }}>{t('raceRulesColumn.entryCriteria')}</Box>
          <RuleLabelWithPopover
            content={t('raceRulesColumn.resetsPopoverContent')}
            header={t('raceRulesColumn.resets')}
          >
            {t('raceRulesColumn.resets')}
          </RuleLabelWithPopover>
          {resettingBehaviorConfig?.offTrackPenaltySeconds && (
            <RuleLabelWithPopover
              header={t('raceRulesColumn.offTrackPenalty')}
              content={t('raceRulesColumn.offTrackPenaltyPopoverContent')}
            >
              {t('raceRulesColumn.offTrackPenalty')}
            </RuleLabelWithPopover>
          )}
          {resettingBehaviorConfig?.collisionPenaltySeconds && (
            <RuleLabelWithPopover
              header={t('raceRulesColumn.collisionPenalty')}
              content={t('raceRulesColumn.collisionPenaltyPopoverContent')}
            >
              {t('raceRulesColumn.collisionPenalty')}
            </RuleLabelWithPopover>
          )}
        </div>
        <div>
          <Box margin={{ bottom: 'xxxs' }}>{t(`raceRulesColumn.timingMethodLabels.${timingMethod}`)}</Box>
          <Box margin={{ bottom: 'xxxs' }}>{t('raceRulesColumn.individualLap')}</Box>
          <Box margin={{ bottom: 'xxxs' }}>
            {t('raceRulesColumn.consecutiveLapCount', { count: submissionTerminationConditions.minimumLaps })}
          </Box>
          <Box margin={{ bottom: 'xxxs' }}>{t('raceRulesColumn.resetCountUnlimited')}</Box>
          {resettingBehaviorConfig?.offTrackPenaltySeconds && (
            <Box margin={{ bottom: 'xxxs' }}>
              {t('raceRulesColumn.secondCount', { count: resettingBehaviorConfig.offTrackPenaltySeconds })}
            </Box>
          )}
          {resettingBehaviorConfig?.collisionPenaltySeconds && (
            <Box>{t('raceRulesColumn.secondCount', { count: resettingBehaviorConfig.collisionPenaltySeconds })}</Box>
          )}
        </div>
      </Grid>
    </>
  );
};

export default RaceRulesColumn;
