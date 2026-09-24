// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { RunItem } from '@deepracer-indy/database';
import type { Run } from '@deepracer-indy/typescript-server-client';

/** Maps a RunItem entity to the Smithy Run response shape. */
export const toRunResponse = (item: RunItem): Run => ({
  runId: item.runId,
  leaderboardId: item.leaderboardId,
  eventId: item.eventId,
  profileId: item.profileId,
  runStatus: item.runStatus,
  racedByProxy: item.racedByProxy,
  createdAt: new Date(item.createdAt),
  updatedAt: new Date(item.updatedAt),
});
