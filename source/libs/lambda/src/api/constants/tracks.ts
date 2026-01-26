// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { tracks } from '@deepracer-indy/config';
import { TrackDirection, TrackId } from '@deepracer-indy/typescript-server-client';

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
