// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import './RacerInfoBanner.css';

import type { AvatarConfig } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import AvatarDisplay from '#components/Avatar/AvatarDisplay';

interface RacerInfoBannerProps {
  participantName: string | null;
  avatar?: AvatarConfig;
}

/**
 * Displays the current racer's information during a live race.
 * Shows participant name and avatar.
 */
const RacerInfoBanner = ({ participantName, avatar }: RacerInfoBannerProps) => {
  const { t } = useTranslation('liveRace');

  if (!participantName) {
    return null;
  }

  return (
    <div className="racerChyron" data-testid="racer-info-banner">
      <div className="racerChyron__avatar">
        <AvatarDisplay avatarConfig={avatar} displaySize={48} />
      </div>
      <div className="racerChyron__info">
        <span className="racerChyron__label">{t('racerInfoBanner.nowRacing')}</span>
        <span className="racerChyron__name">{participantName}</span>
      </div>
    </div>
  );
};

export default RacerInfoBanner;
