// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  eventDao,
  generateResourceId,
  leaderboardDao,
  TEST_EVENT_ID,
  TEST_EVENT_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LEADERBOARD_ITEM,
} from '@deepracer-indy/database';
import {
  ConflictError,
  EventStatus,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { RemoveTrackFromEventOperation } from '../removeTrackFromEvent.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);

const DRAFT_EVENT = { ...TEST_EVENT_ITEM, eventStatus: EventStatus.DRAFT };
const OPEN_EVENT = { ...TEST_EVENT_ITEM, eventStatus: EventStatus.OPEN };

const TRACK_ON_EVENT = { ...TEST_LEADERBOARD_ITEM, eventId: TEST_EVENT_ID, submittedProfiles: [] };

const TEST_INPUT = {
  eventId: TEST_EVENT_ID,
  leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId,
};

describe('RemoveTrackFromEvent operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserAdmin.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError when caller is not an administrator', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(false);

    await expect(RemoveTrackFromEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
  });

  it('should delete the track when event is DRAFT and track has no submissions', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TRACK_ON_EVENT);
    vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({
      data: [TRACK_ON_EVENT, TRACK_ON_EVENT],
      cursor: null,
    } as never);
    const deleteSpy = vi.spyOn(leaderboardDao, 'delete').mockResolvedValue({} as never);

    const output = await RemoveTrackFromEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

    expect(output).toEqual({});
    expect(deleteSpy).toHaveBeenCalledWith({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId });
  });

  it('should delete the track when submittedProfiles is undefined', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TRACK_ON_EVENT,
      submittedProfiles: undefined,
    } as never);
    vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({
      data: [TRACK_ON_EVENT, TRACK_ON_EVENT],
      cursor: null,
    } as never);
    const deleteSpy = vi.spyOn(leaderboardDao, 'delete').mockResolvedValue({} as never);

    await RemoveTrackFromEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

    expect(deleteSpy).toHaveBeenCalledWith({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId });
  });

  it('should throw ConflictError when the track is the last one on the event', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TRACK_ON_EVENT);
    vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({ data: [TRACK_ON_EVENT], cursor: null } as never);
    const deleteSpy = vi.spyOn(leaderboardDao, 'delete');

    await expect(RemoveTrackFromEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('should throw ConflictError when event is not DRAFT', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(OPEN_EVENT);

    await expect(RemoveTrackFromEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('should throw ConflictError when track has existing submissions', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TRACK_ON_EVENT,
      submittedProfiles: ['profile-1'],
    } as never);
    const deleteSpy = vi.spyOn(leaderboardDao, 'delete');

    await expect(RemoveTrackFromEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when event does not exist', async () => {
    vi.spyOn(eventDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(RemoveTrackFromEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      TEST_ITEM_NOT_FOUND_ERROR,
    );
  });

  it('should throw NotFoundError when track does not exist', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(leaderboardDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(RemoveTrackFromEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      TEST_ITEM_NOT_FOUND_ERROR,
    );
  });

  it('should throw NotFoundError when track belongs to a different event', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TRACK_ON_EVENT,
      eventId: generateResourceId(),
    });
    const deleteSpy = vi.spyOn(leaderboardDao, 'delete');

    await expect(RemoveTrackFromEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when track has no eventId (standalone virtual leaderboard)', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LEADERBOARD_ITEM,
      eventId: undefined,
    } as never);

    await expect(RemoveTrackFromEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
