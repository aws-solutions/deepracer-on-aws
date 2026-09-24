// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Link from '@cloudscape-design/components/link';
import Popover from '@cloudscape-design/components/popover';
import { EventStatus } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PageId } from '#constants/pages.js';
import { useTimekeepingContext } from '#hooks/useTimekeepingContext.js';
import { getPath } from '#utils/pageUtils.js';

interface TimekeeperLinkCellProps {
  eventId: string;
  leaderboardId: string;
  linkText: string;
  eventStatus: EventStatus;
}

export const TimekeeperLinkCell = ({ eventId, leaderboardId, linkText, eventStatus }: TimekeeperLinkCellProps) => {
  const { t } = useTranslation('events');
  const navigate = useNavigate();
  const { setEventAndTrack } = useTimekeepingContext();
  const path = getPath(PageId.TIMEKEEPING);

  if (eventStatus !== EventStatus.IN_PROGRESS) {
    return (
      <Popover content={t('detail.tracks.table.timekeepDisabledReason')} triggerType="text">
        <Box color="text-status-inactive">{linkText}</Box>
      </Popover>
    );
  }

  return (
    <Link
      href={path}
      onFollow={(event) => {
        event.preventDefault();
        setEventAndTrack(eventId, leaderboardId);
        navigate(path);
      }}
    >
      {linkText}
    </Link>
  );
};
