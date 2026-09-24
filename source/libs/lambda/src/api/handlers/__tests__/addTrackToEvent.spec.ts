// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  eventDao,
  leaderboardDao,
  TEST_EVENT_ID,
  TEST_EVENT_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LEADERBOARD_ITEM,
} from '@deepracer-indy/database';
import { ConflictError, EventStatus, NotAuthorizedError, TrackId } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-vitest';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { AddTrackToEventOperation, MAX_TRACKS_PER_EVENT } from '../addTrackToEvent.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);
const mockS3Client = mockClient(S3Client);

const DRAFT_EVENT = { ...TEST_EVENT_ITEM, eventStatus: EventStatus.DRAFT };
const OPEN_EVENT = { ...TEST_EVENT_ITEM, eventStatus: EventStatus.OPEN };
const IN_PROGRESS_EVENT = { ...TEST_EVENT_ITEM, eventStatus: EventStatus.IN_PROGRESS };

const TEST_INPUT = {
  eventId: TEST_EVENT_ID,
  trackType: TrackId.AWS_SUMMIT_RACEWAY,
  leaderBoardTitle: 'Summit Speedway - Qualifying',
  leaderBoardFooter: 'Follow the race #AWSDeepRacer',
  fleetId: 'fleet-london-001',
};

describe('AddTrackToEvent operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserAdmin.mockResolvedValue(true);
    mockS3Client.reset();
    mockS3Client.on(PutObjectCommand).resolves({});
  });

  it('should throw NotAuthorizedError when caller is not an administrator', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(false);

    await expect(AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
  });

  it('should create a track when event is DRAFT', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({ data: [], cursor: null } as never);
    const createSpy = vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);

    const output = await AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

    expect(output).toEqual({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId });
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: TEST_INPUT.leaderBoardTitle,
        leaderBoardFooter: TEST_INPUT.leaderBoardFooter,
        eventId: TEST_EVENT_ID,
        trackType: TEST_INPUT.trackType,
        fleetId: TEST_INPUT.fleetId,
        trackOrder: '0001',
      }),
    );
  });

  it('should create a track when event is OPEN', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(OPEN_EVENT);
    vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({ data: [], cursor: null } as never);
    vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);

    const output = await AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

    expect(output).toEqual({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId });
  });

  it('should append after the highest persisted track order', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({
      data: [
        { ...TEST_LEADERBOARD_ITEM, trackOrder: '0001' },
        { ...TEST_LEADERBOARD_ITEM, trackOrder: '0003' },
      ],
      cursor: null,
    } as never);
    const createSpy = vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);

    await AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ trackOrder: '0004' }));
  });

  it('should create a track without an optional fleetId', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({ data: [], cursor: null } as never);
    const createSpy = vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);

    await AddTrackToEventOperation({ ...TEST_INPUT, fleetId: undefined }, TEST_OPERATION_CONTEXT);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: TEST_INPUT.leaderBoardTitle,
        eventId: TEST_EVENT_ID,
        trackType: TEST_INPUT.trackType,
      }),
    );
  });

  it('should throw ConflictError when event is IN_PROGRESS', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(IN_PROGRESS_EVENT);

    await expect(AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(ConflictError);
  });

  it('should throw ConflictError when event is COMPLETED', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue({ ...TEST_EVENT_ITEM, eventStatus: EventStatus.COMPLETED });

    await expect(AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(ConflictError);
  });

  it('should throw ConflictError when event already has the maximum number of tracks', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({
      data: Array.from({ length: MAX_TRACKS_PER_EVENT }, () => TEST_LEADERBOARD_ITEM),
      cursor: null,
    } as never);
    const createSpy = vi.spyOn(leaderboardDao, 'create');

    await expect(AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(ConflictError);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should allow creating a track when just below the maximum', async () => {
    vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
    vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({
      data: Array.from({ length: MAX_TRACKS_PER_EVENT - 1 }, () => TEST_LEADERBOARD_ITEM),
      cursor: null,
    } as never);
    vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);

    const output = await AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

    expect(output).toEqual({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId });
  });

  it('should throw NotFoundError if event does not exist', async () => {
    vi.spyOn(eventDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      TEST_ITEM_NOT_FOUND_ERROR,
    );
  });

  describe('public leaderboard S3 placeholder', () => {
    it('pre-creates the per-track placeholder with the track’s own name and footer', async () => {
      vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
      vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({ data: [], cursor: null } as never);
      vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);

      await AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

      const calls = mockS3Client.commandCalls(PutObjectCommand);
      const perTrackPut = calls.find(
        (c) => c.args[0].input.Key === `public/leaderboards/${TEST_LEADERBOARD_ITEM.leaderboardId}.json`,
      );
      expect(perTrackPut).toBeDefined();
      expect(perTrackPut?.args[0].input.IfNoneMatch).toBe('*');
      const body = JSON.parse(perTrackPut?.args[0].input.Body as string);
      expect(body).toMatchObject({
        leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId,
        name: TEST_INPUT.leaderBoardTitle,
        footer: TEST_INPUT.leaderBoardFooter,
        rankings: [],
      });
    });

    it('also pre-creates the combined (event-wide) placeholder, with the event’s own name, when this is the event’s first track', async () => {
      vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
      vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({ data: [], cursor: null } as never);
      vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);

      await AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

      const calls = mockS3Client.commandCalls(PutObjectCommand);
      const combinedPut = calls.find((c) => c.args[0].input.Key === `public/leaderboards/${TEST_EVENT_ID}.json`);
      expect(combinedPut).toBeDefined();
      const body = JSON.parse(combinedPut?.args[0].input.Body as string);
      expect(body).toMatchObject({ leaderboardId: TEST_EVENT_ID, name: DRAFT_EVENT.name });
    });

    it('does not touch the combined placeholder when the event already has other tracks', async () => {
      vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
      vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({
        data: [{ ...TEST_LEADERBOARD_ITEM, trackOrder: '0001' }],
        cursor: null,
      } as never);
      vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);

      await AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

      const calls = mockS3Client.commandCalls(PutObjectCommand);
      const combinedPut = calls.find((c) => c.args[0].input.Key === `public/leaderboards/${TEST_EVENT_ID}.json`);
      expect(combinedPut).toBeUndefined();
    });

    it('does not fail track creation when the S3 placeholder write fails', async () => {
      vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
      vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({ data: [], cursor: null } as never);
      vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(vi.fn());
      mockS3Client.on(PutObjectCommand).rejects(new Error('S3 unavailable'));

      const output = await AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

      expect(output).toEqual({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId });
      expect(errorSpy).toHaveBeenCalledWith('Failed to pre-create public leaderboard S3 placeholder', {
        leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId,
        error: expect.any(Error),
      });
    });

    it('treats a PreconditionFailed rejection (placeholder already exists) as an expected no-op, without logging an error', async () => {
      vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
      vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({ data: [], cursor: null } as never);
      vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(vi.fn());
      const preconditionFailed = new Error('At least one of the pre-conditions you specified did not hold');
      preconditionFailed.name = 'PreconditionFailed';
      mockS3Client.on(PutObjectCommand).rejects(preconditionFailed);

      const output = await AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

      expect(output).toEqual({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId });
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('still writes the combined placeholder even when the per-track placeholder is a PreconditionFailed no-op', async () => {
      // Regression guard: the per-track and combined writes must be independently error-handled
      // so one's expected no-op does not short-circuit the other — this is the event's first
      // track, so both placeholders should be attempted regardless of the per-track outcome.
      vi.spyOn(eventDao, 'load').mockResolvedValue(DRAFT_EVENT);
      vi.spyOn(leaderboardDao, 'listByEventId').mockResolvedValue({ data: [], cursor: null } as never);
      vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(vi.fn());
      const preconditionFailed = new Error('At least one of the pre-conditions you specified did not hold');
      preconditionFailed.name = 'PreconditionFailed';
      const perTrackKey = `public/leaderboards/${TEST_LEADERBOARD_ITEM.leaderboardId}.json`;
      mockS3Client.on(PutObjectCommand).callsFake((input) => {
        if (input.Key === perTrackKey) throw preconditionFailed;
        return {};
      });

      const output = await AddTrackToEventOperation(TEST_INPUT, TEST_OPERATION_CONTEXT);

      expect(output).toEqual({ leaderboardId: TEST_LEADERBOARD_ITEM.leaderboardId });
      const calls = mockS3Client.commandCalls(PutObjectCommand);
      const combinedPut = calls.find((c) => c.args[0].input.Key === `public/leaderboards/${TEST_EVENT_ID}.json`);
      expect(combinedPut).toBeDefined();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
