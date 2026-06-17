// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LiveEventStatus } from '@deepracer-indy/typescript-client';

import type { RaceStatus } from './types';

/**
 * Maps backend liveEventStatus to the UI RaceStatus used by the banner.
 * SCHEDULED (pre-race) shows no banner — banner is for live race state transitions only.
 * Note: SUBMISSIONS_OPEN/SUBMISSIONS_CLOSED are driven separately by the
 * submissionPeriodOpen/liveEventTime fields, not liveEventStatus.
 */
export const mapLiveEventStatusToRaceStatus = (liveEventStatus: LiveEventStatus | undefined): RaceStatus | null => {
  if (liveEventStatus === LiveEventStatus.IN_PROGRESS) return 'IN_PROGRESS';
  if (liveEventStatus === LiveEventStatus.COMPLETED) return 'COMPLETED';
  return null;
};
