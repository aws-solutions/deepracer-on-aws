// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  DescribeInstanceInformationCommand,
  type InstanceInformation,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-ssm';
import { deviceDao, type ResourceId } from '@deepracer-indy/database';
import { CarType, DeviceStatus, DeviceType } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { ssmClient } from '#utils/clients/ssmClient.js';

/**
 * Control tag stamped on every DeepRacer-onboarded managed instance at activation. The
 * poller only syncs instances carrying it, so account managed instances that are not ours
 * are ignored. Keep in sync with the activation handler / IAM condition.
 */
export const DEEPRACER_MANAGED_TAG_KEY = 'deepracer:managed';

/**
 * Seconds after `lastSeenAt` at which an ONLINE/OFFLINE device row expires via DynamoDB TTL.
 */
export const DEVICE_PRUNE_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Devices whose last ping is older than this are treated as abandoned and skipped.
 */
const MAX_STALE_MS = 90 * 24 * 60 * 60 * 1000;

const mapPingStatus = (pingStatus?: string): DeviceStatus =>
  pingStatus === 'Online' ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE;

/** Recognized CarType tag values, for validating the device-supplied `CarType` tag. */
const CAR_TYPE_VALUES = new Set<string>(Object.values(CarType));

/**
 * Read the optional `CarType` tag the device stamps on its own managed instance after SSM
 * registration (car_activation.sh derives DEEPRACER / DEEPRACER_CUSTOM / DEEPRACER_RPI from
 * the on-device hardware + package inspection).
 */
const readCarType = (tags: Record<string, string>): CarType | undefined => {
  const value = tags.CarType;
  return value !== undefined && CAR_TYPE_VALUES.has(value) ? (value as CarType) : undefined;
};

async function readTags(instanceId: string): Promise<Record<string, string>> {
  const response = await ssmClient.send(
    new ListTagsForResourceCommand({ ResourceType: 'ManagedInstance', ResourceId: instanceId }),
  );
  return Object.fromEntries((response.TagList ?? []).map((tag) => [tag.Key as string, tag.Value as string]));
}

/**
 * Upsert one managed instance's identity + status into the device table.
 *
 * @returns true if the device was upserted, false if it was skipped.
 */
export async function syncInstance(info: InstanceInformation): Promise<boolean> {
  const instanceId = info.InstanceId;
  if (!instanceId) {
    return false;
  }

  if (!instanceId.startsWith('mi-')) {
    return false;
  }
  if (info.LastPingDateTime && Date.now() - info.LastPingDateTime.getTime() > MAX_STALE_MS) {
    logger.info('Skipping stale managed instance (>90d since last ping)', { instanceId });
    return false;
  }

  const tags = await readTags(instanceId);
  if (tags[DEEPRACER_MANAGED_TAG_KEY] !== 'true') {
    return false;
  }
  const deviceType = tags.Type as DeviceType | undefined;
  if (deviceType !== DeviceType.CAR && deviceType !== DeviceType.TIMER) {
    logger.warn('Managed instance missing a valid Type tag; skipping', { instanceId, type: tags.Type });
    return false;
  }

  const lastSeenAt = (info.LastPingDateTime ?? new Date()).toISOString();
  const activatedAt = (info.RegistrationDate ?? new Date()).toISOString();
  const ttl = Math.floor(new Date(lastSeenAt).getTime() / 1000) + DEVICE_PRUNE_TTL_SECONDS;

  const carType = deviceType === DeviceType.CAR ? readCarType(tags) : undefined;

  await deviceDao.upsertStatus({
    instanceId,
    name: tags.Name ?? info.ComputerName ?? instanceId,
    deviceType,
    status: mapPingStatus(info.PingStatus),
    activatedAt,
    lastSeenAt,
    ttl,
    fleetId: (tags.fleetId as ResourceId | undefined) || undefined,
    ipAddress: info.IPAddress ?? undefined,
    ...(carType ? { carType } : {}),
  });
  return true;
}

/**
 * Describe a single managed instance by id and sync it. Used by the registration
 * state-change path, which only carries an instance id.
 *
 * @returns true if the device was upserted, false if not found / skipped.
 */
export async function syncInstanceById(instanceId: string): Promise<boolean> {
  const response = await ssmClient.send(
    new DescribeInstanceInformationCommand({ Filters: [{ Key: 'InstanceIds', Values: [instanceId] }] }),
  );
  const info = response.InstanceInformationList?.[0];
  if (!info) {
    logger.warn('No SSM instance information found for registered instance', { instanceId });
    return false;
  }
  return syncInstance(info);
}
