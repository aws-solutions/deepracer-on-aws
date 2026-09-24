// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  eventDao,
  leaderboardDao,
  TEST_EVENT_ID,
  TEST_EVENT_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LEADERBOARD_ITEM,
} from '@deepracer-indy/database';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListEventTracksOperation } from '../listEventTracks.js';

const TEST_INPUT = { eventId: TEST_EVENT_ID };

describe('ListEventTracks operation', () => {
  it('should return the tracks belonging to the event', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(TEST_EVENT_ITEM);
    vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({
      data: [TEST_LEADERBOARD_ITEM],
      cursor: null,
    } as never);

    const output = await ListEventTracksOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

    expect(output.tracks).toHaveLength(1);
    expect(output.tracks[0]).toMatchObject({
      leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId,
      name: TEST_LEADERBOARD_ITEM.name,
    });
  });

  it('should return an empty list when the event has no tracks', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(TEST_EVENT_ITEM);
    vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({ data: [], cursor: null } as never);

    const output = await ListEventTracksOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

    expect(output.tracks).toEqual([]);
  });

  it('should throw NotFoundError if the event does not exist', async () => {
    vi.spyOn(eventDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);
    const listSpy = vi.spyOn(leaderboardDao, 'listByEventId');

    await expect(ListEventTracksOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      TEST_ITEM_NOT_FOUND_ERROR,
    );
    expect(listSpy).not.toHaveBeenCalled();
  });
});
