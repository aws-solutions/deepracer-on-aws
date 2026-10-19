// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  DeregisterManagedInstanceCommand,
  DescribeInstanceInformationCommand,
  type InstanceInformation,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-ssm';
import { deviceDao, type DeviceItem, type ResourceId } from '@deepracer-indy/database';
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
 * Tag a re-activated device stamps on its new managed instance, naming the managed instance
 * it registered as before the SSM override (car_activation.sh reads it from the agent's
 * registration file). Accepting the override issues a new `mi-` id and leaves the old one
 * registered, so without this link every re-activation adds a second row for the same car.
 */
export const PREVIOUS_INSTANCE_TAG_KEY = 'PreviousInstanceId';

const MANAGED_INSTANCE_ID_PATTERN = /^mi-[0-9a-f]+$/;

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
 * Most superseded instances followed back from one re-activation (mi-3 → mi-2 → mi-1 …). A car
 * re-activated several times before the first retirement completes leaves such a chain.
 */
const MAX_SUPERSEDED_CHAIN = 3;

/** The device that superseded a previous row: the identity the previous row must match. */
interface Successor {
  instanceId: string;
  deviceType: DeviceType;
  name: string;
  fleetId?: string;
  registeredAt?: Date;
}

const isInvalidInstanceId = (error: unknown): boolean => (error as { name?: string })?.name === 'InvalidInstanceId';

/** Describe one managed instance; undefined if SSM no longer knows it. */
async function describeInstance(instanceId: string): Promise<InstanceInformation | undefined> {
  try {
    const response = await ssmClient.send(
      new DescribeInstanceInformationCommand({ Filters: [{ Key: 'InstanceIds', Values: [instanceId] }] }),
    );
    return response.InstanceInformationList?.[0];
  } catch (error) {
    if (isInvalidInstanceId(error)) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Whether a superseded instance may still be a live car: SSM reports it Online, or it pinged
 * after its successor registered.
 */
const isStillActive = (info: InstanceInformation, successorRegisteredAt: Date | undefined): boolean =>
  info.PingStatus === 'Online' ||
  (successorRegisteredAt !== undefined &&
    info.LastPingDateTime !== undefined &&
    info.LastPingDateTime > successorRegisteredAt);

/** Deregister a managed instance; one that is already gone counts as deregistered. */
async function deregisterInstance(instanceId: string): Promise<void> {
  try {
    await ssmClient.send(new DeregisterManagedInstanceCommand({ InstanceId: instanceId }));
  } catch (error) {
    if (!isInvalidInstanceId(error)) {
      throw error;
    }
  }
}

/**
 * Load the row named by a `PreviousInstanceId` tag value, if it is of the same device type,
 * name and fleet as its successor.
 *
 * The tag is device-supplied, but a device cannot set its own `Name` or `fleetId` tags: both
 * come from the activation an operator created. Requiring the previous row to match them means
 * a device can only claim a record the operator re-activated under that name (and, when both
 * have one, that fleet), not any car. Names are not unique, so the fleet narrows it further.
 */
async function loadPreviousDevice(
  previousInstanceId: string | undefined,
  successor: Successor,
): Promise<DeviceItem | undefined> {
  const { instanceId, deviceType, name, fleetId } = successor;
  if (!previousInstanceId || previousInstanceId === instanceId) {
    return undefined;
  }
  if (!MANAGED_INSTANCE_ID_PATTERN.test(previousInstanceId)) {
    logger.warn('Ignoring malformed PreviousInstanceId tag', { instanceId, previousInstanceId });
    return undefined;
  }
  const previous = (await deviceDao.get({ instanceId: previousInstanceId })) ?? undefined;
  const fleetMismatch = fleetId !== undefined && previous?.fleetId !== undefined && previous.fleetId !== fleetId;
  if (previous && (previous.deviceType !== deviceType || previous.name !== name || fleetMismatch)) {
    logger.warn('PreviousInstanceId names a device of another type, name or fleet; ignoring', {
      instanceId,
      previousInstanceId,
    });
    return undefined;
  }
  return previous;
}

/**
 * Deregister the superseded managed instance and delete its row, so a re-activated car has
 * exactly one row.
 *
 * The old instance is only retired once it has stopped pinging: it must not be Online, and
 * when its successor's registration time is known, its last ping must not be later than it. A
 * car that is still live is never deregistered on another device's say-so. Until SSM reports
 * the old instance offline the retirement is retried on every sync.
 *
 * @returns whether the previous device was retired and, if so, the instance it had itself
 *   superseded (read from its tags before deregistering, when SSM still knows it) and when it
 *   registered.
 */
async function retirePreviousDevice(
  previous: DeviceItem,
  successor: Successor,
): Promise<{ retired: boolean; olderInstanceId?: string; registeredAt?: Date }> {
  const previousInstanceId = previous.instanceId;
  const previousInfo = await describeInstance(previousInstanceId);
  let olderInstanceId: string | undefined;

  if (previousInfo) {
    if (isStillActive(previousInfo, successor.registeredAt)) {
      logger.info('Previous managed instance still active; deferring retirement', {
        instanceId: successor.instanceId,
        previousInstanceId,
        pingStatus: previousInfo.PingStatus,
      });
      return { retired: false };
    }
    // Its tags are gone once it is deregistered, so read them first.
    const previousTags = await readTags(previousInstanceId);
    // The row's name may have fallen back to the device-reported ComputerName, so confirm the
    // instance's own operator-set Name tag before deregistering it.
    if (previousTags.Name !== successor.name) {
      logger.warn('Previous managed instance has a different Name tag; not retiring', {
        instanceId: successor.instanceId,
        previousInstanceId,
      });
      return { retired: false };
    }
    olderInstanceId = previousTags[PREVIOUS_INSTANCE_TAG_KEY];
    await deregisterInstance(previousInstanceId);
  }

  await deviceDao.delete({ instanceId: previousInstanceId });
  logger.info('Retired device superseded by re-activation', {
    action: 'DEVICE_SUPERSEDED',
    instanceId: successor.instanceId,
    previousInstanceId,
  });
  return { retired: true, olderInstanceId, registeredAt: previousInfo?.RegistrationDate };
}

/**
 * Upsert one managed instance's identity + status into the device table.
 *
 * When the instance carries a `PreviousInstanceId` tag (a re-activation that overrode an
 * existing SSM registration), the previous row's fleet and car type carry over to the new
 * row and the previous instance is retired.
 *
 * @param retiredInstanceIds Instance ids retired during this run. The poller passes one set
 *   for the whole poll so it does not recreate a row it retired earlier in the same page.
 * @returns true if the device was upserted, false if it was skipped.
 */
export async function syncInstance(info: InstanceInformation, retiredInstanceIds?: Set<string>): Promise<boolean> {
  const instanceId = info.InstanceId;
  if (!instanceId) {
    return false;
  }

  if (!instanceId.startsWith('mi-')) {
    return false;
  }
  if (retiredInstanceIds?.has(instanceId)) {
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

  // Only the activation-supplied Name tag links to a previous row; ComputerName is set by
  // the device and is not trusted for that.
  const successor: Successor | undefined = tags.Name
    ? {
        instanceId,
        deviceType,
        name: tags.Name,
        fleetId: tags.fleetId || undefined,
        registeredAt: info.RegistrationDate,
      }
    : undefined;
  const previous = successor ? await loadPreviousDevice(tags[PREVIOUS_INSTANCE_TAG_KEY], successor) : undefined;
  const inherited = await inheritOnFirstSync(instanceId, previous);

  const carType = deviceType === DeviceType.CAR ? (readCarType(tags) ?? inherited?.carType) : undefined;
  const fleetId = (tags.fleetId as ResourceId | undefined) || inherited?.fleetId;

  await deviceDao.upsertStatus({
    instanceId,
    name: tags.Name ?? info.ComputerName ?? instanceId,
    deviceType,
    status: mapPingStatus(info.PingStatus),
    activatedAt,
    lastSeenAt,
    ttl,
    fleetId: fleetId || undefined,
    ipAddress: info.IPAddress ?? undefined,
    ...(carType ? { carType } : {}),
  });

  if (previous && successor) {
    await tryRetireSupersededDevices(previous, successor, retiredInstanceIds);
  }
  return true;
}

/**
 * The previous row whose fleet and car type the new row inherits, only while the new row does
 * not exist yet. After its first sync the new row's own values win, so an operator's later
 * edit (such as clearing the fleet) is not undone while retirement is still waiting.
 */
async function inheritOnFirstSync(
  instanceId: string,
  previous: DeviceItem | undefined,
): Promise<DeviceItem | undefined> {
  if (!previous) {
    return undefined;
  }
  return (await deviceDao.get({ instanceId })) ? undefined : previous;
}

/**
 * Retire the superseded device after the new row is written, then any device it had itself
 * superseded (up to {@link MAX_SUPERSEDED_CHAIN}), recording each in `retiredInstanceIds`.
 * Every step applies the same type/name/fleet and offline checks against the original
 * successor's identity. A failure is logged rather than thrown: the new row is already written
 * and retirement is retried on the next sync.
 */
async function tryRetireSupersededDevices(
  first: DeviceItem,
  successor: Successor,
  retiredInstanceIds: Set<string> | undefined,
): Promise<void> {
  let previous: DeviceItem | undefined = first;
  let current = successor;
  for (let depth = 0; previous && depth < MAX_SUPERSEDED_CHAIN; depth++) {
    const target: DeviceItem = previous;
    try {
      const result = await retirePreviousDevice(target, current);
      if (!result.retired) {
        return;
      }
      retiredInstanceIds?.add(target.instanceId);
      current = { ...successor, instanceId: target.instanceId, registeredAt: result.registeredAt };
      previous = await loadPreviousDevice(result.olderInstanceId, current);
    } catch (error) {
      logger.warn('Failed to retire superseded device', {
        action: 'DEVICE_SUPERSEDE_FAILURE',
        instanceId: current.instanceId,
        previousInstanceId: target.instanceId,
        error,
      });
      return;
    }
  }
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
