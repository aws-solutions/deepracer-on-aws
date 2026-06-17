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
  const { closeTime, openTime, raceType, isLive, liveEventTime, liveEventStatus } = leaderboard;

  const { t } = useTranslation('raceDetails');

  const dateItem = isLive
    ? {
        label: t('raceDetailsColumnLabels.liveEventTime'),
        value: liveEventTime ? liveEventTime.toLocaleString() : '—',
      }
    : {
        label: t('raceDetailsColumnLabels.raceDates'),
        value: (
          <>
            <div>{t('start', { value: openTime })}</div>
            <div>{t('end', { value: closeTime })}</div>
          </>
        ),
      };

  const items = [
    {
      label: t('raceDetailsColumnLabels.raceMode'),
      value: isLive ? t('raceMode.live') : t('raceMode.community'),
    },
    {
      label: t('raceDetailsColumnLabels.raceType'),
      value: t(`raceType.${raceType}`),
    },
    dateItem,
    {
      label: t('raceDetailsColumnLabels.timezone'),
      value: getUTCOffsetTimeZoneText(),
    },
  ];

  if (isLive) {
    items.push({
      label: t('raceDetailsColumnLabels.status'),
      value: t(`liveStatus.${liveEventStatus ?? 'SCHEDULED'}`),
    });
  }

  return <KeyValuePairs items={items} />;
};

export default RaceDetailsColumn;
