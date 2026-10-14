// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DeviceItem } from '@deepracer-indy/database';
import type { CarType, Device, DeviceStatus, DeviceType } from '@deepracer-indy/typescript-server-client';

/**
 * Maps a {@link DeviceItem} entity to the Smithy {@link Device} response shape.
 *
 * ISO timestamp strings are converted to `Date` (the generated model types), and optional
 * fields are omitted when absent. Status is returned as persisted (DDB-only, no live SSM
 * merge).
 */
export const toDeviceResponse = (item: DeviceItem): Device => ({
  instanceId: item.instanceId,
  name: item.name,
  deviceType: item.deviceType as DeviceType,
  status: item.status as DeviceStatus,
  activatedAt: new Date(item.activatedAt),
  ...(item.carType && { carType: item.carType as CarType }),
  ...(item.loggingCapable !== undefined && { loggingCapable: item.loggingCapable }),
  ...(item.fleetId && { fleetId: item.fleetId }),
  ...(item.lastSeenAt && { lastSeenAt: new Date(item.lastSeenAt) }),
  ...(item.ipAddress && { ipAddress: item.ipAddress }),
  ...(item.metadata && { metadata: { ssid: item.metadata.ssid, gpioPins: item.metadata.gpioPins } }),
});
