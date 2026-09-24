// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { FleetItem } from '@deepracer-indy/database';
import type { Fleet } from '@deepracer-indy/typescript-server-client';

/**
 * Maps a {@link FleetItem} entity to the Smithy {@link Fleet} response shape.
 * `deviceCount` is supplied by the caller (from a DevicesByFleet query) when available.
 */
export const toFleetResponse = (item: FleetItem, deviceCount?: number): Fleet => ({
  fleetId: item.fleetId,
  name: item.name,
  createdAt: new Date(item.createdAt),
  ...(deviceCount !== undefined && { deviceCount }),
});
