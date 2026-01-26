// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import { Leaderboard } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import { getUTCOffsetTimeZoneText } from '#utils/dateTimeUtils.js';

interface RaceDetailsColumnProps {
  leaderboard: Leaderboard;
}

const RaceDetailsColumn = ({ leaderboard }: RaceDetailsColumnProps) => {
  const { closeTime, openTime, raceType } = leaderboard;

  const { t } = useTranslation('raceDetails');

  return (
    <KeyValuePairs
      items={[
        {
          label: t('raceDetailsColumnLabels.raceType'),
          value: t(`raceType.${raceType}`),
        },
        {
          label: t('raceDetailsColumnLabels.raceDates'),
          value: (
            <>
              <div>{t('start', { value: openTime })}</div>
              <div>{t('end', { value: closeTime })}</div>
            </>
          ),
        },
        {
          label: t('raceDetailsColumnLabels.timezone'),
          value: getUTCOffsetTimeZoneText(),
        },
      ]}
    />
  );
};

export default RaceDetailsColumn;
