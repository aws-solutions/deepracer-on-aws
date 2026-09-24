// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DynamoDBRecord } from 'aws-lambda';

import { buildDeviceEvents, parseDeviceRecord } from '../deviceBroadcast.js';

const INSTANCE = 'mi-0123456789abcdef0';
const devicePk = { S: `device#${INSTANCE}` };

const record = (over: Partial<DynamoDBRecord> & { dynamodb?: DynamoDBRecord['dynamodb'] }): DynamoDBRecord =>
  ({ eventName: 'MODIFY', dynamodb: {}, ...over }) as DynamoDBRecord;

describe('parseDeviceRecord', () => {
  it('returns undefined for non-device records', () => {
    expect(parseDeviceRecord(record({ dynamodb: { NewImage: { pk: { S: 'leaderboard_abc' } } } }))).toBeUndefined();
  });

  it('parses a device MODIFY using the NewImage pk', () => {
    const parsed = parseDeviceRecord(record({ dynamodb: { NewImage: { pk: devicePk } } }));
    expect(parsed).toMatchObject({ instanceId: INSTANCE, eventName: 'MODIFY', isTtlDelete: false });
  });

  it('flags a TTL delete (REMOVE by the DynamoDB service principal)', () => {
    const parsed = parseDeviceRecord(
      record({
        eventName: 'REMOVE',
        dynamodb: { OldImage: { pk: devicePk } },
        userIdentity: { type: 'Service', principalId: 'dynamodb.amazonaws.com' },
      }),
    );
    expect(parsed).toMatchObject({ instanceId: INSTANCE, eventName: 'REMOVE', isTtlDelete: true });
  });

  it('does NOT flag an API-initiated REMOVE as a TTL delete', () => {
    const parsed = parseDeviceRecord(record({ eventName: 'REMOVE', dynamodb: { OldImage: { pk: devicePk } } }));
    expect(parsed?.isTtlDelete).toBe(false);
  });
});

describe('buildDeviceEvents', () => {
  it('emits DEVICE_STATUS_CHANGED on a status transition', () => {
    const events = buildDeviceEvents({
      instanceId: INSTANCE,
      eventName: 'MODIFY',
      newImage: { status: { S: 'ONLINE' } },
      oldImage: { status: { S: 'OFFLINE' } },
      isTtlDelete: false,
    });
    expect(events).toEqual([
      expect.objectContaining({ eventType: 'DEVICE_STATUS_CHANGED', status: 'ONLINE', instanceId: INSTANCE }),
    ]);
  });

  it('emits DEVICE_STATUS_CHANGED on INSERT', () => {
    const events = buildDeviceEvents({
      instanceId: INSTANCE,
      eventName: 'INSERT',
      newImage: { status: { S: 'ONLINE' } },
      oldImage: undefined,
      isTtlDelete: false,
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: 'DEVICE_STATUS_CHANGED', status: 'ONLINE' });
  });

  it('emits DEVICE_COMMAND_RESULT when the command fields change', () => {
    const events = buildDeviceEvents({
      instanceId: INSTANCE,
      eventName: 'MODIFY',
      newImage: {
        status: { S: 'ONLINE' },
        lastCommandId: { S: 'cmd-1' },
        lastCommandStatus: { S: 'Success' },
        lastCommandAt: { S: '2026-08-17T00:00:00.000Z' },
      },
      oldImage: { status: { S: 'ONLINE' } },
      isTtlDelete: false,
    });
    expect(events).toEqual([
      expect.objectContaining({
        eventType: 'DEVICE_COMMAND_RESULT',
        commandId: 'cmd-1',
        commandStatus: 'Success',
      }),
    ]);
  });

  it('emits nothing for REMOVE records', () => {
    expect(
      buildDeviceEvents({
        instanceId: INSTANCE,
        eventName: 'REMOVE',
        newImage: undefined,
        oldImage: { status: { S: 'ONLINE' } },
        isTtlDelete: true,
      }),
    ).toEqual([]);
  });

  it('emits nothing when nothing relevant changed', () => {
    expect(
      buildDeviceEvents({
        instanceId: INSTANCE,
        eventName: 'MODIFY',
        newImage: { status: { S: 'ONLINE' }, lastSeenAt: { S: 'x' } },
        oldImage: { status: { S: 'ONLINE' } },
        isTtlDelete: false,
      }),
    ).toEqual([]);
  });
});
