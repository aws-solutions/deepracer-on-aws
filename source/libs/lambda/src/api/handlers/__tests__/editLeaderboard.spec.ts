// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  leaderboardDao,
  LeaderboardItem,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LEADERBOARD_ID,
  TEST_TIMESTAMP,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  InternalFailureError,
  LeaderboardDefinition,
  RaceType,
  TimingMethod,
  TrackConfig,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { EditLeaderboardOperation } from '../editLeaderboard.js';

const TEST_FUTURE_TIMESTAMP_1 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const TEST_FUTURE_TIMESTAMP_2 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

const TEST_FUTURE_LEADERBOARD_ITEM: LeaderboardItem = {
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  name: `deepracerindy-test-${TEST_LEADERBOARD_ID}`,
  resettingBehaviorConfig: {
    continuousLap: true,
  },
  raceType: RaceType.TIME_TRIAL,
  trackConfig: {
    trackId: TrackId.ACE_SPEEDWAY,
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
  },
  closeTime: TEST_FUTURE_TIMESTAMP_2,
  leaderboardId: TEST_LEADERBOARD_ID,
  maxSubmissionsPerUser: 5,
  minimumLaps: 1,
  openTime: TEST_FUTURE_TIMESTAMP_1,
  participantCount: 10,
  submissionTerminationConditions: {
    maxLaps: 3,
    maxTimeInMinutes: 10,
  },
  timingMethod: TimingMethod.AVG_LAP_TIME,
};

describe('EditLeaderboard', () => {
  // Define existing test leaderboard definition
  const TEST_LEADERBOARD_DEFINITION: LeaderboardDefinition = {
    name: TEST_FUTURE_LEADERBOARD_ITEM.name,
    description: '',
    openTime: new Date(TEST_FUTURE_LEADERBOARD_ITEM.openTime),
    closeTime: new Date(TEST_FUTURE_LEADERBOARD_ITEM.closeTime),
    trackConfig: TEST_FUTURE_LEADERBOARD_ITEM.trackConfig,
    raceType: TEST_FUTURE_LEADERBOARD_ITEM.raceType,
    resettingBehaviorConfig: TEST_FUTURE_LEADERBOARD_ITEM.resettingBehaviorConfig,
    submissionTerminationConditions: {
      maximumLaps: TEST_FUTURE_LEADERBOARD_ITEM.submissionTerminationConditions.maxLaps,
      minimumLaps: TEST_FUTURE_LEADERBOARD_ITEM.minimumLaps,
      maxTimeInMinutes: TEST_FUTURE_LEADERBOARD_ITEM.submissionTerminationConditions.maxTimeInMinutes,
    },
    timingMethod: TEST_FUTURE_LEADERBOARD_ITEM.timingMethod,
    maxSubmissionsPerUser: TEST_FUTURE_LEADERBOARD_ITEM.maxSubmissionsPerUser,
  };

  it('should update leaderboard definition', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_FUTURE_LEADERBOARD_ITEM);

    const updatedDefinition: LeaderboardDefinition = {
      name: 'Updated Leaderboard Name',
      openTime: new Date(TEST_LEADERBOARD_DEFINITION.openTime),
      closeTime: new Date(TEST_LEADERBOARD_DEFINITION.closeTime),
      trackConfig: TEST_LEADERBOARD_DEFINITION.trackConfig,
      raceType: TEST_LEADERBOARD_DEFINITION.raceType,
      resettingBehaviorConfig: TEST_LEADERBOARD_DEFINITION.resettingBehaviorConfig,
      maxSubmissionsPerUser: TEST_LEADERBOARD_DEFINITION.maxSubmissionsPerUser,
      submissionTerminationConditions: {
        minimumLaps: 1,
        maximumLaps: 10,
        maxTimeInMinutes: 60,
      },
      timingMethod: TEST_LEADERBOARD_DEFINITION.timingMethod,
    };

    const mockUpdatedLeaderboard: LeaderboardItem = {
      leaderboardId: TEST_LEADERBOARD_ID,
      name: updatedDefinition.name,
      openTime: updatedDefinition.openTime.toISOString(),
      closeTime: updatedDefinition.closeTime.toISOString(),
      trackConfig: updatedDefinition.trackConfig,
      raceType: updatedDefinition.raceType,
      resettingBehaviorConfig: updatedDefinition.resettingBehaviorConfig,
      submissionTerminationConditions: {
        maxLaps: updatedDefinition.submissionTerminationConditions.maximumLaps,
        maxTimeInMinutes: updatedDefinition.submissionTerminationConditions.maxTimeInMinutes,
      },
      minimumLaps: updatedDefinition.submissionTerminationConditions.minimumLaps,
      timingMethod: updatedDefinition.timingMethod,
      maxSubmissionsPerUser: TEST_FUTURE_LEADERBOARD_ITEM.maxSubmissionsPerUser,
      participantCount: TEST_FUTURE_LEADERBOARD_ITEM.participantCount,
      updatedAt: new Date().toISOString(),
      createdAt: TEST_FUTURE_LEADERBOARD_ITEM.createdAt,
    };

    const updateLeaderboardSpy = vi.spyOn(leaderboardDao, 'update').mockResolvedValue(mockUpdatedLeaderboard);

    const output = await EditLeaderboardOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, leaderboardDefinition: updatedDefinition },
      TEST_OPERATION_CONTEXT,
    );

    expect(updateLeaderboardSpy).toHaveBeenCalledWith(
      {
        leaderboardId: TEST_LEADERBOARD_ID,
      },
      {
        closeTime: updatedDefinition.closeTime.toISOString(),
        openTime: updatedDefinition.openTime.toISOString(),
        minimumLaps: updatedDefinition.submissionTerminationConditions.minimumLaps,
        name: updatedDefinition.name,
        raceType: updatedDefinition.raceType,
        trackConfig: updatedDefinition.trackConfig,
        maxSubmissionsPerUser: updatedDefinition.maxSubmissionsPerUser,
        resettingBehaviorConfig: updatedDefinition.resettingBehaviorConfig,
        submissionTerminationConditions: {
          maxLaps: updatedDefinition.submissionTerminationConditions.maximumLaps,
          maxTimeInMinutes: updatedDefinition.submissionTerminationConditions.maxTimeInMinutes,
        },
        timingMethod: updatedDefinition.timingMethod,
      },
    );

    expect(output.leaderboard.leaderboardId).toEqual(mockUpdatedLeaderboard.leaderboardId);
    expect(output.leaderboard.name).toEqual(mockUpdatedLeaderboard.name);
    expect(output.leaderboard.openTime.toISOString()).toEqual(mockUpdatedLeaderboard.openTime);
    expect(output.leaderboard.closeTime.toISOString()).toEqual(mockUpdatedLeaderboard.closeTime);
    expect(output.leaderboard.trackConfig).toEqual(mockUpdatedLeaderboard.trackConfig);
    expect(output.leaderboard.raceType).toEqual(mockUpdatedLeaderboard.raceType);
    expect(output.leaderboard.resettingBehaviorConfig).toEqual(mockUpdatedLeaderboard.resettingBehaviorConfig);
    expect(output.leaderboard.submissionTerminationConditions).toEqual({
      maximumLaps: mockUpdatedLeaderboard.submissionTerminationConditions.maxLaps,
      minimumLaps: mockUpdatedLeaderboard.minimumLaps,
      maxTimeInMinutes: mockUpdatedLeaderboard.submissionTerminationConditions.maxTimeInMinutes,
    });
    expect(output.leaderboard.timingMethod).toEqual(mockUpdatedLeaderboard.timingMethod);
    expect(output.leaderboard.maxSubmissionsPerUser).toEqual(mockUpdatedLeaderboard.maxSubmissionsPerUser);
    expect(output.leaderboard.participantCount).toEqual(mockUpdatedLeaderboard.participantCount);
  });

  it('should throw error if a request max and minimum laps are invalid', async () => {
    // Mock the load method to return an existing leaderboard
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_FUTURE_LEADERBOARD_ITEM);
    return expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: {
            ...TEST_LEADERBOARD_DEFINITION,
            submissionTerminationConditions: {
              minimumLaps: TEST_FUTURE_LEADERBOARD_ITEM.submissionTerminationConditions.maxLaps,
              maximumLaps: TEST_FUTURE_LEADERBOARD_ITEM.minimumLaps,
              maxTimeInMinutes: TEST_FUTURE_LEADERBOARD_ITEM.submissionTerminationConditions.maxTimeInMinutes,
            },
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Invalid maximum and minimum laps.' }));
  });

  it('should throw error if a request open and close times are invalid', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_FUTURE_LEADERBOARD_ITEM);

    return expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: {
            ...TEST_LEADERBOARD_DEFINITION,
            openTime: new Date(TEST_FUTURE_LEADERBOARD_ITEM.closeTime),
            closeTime: new Date(TEST_FUTURE_LEADERBOARD_ITEM.openTime),
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Opening time cannot be after close time.' }));
  });

  it('should throw error if track config is invalid', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_FUTURE_LEADERBOARD_ITEM);

    const invalidTrackConfig: TrackConfig = {
      trackId: TrackId.DBRO_RACEWAY,
      trackDirection: TrackDirection.CLOCKWISE,
    };

    await expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_FUTURE_LEADERBOARD_ITEM.leaderboardId,
          leaderboardDefinition: {
            ...TEST_LEADERBOARD_DEFINITION,
            trackConfig: invalidTrackConfig,
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toThrowError(BadRequestError);
  });

  it('should throw error if leaderboard item fails to be updated', async () => {
    // Mock the load method to return an existing leaderboard
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_FUTURE_LEADERBOARD_ITEM);
    // Mock the update method to return failure scenario
    vi.spyOn(leaderboardDao, 'update').mockRejectedValueOnce(
      new InternalFailureError({ message: 'Item failed to create' }),
    );

    return expect(
      EditLeaderboardOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, leaderboardDefinition: TEST_LEADERBOARD_DEFINITION },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Item failed to create' }));
  });

  it('should fail if leaderboard item does not exist', async () => {
    vi.spyOn(leaderboardDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    return expect(
      EditLeaderboardOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, leaderboardDefinition: TEST_LEADERBOARD_DEFINITION },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });

  it('should fail if leaderboard has already started', async () => {
    // Mock the load method to return an existing leaderboard with openTime in the past
    const pastOpenTime = new Date();
    pastOpenTime.setDate(pastOpenTime.getDate() - 7); // Set openTime to 7 days in the past
    const mockLeaderboard = {
      ...TEST_FUTURE_LEADERBOARD_ITEM,
      openTime: pastOpenTime.toISOString(),
    };
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(mockLeaderboard);

    return expect(
      EditLeaderboardOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, leaderboardDefinition: TEST_LEADERBOARD_DEFINITION },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({ message: 'Can only edit future leaderboards that have not started yet.' }),
    );
  });

  it('should fail if leaderboard is closed', async () => {
    // Mock the load method to return an existing leaderboard with closeTime in the past
    const pastCloseTime = new Date();
    pastCloseTime.setDate(pastCloseTime.getDate() - 7); // Set closeTime to 7 days in the past
    const mockLeaderboard = {
      ...TEST_FUTURE_LEADERBOARD_ITEM,
      closeTime: pastCloseTime.toISOString(),
    };
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(mockLeaderboard);

    return expect(
      EditLeaderboardOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, leaderboardDefinition: TEST_LEADERBOARD_DEFINITION },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Cannot edit closed leaderboards.' }));
  });
});
