// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LiveQueueItemStatus } from '@deepracer-indy/typescript-server-client';

export const REMOVABLE_LIVE_QUEUE_ITEM_STATUSES: LiveQueueItemStatus[] = [
  LiveQueueItemStatus.PENDING,
  LiveQueueItemStatus.FAILED,
];
