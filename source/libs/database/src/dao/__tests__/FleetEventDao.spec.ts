// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { generateResourceId } from '../../utils/resourceUtils.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';
import { fleetEventDao } from '../FleetEventDao.js';

describe('FleetEventDao', () => {
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

  it('should assign a fleet to an event and set assignedAt', async () => {
    const eventId = generateResourceId();
    const fleetId = generateResourceId();

    const assignment = await fleetEventDao.assign({ eventId, fleetId });

    expect(assignment).toMatchObject({ eventId, fleetId });
    expect(assignment.assignedAt).toEqual(expect.any(String));
  });

  it('should list all fleets assigned to an event', async () => {
    const eventId = generateResourceId();
    const fleetA = generateResourceId();
    const fleetB = generateResourceId();

    await Promise.all([
      fleetEventDao.assign({ eventId, fleetId: fleetA }),
      fleetEventDao.assign({ eventId, fleetId: fleetB }),
    ]);

    const fleets = await fleetEventDao.listFleetsByEvent(eventId);

    expect(fleets.map((f) => f.fleetId).sort()).toEqual([fleetA, fleetB].sort());
  });

  it('should list all events a fleet is assigned to via the EventsByFleet GSI', async () => {
    const fleetId = generateResourceId();
    const eventA = generateResourceId();
    const eventB = generateResourceId();

    await Promise.all([
      fleetEventDao.assign({ eventId: eventA, fleetId }),
      fleetEventDao.assign({ eventId: eventB, fleetId }),
    ]);

    const events = await fleetEventDao.listEventsByFleet(fleetId);

    expect(events.map((e) => e.eventId).sort()).toEqual([eventA, eventB].sort());
  });

  it('should return no events for a fleet after it is unassigned (409-guard clears)', async () => {
    const eventId = generateResourceId();
    const fleetId = generateResourceId();

    await fleetEventDao.assign({ eventId, fleetId });
    await fleetEventDao.unassign({ eventId, fleetId });

    const events = await fleetEventDao.listEventsByFleet(fleetId);

    expect(events).toEqual([]);
  });
});
