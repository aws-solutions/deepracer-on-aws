// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { LapItem } from '@deepracer-indy/database';
import type { Lap } from '@deepracer-indy/typescript-server-client';

/** Maps a LapItem entity to the Smithy Lap response shape. */
export const toLapResponse = (item: LapItem): Lap => ({
  runId: item.runId,
  leaderboardId: item.leaderboardId,
  ...(item.deviceId && { deviceId: item.deviceId }),
  lapNumber: item.lapNumber,
  lapTimeMs: item.lapTimeMs,
  isValid: item.isValid,
  createdAt: new Date(item.createdAt),
  updatedAt: new Date(item.updatedAt),
  ...(item.resets !== undefined && { resets: item.resets }),
  ...(item.originalLapTimeMs !== undefined && { originalLapTimeMs: item.originalLapTimeMs }),
  ...(item.editedBy && { editedBy: item.editedBy }),
  ...(item.editedAt && { editedAt: new Date(item.editedAt) }),
  ...(item.editReason && { editReason: item.editReason }),
});
