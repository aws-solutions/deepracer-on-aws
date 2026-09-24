// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { StatusIndicatorProps } from '@cloudscape-design/components/status-indicator';
import { RunStatus } from '@deepracer-indy/typescript-client';

export interface ActiveRunStatusIndicator {
  textKey: `runStatus.${RunStatus}`;
  type: StatusIndicatorProps.Type;
}

export const ACTIVE_RUN_STATUS_INDICATOR: Record<RunStatus, ActiveRunStatusIndicator | undefined> = {
  [RunStatus.READY]: { textKey: 'runStatus.READY', type: 'pending' },
  [RunStatus.IN_PROGRESS]: { textKey: 'runStatus.IN_PROGRESS', type: 'in-progress' },
  [RunStatus.PAUSED]: { textKey: 'runStatus.PAUSED', type: 'stopped' },
  [RunStatus.FINISHED]: { textKey: 'runStatus.FINISHED', type: 'success' },
  [RunStatus.SUBMITTED]: undefined,
  [RunStatus.DISCARDED]: undefined,
};
