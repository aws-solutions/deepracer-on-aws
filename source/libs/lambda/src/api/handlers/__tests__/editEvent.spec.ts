// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, TEST_EVENT_ID, TEST_EVENT_ITEM, TEST_ITEM_NOT_FOUND_ERROR } from '@deepracer-indy/database';
import {
  ConflictError,
  EventDefinition,
  EventStatus,
  EventType,
  NotAuthorizedError,
  RaceFormat,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { EditEventOperation } from '../editEvent.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);

const TEST_EVENT_DEFINITION: EventDefinition = {
  name: 'Updated Name',
  eventType: EventType.OFFICIAL_TRACK_RACE,
  eventDate: TEST_EVENT_ITEM.eventDate,
  countryCode: TEST_EVENT_ITEM.countryCode,
  raceFormat: RaceFormat.BEST_LAP,
  maxLaps: TEST_EVENT_ITEM.maxLaps,
  maxTimeInMinutes: TEST_EVENT_ITEM.maxTimeInMinutes,
  maxResets: TEST_EVENT_ITEM.maxResets,
};

const DRAFT_EVENT = { ...TEST_EVENT_ITEM, eventStatus: EventStatus.DRAFT };
const OPEN_EVENT = { ...TEST_EVENT_ITEM, eventStatus: EventStatus.OPEN };

describe('EditEvent operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserAdmin.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError when caller is not an administrator', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(false);

    await expect(
      EditEventOperation({ eventId: TEST_EVENT_ID, eventDefinition: TEST_EVENT_DEFINITION }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotAuthorizedError);
  });

  it('should update a DRAFT event with all fields', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(eventDao, 'partialUpdate').mockResolvedValue({ ...DRAFT_EVENT, name: 'Updated Name' });

    const output = await EditEventOperation(
      { eventId: TEST_EVENT_ID, eventDefinition: TEST_EVENT_DEFINITION },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.event.name).toEqual('Updated Name');
  });

  it('should pass averageLapsWindow through on a DRAFT event', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    const updateSpy = vi.spyOn(eventDao, 'partialUpdate').mockResolvedValue({ ...DRAFT_EVENT, averageLapsWindow: 5 });

    await EditEventOperation(
      {
        eventId: TEST_EVENT_ID,
        eventDefinition: { ...TEST_EVENT_DEFINITION, raceFormat: RaceFormat.AVERAGE_LAPS, averageLapsWindow: 5 },
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(updateSpy).toHaveBeenCalledWith(
      { eventId: TEST_EVENT_ID },
      expect.objectContaining({ averageLapsWindow: 5 }),
    );
  });

  it('should throw ConflictError when changing averageLapsWindow on a non-DRAFT event', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue({ ...OPEN_EVENT, averageLapsWindow: 3 });

    await expect(
      EditEventOperation(
        {
          eventId: TEST_EVENT_ID,
          eventDefinition: { ...TEST_EVENT_DEFINITION, averageLapsWindow: 5 },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('should allow editing name and sponsor on a non-DRAFT event', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(OPEN_EVENT);
    vi.spyOn(eventDao, 'partialUpdate').mockResolvedValue({ ...OPEN_EVENT, name: 'Updated Name' });

    const output = await EditEventOperation(
      {
        eventId: TEST_EVENT_ID,
        eventDefinition: { ...TEST_EVENT_DEFINITION, name: 'Updated Name' },
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.event.name).toEqual('Updated Name');
  });

  it('should allow editing the combined leaderboard header and footer on a non-DRAFT event', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(OPEN_EVENT);
    const updateSpy = vi
      .spyOn(eventDao, 'partialUpdate')
      .mockResolvedValue({ ...OPEN_EVENT, combinedLeaderBoardHeader: 'Grand Final' });

    await EditEventOperation(
      {
        eventId: TEST_EVENT_ID,
        eventDefinition: {
          ...TEST_EVENT_DEFINITION,
          combinedLeaderBoardHeader: 'Grand Final',
          combinedLeaderBoardFooter: 'Powered by AWS',
        },
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(updateSpy).toHaveBeenCalledWith(
      { eventId: TEST_EVENT_ID },
      expect.objectContaining({
        combinedLeaderBoardHeader: 'Grand Final',
        combinedLeaderBoardFooter: 'Powered by AWS',
      }),
    );
  });

  it('should throw ConflictError when changing raceFormat on a non-DRAFT event', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(OPEN_EVENT);

    await expect(
      EditEventOperation(
        {
          eventId: TEST_EVENT_ID,
          eventDefinition: { ...TEST_EVENT_DEFINITION, raceFormat: RaceFormat.AVERAGE_LAPS },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('should throw NotFoundError if event does not exist', async () => {
    vi.spyOn(eventDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      EditEventOperation({ eventId: TEST_EVENT_ID, eventDefinition: TEST_EVENT_DEFINITION }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });
});
