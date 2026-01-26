// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { tracks } from '@deepracer-indy/config';
import { TrackDirection, TrackId } from '@deepracer-indy/typescript-client';

export interface Track {
  description: string;
  difficulty: number;
  disabled: boolean;
  length: number;
  trackId: TrackId;
  defaultDirection: TrackDirection;
  enabledDirections: TrackDirection[];
  name: string;
  width: number;
}

export const TRACKS = tracks as Track[];

// Initialize 6 object positions since max allowed object count is 6
export const DEFAULT_OBJECT_POSITIONS = Array.from({ length: 6 }, (_, index) => ({
  laneNumber: index % 2 === 0 ? 1 : -1,
  trackPercentage: ((index + 1) * 15) / 100, // 15, 30 ...
}));
