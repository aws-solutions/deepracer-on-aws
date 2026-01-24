// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TrackId } from '@deepracer-indy/typescript-client';

import { Track, TRACKS } from '#constants/tracks';

export const getTrackById = (trackId: TrackId) => TRACKS.find((tr) => tr.trackId === trackId) as Track;
