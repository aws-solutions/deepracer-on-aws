// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { leaderboardDao, TEST_LEADERBOARD_ITEM, TEST_LEADERBOARD_ITEM_OA } from '@deepracer-indy/database';
import {
  BadRequestError,
  LeaderboardDefinition,
  TrackConfig,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { CreateLeaderboardOperation } from '../createLeaderboard.js';

describe('CreateLeaderboard operation', () => {
  const TEST_LEADERBOARD_DEFINITION: LeaderboardDefinition = {
    name: TEST_LEADERBOARD_ITEM.name,
    description: '',
    openTime: new Date('2022-10-08T00:46:31.378493Z'),
    closeTime: new Date('2022-10-11T00:46:31.378493Z'),
    trackConfig: TEST_LEADERBOARD_ITEM.trackConfig,
    raceType: TEST_LEADERBOARD_ITEM.raceType,
    resettingBehaviorConfig: TEST_LEADERBOARD_ITEM.resettingBehaviorConfig,
    submissionTerminationConditions: {
      maximumLaps: TEST_LEADERBOARD_ITEM.submissionTerminationConditions.maxLaps,
      minimumLaps: TEST_LEADERBOARD_ITEM.minimumLaps,
      maxTimeInMinutes: TEST_LEADERBOARD_ITEM.submissionTerminationConditions.maxTimeInMinutes,
    },
    timingMethod: TEST_LEADERBOARD_ITEM.timingMethod,
    maxSubmissionsPerUser: TEST_LEADERBOARD_ITEM.maxSubmissionsPerUser,
  };

  it('should create new model', async () => {
    vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);

    const output = await CreateLeaderboardOperation(
      { leaderboardDefinition: TEST_LEADERBOARD_DEFINITION },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.leaderboardId).toEqual(TEST_LEADERBOARD_ITEM.leaderboardId);
  });

  it('should throw error if a request max and minimum laps are invalid', async () => {
    return expect(
      CreateLeaderboardOperation(
        {
          leaderboardDefinition: {
            ...TEST_LEADERBOARD_DEFINITION,
            submissionTerminationConditions: {
              minimumLaps: TEST_LEADERBOARD_ITEM.submissionTerminationConditions.maxLaps,
              maximumLaps: TEST_LEADERBOARD_ITEM.minimumLaps,
              maxTimeInMinutes: TEST_LEADERBOARD_ITEM.submissionTerminationConditions.maxTimeInMinutes,
            },
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Invalid maximum and minimum laps.' }));
  });

  it('should throw error if a request open and close times are invalid', async () => {
    return expect(
      CreateLeaderboardOperation(
        {
          leaderboardDefinition: {
            ...TEST_LEADERBOARD_DEFINITION,
            openTime: new Date(TEST_LEADERBOARD_ITEM.closeTime),
            closeTime: new Date(TEST_LEADERBOARD_ITEM.openTime),
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Opening time cannot be after close time.' }));
  });

  it('should throw error if track config is invalid', async () => {
    const invalidTrackConfig: TrackConfig = {
      trackId: TrackId.DBRO_RACEWAY,
      trackDirection: TrackDirection.CLOCKWISE,
    };

    await expect(
      CreateLeaderboardOperation(
        {
          leaderboardDefinition: {
            ...TEST_LEADERBOARD_DEFINITION,
            trackConfig: invalidTrackConfig,
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toThrowError(BadRequestError);
  });

  it('should throw error if leaderboard item fails to be created', async () => {
    const expectedError = new Error('Item failed to create');
    vi.spyOn(leaderboardDao, 'create').mockRejectedValueOnce(expectedError);

    return expect(
      CreateLeaderboardOperation({ leaderboardDefinition: TEST_LEADERBOARD_DEFINITION }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(expectedError);
  });
});

describe('CreateLeaderboard operation for Object Avoidance', () => {
  const TEST_LEADERBOARD_DEFINITION: LeaderboardDefinition = {
    name: TEST_LEADERBOARD_ITEM_OA.name,
    description: '',
    openTime: new Date('2022-10-08T00:46:31.378493Z'),
    closeTime: new Date('2022-10-11T00:46:31.378493Z'),
    trackConfig: TEST_LEADERBOARD_ITEM_OA.trackConfig,
    raceType: TEST_LEADERBOARD_ITEM_OA.raceType,
    resettingBehaviorConfig: TEST_LEADERBOARD_ITEM_OA.resettingBehaviorConfig,
    submissionTerminationConditions: {
      maximumLaps: TEST_LEADERBOARD_ITEM_OA.submissionTerminationConditions.maxLaps,
      minimumLaps: TEST_LEADERBOARD_ITEM_OA.minimumLaps,
      maxTimeInMinutes: TEST_LEADERBOARD_ITEM_OA.submissionTerminationConditions.maxTimeInMinutes,
    },
    timingMethod: TEST_LEADERBOARD_ITEM_OA.timingMethod,
    maxSubmissionsPerUser: TEST_LEADERBOARD_ITEM_OA.maxSubmissionsPerUser,
    objectAvoidanceConfig: TEST_LEADERBOARD_ITEM_OA.objectAvoidanceConfig,
  };

  it('should create new model', async () => {
    vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM_OA);

    const output = await CreateLeaderboardOperation(
      { leaderboardDefinition: TEST_LEADERBOARD_DEFINITION },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.leaderboardId).toEqual(TEST_LEADERBOARD_ITEM_OA.leaderboardId);
  });

  it('should throw error if oa config is not provided', async () => {
    return expect(
      CreateLeaderboardOperation(
        {
          leaderboardDefinition: {
            ...TEST_LEADERBOARD_DEFINITION,
            objectAvoidanceConfig: undefined,
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Number of obstacle positions is invalid.' }));
  });
});

describe('CreateLeaderboard operation for Live Race', () => {
  const TEST_LEADERBOARD_DEFINITION: LeaderboardDefinition = {
    name: TEST_LEADERBOARD_ITEM.name,
    description: '',
    openTime: new Date('2022-10-08T00:46:31.378493Z'),
    closeTime: new Date('2022-10-11T00:46:31.378493Z'),
    trackConfig: TEST_LEADERBOARD_ITEM.trackConfig,
    raceType: TEST_LEADERBOARD_ITEM.raceType,
    resettingBehaviorConfig: TEST_LEADERBOARD_ITEM.resettingBehaviorConfig,
    submissionTerminationConditions: {
      maximumLaps: TEST_LEADERBOARD_ITEM.submissionTerminationConditions.maxLaps,
      minimumLaps: TEST_LEADERBOARD_ITEM.minimumLaps,
      maxTimeInMinutes: TEST_LEADERBOARD_ITEM.submissionTerminationConditions.maxTimeInMinutes,
    },
    timingMethod: TEST_LEADERBOARD_ITEM.timingMethod,
    maxSubmissionsPerUser: TEST_LEADERBOARD_ITEM.maxSubmissionsPerUser,
  };

  it('should create a live race with valid fields', async () => {
    vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);

    const output = await CreateLeaderboardOperation(
      {
        leaderboardDefinition: {
          ...TEST_LEADERBOARD_DEFINITION,
          isLive: true,
          liveEventTime: new Date(Date.now() + 86400000),
          maxResets: 5,
        },
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.leaderboardId).toEqual(TEST_LEADERBOARD_ITEM.leaderboardId);
  });

  it('should throw error if liveEventTime is missing for live race', async () => {
    await expect(
      CreateLeaderboardOperation(
        {
          leaderboardDefinition: {
            ...TEST_LEADERBOARD_DEFINITION,
            isLive: true,
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'liveEventTime is required for live races.' }));
  });

  it('should throw error if liveEventTime is in the past', async () => {
    await expect(
      CreateLeaderboardOperation(
        {
          leaderboardDefinition: {
            ...TEST_LEADERBOARD_DEFINITION,
            isLive: true,
            liveEventTime: new Date('2020-01-01T00:00:00Z'),
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Event time must be in the future.' }));
  });

  it('should default maxResets to 3 when not provided', async () => {
    const createSpy = vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);

    await CreateLeaderboardOperation(
      {
        leaderboardDefinition: {
          ...TEST_LEADERBOARD_DEFINITION,
          isLive: true,
          liveEventTime: new Date(Date.now() + 86400000),
        },
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ isLive: true, maxResets: 3 }));
  });

  it('should set liveEventStatus to SCHEDULED and submissionPeriodOpen to false', async () => {
    const createSpy = vi.spyOn(leaderboardDao, 'create').mockResolvedValue(TEST_LEADERBOARD_ITEM);

    await CreateLeaderboardOperation(
      {
        leaderboardDefinition: {
          ...TEST_LEADERBOARD_DEFINITION,
          isLive: true,
          liveEventTime: new Date(Date.now() + 86400000),
        },
      },
      TEST_OPERATION_CONTEXT,
    );

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ liveEventStatus: 'SCHEDULED', submissionPeriodOpen: false }),
    );
  });
});
