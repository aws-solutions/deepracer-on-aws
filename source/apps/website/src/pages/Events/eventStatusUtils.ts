// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StatusIndicatorProps } from '@cloudscape-design/components/status-indicator';
import { EventStatus } from '@deepracer-indy/typescript-client';

/**
 * Maps every EventStatus to a Cloudscape StatusIndicator type.
 *
 * Typed as `Record<EventStatus, ...>` so that TypeScript will produce a
 * compile error if a new status is added to the Smithy model without a
 * corresponding entry here.
 */
export const EVENT_STATUS_TYPE_MAP: Record<EventStatus, StatusIndicatorProps.Type> = {
  [EventStatus.DRAFT]: 'pending',
  [EventStatus.OPEN]: 'pending',
  [EventStatus.IN_PROGRESS]: 'in-progress',
  [EventStatus.COMPLETED]: 'success',
  [EventStatus.ARCHIVED]: 'warning',
  [EventStatus.DELETING]: 'stopped',
};

/**
 * Color overrides for statuses whose default StatusIndicator color needs to differ from
 * the type's default. Sparse — only statuses needing an override are present; StatusIndicator
 * falls back to the type's default color when a status has no entry here.
 */
export const EVENT_STATUS_COLOR_OVERRIDE_MAP: Partial<Record<EventStatus, StatusIndicatorProps.Color>> = {
  [EventStatus.IN_PROGRESS]: 'blue',
};
