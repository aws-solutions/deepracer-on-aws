// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarType, DeviceStatus, DeviceType } from '@deepracer-indy/typescript-server-client';
import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { DeviceEntity, type DeviceItem } from '../entities/DeviceEntity.js';
import type { ResourceId } from '../types/resource.js';

/**
 * Data access for {@link DeviceEntity}.
 *
 */
export class DeviceDao extends BaseDao<DeviceEntity> {
  /** Lists devices of a single type (DevicesByType GSI), ordered by activation date. */
  @logMethod
  listByType(
    deviceType: DeviceType,
    { cursor = null, maxResults = DEFAULT_MAX_QUERY_RESULTS }: { cursor?: string | null; maxResults?: number } = {},
  ) {
    return this.entity.query.byDeviceType({ deviceType }).go({ cursor, limit: maxResults });
  }

  /** Lists every device assigned to a fleet (DevicesByFleet GSI), ordered by name. */
  @logMethod
  async listByFleet(fleetId: ResourceId): Promise<DeviceItem[]> {
    const { data } = await this.entity.query.byFleetId({ fleetId }).go({ pages: 'all' });
    return data;
  }

  /**
   * Lists devices across every type, paging through one DevicesByType partition at a time
   * and honoring an opaque cursor. `deviceType` has a small, fixed cardinality, so this
   * pages each partition in order rather than scanning the table. Returns up to `maxResults`
   * rows plus a `cursor` for the next page (`null` once every partition is exhausted).
   */
  @logMethod
  async listAll({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: { cursor?: string | null; maxResults?: number } = {}): Promise<DeviceListPage> {
    const types = Object.values(DeviceType);
    let { typeIndex, inner } = decodeListAllCursor(cursor);
    const data: DeviceItem[] = [];

    while (typeIndex < types.length && data.length < maxResults) {
      const result = await this.entity.query
        .byDeviceType({ deviceType: types[typeIndex] })
        .go({ cursor: inner, limit: maxResults - data.length });
      data.push(...result.data);

      if (result.cursor) {
        // More rows remain in this partition — resume here on the next call.
        return { data, cursor: encodeListAllCursor(typeIndex, result.cursor) };
      }
      // Partition exhausted — advance to the next type.
      typeIndex += 1;
      inner = null;
    }

    // Every partition is exhausted, or the page filled exactly at a type boundary.
    return { data, cursor: typeIndex < types.length ? encodeListAllCursor(typeIndex, null) : null };
  }

  /**
   * Create-or-update a device row from an SSM status observation.
   *
   */
  @logMethod
  async upsertStatus(params: {
    instanceId: string;
    name: string;
    deviceType: DeviceType;
    status: DeviceStatus;
    activatedAt: string;
    lastSeenAt: string;
    ttl: number;
    fleetId?: ResourceId;
    ipAddress?: string;
    carType?: CarType;
    loggingCapable?: boolean;
  }): Promise<DeviceItem> {
    const { instanceId, name, deviceType, status, activatedAt, lastSeenAt, ttl, fleetId, ipAddress, carType } = params;
    const { loggingCapable } = params;
    const mutableFields = {
      status,
      lastSeenAt,
      ttl,
      name,
      ...(fleetId ? { fleetId } : {}),
      ...(ipAddress ? { ipAddress } : {}),
      ...(carType ? { carType } : {}),
      ...(loggingCapable === undefined ? {} : { loggingCapable }),
    };

    const existing = await this.get({ instanceId });
    if (existing) {
      return this.partialUpdate({ instanceId }, mutableFields);
    }

    try {
      return await this.create({
        instanceId,
        name,
        deviceType,
        status,
        activatedAt,
        lastSeenAt,
        ttl,
        ...(fleetId ? { fleetId } : {}),
        ...(ipAddress ? { ipAddress } : {}),
        ...(carType ? { carType } : {}),
        ...(loggingCapable === undefined ? {} : { loggingCapable }),
      });
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        return this.partialUpdate({ instanceId }, mutableFields);
      }
      throw error;
    }
  }

  /**
   * Persist the latest remote-command outcome (restart/stop/color) on the device row.
   */
  @logMethod
  recordCommand(params: {
    instanceId: string;
    lastCommandId: string;
    lastCommandStatus: string;
    lastCommandAt: string;
  }): Promise<DeviceItem> {
    const { instanceId, ...fields } = params;
    return this.partialUpdate({ instanceId }, fields);
  }
}

export const deviceDao = new DeviceDao(DeviceEntity);

/** A page of devices plus an opaque cursor for the next page (`null` when exhausted). */
export interface DeviceListPage {
  data: DeviceItem[];
  cursor: string | null;
}

/**
 * Opaque cursor for {@link DeviceDao.listAll}
 */
function encodeListAllCursor(typeIndex: number, inner: string | null): string {
  return Buffer.from(JSON.stringify({ t: typeIndex, c: inner }), 'utf8').toString('base64url');
}

function decodeListAllCursor(cursor: string | null): { typeIndex: number; inner: string | null } {
  if (!cursor) {
    return { typeIndex: 0, inner: null };
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { t?: unknown; c?: unknown };
    if (
      Number.isInteger(parsed.t) &&
      (parsed.t as number) >= 0 &&
      (parsed.c === null || typeof parsed.c === 'string')
    ) {
      return { typeIndex: parsed.t as number, inner: parsed.c ?? null };
    }
  } catch {
    // Unparseable cursor — restart from the first partition rather than failing the request.
  }
  return { typeIndex: 0, inner: null };
}

function isConditionalCheckFailure(error: unknown): boolean {
  const err = error as { name?: string; message?: string; cause?: { name?: string } };
  return (
    err?.name === 'ConditionalCheckFailedException' ||
    err?.cause?.name === 'ConditionalCheckFailedException' ||
    (err?.message?.includes('conditional request failed') ?? false)
  );
}
