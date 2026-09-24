// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { AttributeValue, DynamoDBRecord } from 'aws-lambda';

/**
 * Device stream routing for the BroadcastHandler.
 *
 * `device#` rows are written by the Task 5 status poller / state-change handler. Their stream
 * events carry two things the browser needs, pushed via IoT Core (cloud→browser only):
 *  - status transitions (`status` changes) — DEVICE_STATUS_CHANGED
 *  - async command outcomes (`lastCommand*` changes) — DEVICE_COMMAND_RESULT (the payload the
 *    console awaits for a restart/stop/color 202)
 *
 * TTL expiry of a `device#` row surfaces as a REMOVE with a DynamoDB service `userIdentity`;
 * the handler fans that out to the Pruning Lambda (it is not itself a stream consumer).
 */

const DEVICE_PK_PREFIX = 'device#';

type DDBImage = Record<string, AttributeValue>;

const attr = (image: DDBImage | undefined, key: string): string => image?.[key]?.S ?? '';

export interface ParsedDeviceRecord {
  readonly instanceId: string;
  readonly eventName: 'INSERT' | 'MODIFY' | 'REMOVE';
  readonly newImage: DDBImage | undefined;
  readonly oldImage: DDBImage | undefined;
  /** True when this REMOVE was performed by DynamoDB TTL expiry (not an API delete). */
  readonly isTtlDelete: boolean;
}

/**
 * Parse a DDB stream record as a `device#` row, or return undefined if it is not one.
 * Uses NewImage when present (INSERT/MODIFY) and OldImage for REMOVE.
 */
export const parseDeviceRecord = (record: DynamoDBRecord): ParsedDeviceRecord | undefined => {
  const newImage = record.dynamodb?.NewImage as DDBImage | undefined;
  const oldImage = record.dynamodb?.OldImage as DDBImage | undefined;
  const pk = attr(newImage, 'pk') || attr(oldImage, 'pk');
  if (!pk.startsWith(DEVICE_PK_PREFIX)) return undefined;

  const eventName = record.eventName;
  if (eventName !== 'INSERT' && eventName !== 'MODIFY' && eventName !== 'REMOVE') return undefined;

  const instanceId = pk.slice(DEVICE_PK_PREFIX.length);
  // TTL deletes are attributed to the DynamoDB service principal; API deletes are not.
  const isTtlDelete =
    eventName === 'REMOVE' &&
    record.userIdentity?.type === 'Service' &&
    record.userIdentity?.principalId === 'dynamodb.amazonaws.com';

  return { instanceId, eventName, newImage, oldImage, isTtlDelete };
};

/**
 * Build the browser-facing events for a device INSERT/MODIFY: a status-changed event when the
 * status transitions (or on first insert), and a command-result event when the async command
 * fields change. REMOVE events produce no browser event (pruning is handled separately).
 */
export const buildDeviceEvents = (parsed: ParsedDeviceRecord): Array<Record<string, unknown>> => {
  const { instanceId, eventName, newImage, oldImage } = parsed;
  if (eventName === 'REMOVE' || !newImage) return [];

  const events: Array<Record<string, unknown>> = [];
  const base = { instanceId, timestamp: new Date().toISOString() };

  const status = attr(newImage, 'status');
  const oldStatus = attr(oldImage, 'status');
  if (status && (eventName === 'INSERT' || status !== oldStatus)) {
    events.push({ ...base, eventType: 'DEVICE_STATUS_CHANGED', status });
  }

  // A completed remote command bumps lastCommandAt; emit the async result for the browser.
  const commandAt = attr(newImage, 'lastCommandAt');
  const oldCommandAt = attr(oldImage, 'lastCommandAt');
  if (commandAt && commandAt !== oldCommandAt) {
    events.push({
      ...base,
      eventType: 'DEVICE_COMMAND_RESULT',
      commandId: attr(newImage, 'lastCommandId'),
      commandStatus: attr(newImage, 'lastCommandStatus'),
    });
  }

  return events;
};
