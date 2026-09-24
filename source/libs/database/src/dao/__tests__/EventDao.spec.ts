// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EventStatus, EventType, RaceFormat } from '@deepracer-indy/typescript-server-client';

import { TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { generateResourceId } from '../../utils/resourceUtils.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';
import { eventDao } from '../EventDao.js';

const makeEvent = (status: EventStatus) => ({
  name: generateResourceId(),
  createdBy: 'testAlias',
  eventType: EventType.OFFICIAL_TRACK_RACE,
  eventStatus: status,
  eventDate: '2026-09-07',
  countryCode: 'US',
  raceFormat: RaceFormat.BEST_LAP,
  maxLaps: 5,
  maxTimeInMinutes: 3,
  maxRunsPerRacer: 3,
  maxResets: 0,
});

describe('EventDao', () => {
  beforeEach(async () => {
    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
    if (Items?.length) {
      await Promise.all(
        Items.map((item) =>
          testDynamoDBDocumentClient.delete({ TableName: TEST_TABLE_NAME, Key: { pk: item.pk, sk: item.sk } }),
        ),
      );
    }
  });

  describe('list()', () => {
    it('should return all events when no status filter is provided', async () => {
      await Promise.all([
        eventDao.create(makeEvent(EventStatus.DRAFT) as Parameters<typeof eventDao.create>[0]),
        eventDao.create(makeEvent(EventStatus.OPEN) as Parameters<typeof eventDao.create>[0]),
        eventDao.create(makeEvent(EventStatus.DELETING) as Parameters<typeof eventDao.create>[0]),
      ]);

      const { data } = await eventDao.list({});

      expect(data).toHaveLength(2);
    });

    it('should return only events matching the status filter', async () => {
      await Promise.all([
        eventDao.create(makeEvent(EventStatus.DRAFT) as Parameters<typeof eventDao.create>[0]),
        eventDao.create(makeEvent(EventStatus.OPEN) as Parameters<typeof eventDao.create>[0]),
        eventDao.create(makeEvent(EventStatus.OPEN) as Parameters<typeof eventDao.create>[0]),
      ]);

      const { data } = await eventDao.list({ status: EventStatus.OPEN });

      expect(data).toHaveLength(2);
      expect(data.every((e) => e.eventStatus === EventStatus.OPEN)).toBe(true);
    });

    it('should return empty array when no events match the status filter', async () => {
      await eventDao.create(makeEvent(EventStatus.DRAFT) as Parameters<typeof eventDao.create>[0]);

      const { data } = await eventDao.list({ status: EventStatus.COMPLETED });

      expect(data).toHaveLength(0);
    });
    it('should exclude DELETING events even when DELETING is requested explicitly', async () => {
      await eventDao.create(makeEvent(EventStatus.DELETING) as Parameters<typeof eventDao.create>[0]);

      const { data } = await eventDao.list({ status: EventStatus.DELETING });

      expect(data).toHaveLength(0);
    });
  });

  describe('load()', () => {
    it('should treat a DELETING event as not found while raw get remains available', async () => {
      const created = await eventDao.create(makeEvent(EventStatus.DELETING) as Parameters<typeof eventDao.create>[0]);

      await expect(eventDao.load({ eventId: created.eventId })).rejects.toThrow('Item not found.');
      await expect(eventDao.get({ eventId: created.eventId })).resolves.toMatchObject({
        eventId: created.eventId,
        eventStatus: EventStatus.DELETING,
      });
    });
  });

  describe('transitionStatus()', () => {
    it('should update eventStatus when current status matches the from condition', async () => {
      const created = await eventDao.create(makeEvent(EventStatus.DRAFT) as Parameters<typeof eventDao.create>[0]);

      await eventDao.transitionStatus(created.eventId, EventStatus.DRAFT, EventStatus.OPEN);

      const { data: updated } = await eventDao.list({ status: EventStatus.OPEN });
      expect(updated).toHaveLength(1);
      expect(updated[0].eventId).toEqual(created.eventId);
    });

    it('should throw ConditionalCheckFailedException when current status does not match', async () => {
      const created = await eventDao.create(makeEvent(EventStatus.OPEN) as Parameters<typeof eventDao.create>[0]);

      await expect(
        eventDao.transitionStatus(created.eventId, EventStatus.DRAFT, EventStatus.OPEN),
      ).rejects.toMatchObject({ cause: { name: 'ConditionalCheckFailedException' } });
    });
  });

  describe('transitionToDeleting()', () => {
    it('should transition a non-DELETING event to DELETING', async () => {
      const created = await eventDao.create(makeEvent(EventStatus.OPEN) as Parameters<typeof eventDao.create>[0]);

      await eventDao.transitionToDeleting(created.eventId);

      const deleting = await eventDao.get({ eventId: created.eventId });
      expect(deleting?.eventId).toEqual(created.eventId);
      expect(deleting?.eventStatus).toEqual(EventStatus.DELETING);
    });

    it('should throw ConditionalCheckFailedException when event is already DELETING', async () => {
      const created = await eventDao.create(makeEvent(EventStatus.DELETING) as Parameters<typeof eventDao.create>[0]);

      await expect(eventDao.transitionToDeleting(created.eventId)).rejects.toMatchObject({
        cause: { name: 'ConditionalCheckFailedException' },
      });
    });
  });
});
