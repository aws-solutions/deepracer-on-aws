// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, profileDao, TEST_EVENT_ITEM, TEST_PROFILE_ITEM } from '@deepracer-indy/database';
import {
  EventDefinition,
  EventStatus,
  EventType,
  NotAuthorizedError,
  RaceFormat,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { CreateEventOperation } from '../createEvent.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);

const TEST_EVENT_DEFINITION: EventDefinition = {
  name: TEST_EVENT_ITEM.name,
  eventType: EventType.OFFICIAL_TRACK_RACE,
  eventDate: TEST_EVENT_ITEM.eventDate,
  countryCode: TEST_EVENT_ITEM.countryCode,
  raceFormat: RaceFormat.BEST_LAP,
  maxLaps: TEST_EVENT_ITEM.maxLaps,
  maxTimeInMinutes: TEST_EVENT_ITEM.maxTimeInMinutes,
  maxResets: TEST_EVENT_ITEM.maxResets,
};

describe('CreateEvent operation', () => {
  beforeEach(() => {
    vi.spyOn(profileDao, 'load').mockResolvedValue(TEST_PROFILE_ITEM);
    vi.clearAllMocks();
    mockIsUserAdmin.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError when caller is not an administrator', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(false);

    await expect(
      CreateEventOperation({ eventDefinition: TEST_EVENT_DEFINITION }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotAuthorizedError);
  });

  it('should create an event and return the eventId', async () => {
    vi.spyOn(eventDao, 'create').mockResolvedValue(TEST_EVENT_ITEM);

    const output = await CreateEventOperation({ eventDefinition: TEST_EVENT_DEFINITION }, TEST_OPERATION_CONTEXT);

    expect(output.eventId).toEqual(TEST_EVENT_ITEM.eventId);
  });

  it('should persist the alias of the requesting user as createdBy', async () => {
    const createSpy = vi.spyOn(eventDao, 'create').mockResolvedValue(TEST_EVENT_ITEM);

    await CreateEventOperation({ eventDefinition: TEST_EVENT_DEFINITION }, TEST_OPERATION_CONTEXT);

    expect(profileDao.load).toHaveBeenCalledWith({ profileId: TEST_OPERATION_CONTEXT.profileId });
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ createdBy: TEST_PROFILE_ITEM.alias }));
  });

  it('should create with DRAFT status', async () => {
    const createSpy = vi.spyOn(eventDao, 'create').mockResolvedValue(TEST_EVENT_ITEM);

    await CreateEventOperation({ eventDefinition: TEST_EVENT_DEFINITION }, TEST_OPERATION_CONTEXT);

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ eventStatus: EventStatus.DRAFT }));
  });

  it('should pass optional fields when provided', async () => {
    const createSpy = vi.spyOn(eventDao, 'create').mockResolvedValue(TEST_EVENT_ITEM);

    await CreateEventOperation(
      {
        eventDefinition: {
          ...TEST_EVENT_DEFINITION,
          sponsor: 'AWS',
          maxRunsPerRacer: 5,
          averageLapsWindow: 3,
        },
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sponsor: 'AWS', maxRunsPerRacer: 5, averageLapsWindow: 3 }),
    );
  });

  it('should persist the combined leaderboard header and footer when provided', async () => {
    const createSpy = vi.spyOn(eventDao, 'create').mockResolvedValue(TEST_EVENT_ITEM);

    await CreateEventOperation(
      {
        eventDefinition: {
          ...TEST_EVENT_DEFINITION,
          combinedLeaderBoardHeader: 'Grand Final',
          combinedLeaderBoardFooter: 'Powered by AWS',
        },
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        combinedLeaderBoardHeader: 'Grand Final',
        combinedLeaderBoardFooter: 'Powered by AWS',
      }),
    );
  });

  it('should propagate DAO errors', async () => {
    const expectedError = new Error('DynamoDB error');
    vi.spyOn(eventDao, 'create').mockRejectedValueOnce(expectedError);

    await expect(
      CreateEventOperation({ eventDefinition: TEST_EVENT_DEFINITION }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(expectedError);
  });
});
