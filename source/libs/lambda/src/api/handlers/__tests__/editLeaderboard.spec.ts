// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  leaderboardDao,
  LeaderboardItem,
  liveQueueItemDao,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LEADERBOARD_ID,
  TEST_LIVE_QUEUE_ITEM,
  TEST_TIMESTAMP,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  InternalFailureError,
  LeaderboardDefinition,
  LiveEventStatus,
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
  isLive: false,
  submissionPeriodOpen: false,
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
      isLive: false,
      submissionPeriodOpen: false,
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

  it('should validate objectAvoidanceConfig for OBJECT_AVOIDANCE race type', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_FUTURE_LEADERBOARD_ITEM);

    await expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: {
            ...TEST_LEADERBOARD_DEFINITION,
            raceType: RaceType.OBJECT_AVOIDANCE,
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toThrowError(BadRequestError);
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

  it('should throw BadRequestError when leaderboardDefinition missing for community race', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_FUTURE_LEADERBOARD_ITEM);

    await expect(
      EditLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'leaderboardDefinition is required.' }));
  });

  describe('live race toggles', () => {
    const LIVE_LEADERBOARD: LeaderboardItem = {
      ...TEST_FUTURE_LEADERBOARD_ITEM,
      isLive: true,
      liveEventStatus: LiveEventStatus.IN_PROGRESS,
      autoLaunchEnabled: false,
      submissionPeriodOpen: false,
      currentExecutionArn: '',
    };

    it('should toggle autoLaunchEnabled', async () => {
      vi.spyOn(leaderboardDao, 'load').mockResolvedValue(LIVE_LEADERBOARD);
      vi.spyOn(leaderboardDao, 'partialUpdate').mockResolvedValue({ ...LIVE_LEADERBOARD, autoLaunchEnabled: true });
      vi.spyOn(liveQueueItemDao, 'getNextPending').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);
      vi.spyOn(liveQueueItemDao, 'touchItem').mockResolvedValue(TEST_LIVE_QUEUE_ITEM);

      const output = await EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          autoLaunchEnabled: true,
        },
        TEST_OPERATION_CONTEXT,
      );

      expect(output.leaderboard).toBeDefined();
      expect(leaderboardDao.partialUpdate).toHaveBeenCalledWith(
        { leaderboardId: TEST_LEADERBOARD_ID },
        expect.objectContaining({ autoLaunchEnabled: true }),
      );
      // Should touch PENDING item to trigger stream when autolaunch ON and no SF running
      expect(liveQueueItemDao.touchItem).toHaveBeenCalled();
    });

    it('should toggle submissionPeriodOpen', async () => {
      vi.spyOn(leaderboardDao, 'load').mockResolvedValue(LIVE_LEADERBOARD);
      vi.spyOn(leaderboardDao, 'partialUpdate').mockResolvedValue({ ...LIVE_LEADERBOARD, submissionPeriodOpen: true });

      await EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          submissionPeriodOpen: true,
        },
        TEST_OPERATION_CONTEXT,
      );

      expect(leaderboardDao.partialUpdate).toHaveBeenCalledWith(
        { leaderboardId: TEST_LEADERBOARD_ID },
        expect.objectContaining({ submissionPeriodOpen: true }),
      );
    });

    it('should not touch queue item when SF already running', async () => {
      vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
        ...LIVE_LEADERBOARD,
        currentExecutionArn: 'arn:existing',
      });
      vi.spyOn(leaderboardDao, 'partialUpdate').mockResolvedValue({
        ...LIVE_LEADERBOARD,
        autoLaunchEnabled: true,
        currentExecutionArn: 'arn:existing',
      });
      const touchSpy = vi.spyOn(liveQueueItemDao, 'touchItem');

      await EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          autoLaunchEnabled: true,
        },
        TEST_OPERATION_CONTEXT,
      );

      expect(touchSpy).not.toHaveBeenCalled();
    });

    it('should update liveEventTime when valid', async () => {
      vi.spyOn(leaderboardDao, 'load').mockResolvedValue(LIVE_LEADERBOARD);
      const futureTime = new Date(Date.now() + 86400000);
      vi.spyOn(leaderboardDao, 'partialUpdate').mockResolvedValue({
        ...LIVE_LEADERBOARD,
        liveEventTime: futureTime.toISOString(),
      });

      const output = await EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          liveEventTime: futureTime,
        },
        TEST_OPERATION_CONTEXT,
      );

      expect(output.leaderboard).toBeDefined();
      expect(leaderboardDao.partialUpdate).toHaveBeenCalledWith(
        { leaderboardId: TEST_LEADERBOARD_ID },
        expect.objectContaining({ liveEventTime: futureTime.toISOString() }),
      );
    });

    it('should reject toggle on COMPLETED race', async () => {
      vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
        ...LIVE_LEADERBOARD,
        liveEventStatus: LiveEventStatus.COMPLETED,
      });

      await expect(
        EditLeaderboardOperation(
          {
            leaderboardId: TEST_LEADERBOARD_ID,
            liveEventTime: new Date(Date.now() + 86400000),
          },
          TEST_OPERATION_CONTEXT,
        ),
      ).rejects.toStrictEqual(new BadRequestError({ message: 'Cannot modify a completed live race.' }));
    });

    it('should reject liveEventTime in the past', async () => {
      vi.spyOn(leaderboardDao, 'load').mockResolvedValue(LIVE_LEADERBOARD);

      await expect(
        EditLeaderboardOperation(
          {
            leaderboardId: TEST_LEADERBOARD_ID,
            liveEventTime: new Date(Date.now() - 60000),
          },
          TEST_OPERATION_CONTEXT,
        ),
      ).rejects.toStrictEqual(new BadRequestError({ message: 'Event time must be in the future.' }));
    });

    it('should allow definition edit for SCHEDULED live race', async () => {
      vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
        ...LIVE_LEADERBOARD,
        liveEventStatus: LiveEventStatus.SCHEDULED,
      });
      vi.spyOn(leaderboardDao, 'update').mockResolvedValue({
        ...LIVE_LEADERBOARD,
        liveEventStatus: LiveEventStatus.SCHEDULED,
        name: 'Updated Name',
      });

      const output = await EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: TEST_LEADERBOARD_DEFINITION,
        },
        TEST_OPERATION_CONTEXT,
      );

      expect(output.leaderboard).toBeDefined();
      expect(leaderboardDao.update).toHaveBeenCalled();
    });

    it('should reject definition edit for IN_PROGRESS live race', async () => {
      vi.spyOn(leaderboardDao, 'load').mockResolvedValue(LIVE_LEADERBOARD);

      await expect(
        EditLeaderboardOperation(
          {
            leaderboardId: TEST_LEADERBOARD_ID,
            leaderboardDefinition: TEST_LEADERBOARD_DEFINITION,
          },
          TEST_OPERATION_CONTEXT,
        ),
      ).rejects.toStrictEqual(new BadRequestError({ message: 'Can only edit live races before they start.' }));
    });

    it('should reject combined toggle fields and leaderboardDefinition', async () => {
      vi.spyOn(leaderboardDao, 'load').mockResolvedValue(LIVE_LEADERBOARD);

      await expect(
        EditLeaderboardOperation(
          {
            leaderboardId: TEST_LEADERBOARD_ID,
            autoLaunchEnabled: true,
            leaderboardDefinition: TEST_LEADERBOARD_DEFINITION,
          },
          TEST_OPERATION_CONTEXT,
        ),
      ).rejects.toStrictEqual(
        new BadRequestError({ message: 'Cannot combine toggle fields with leaderboardDefinition.' }),
      );
    });

    it('should succeed even if touchItem fails (best-effort)', async () => {
      vi.spyOn(leaderboardDao, 'load').mockResolvedValue(LIVE_LEADERBOARD);
      vi.spyOn(leaderboardDao, 'partialUpdate').mockResolvedValue({ ...LIVE_LEADERBOARD, autoLaunchEnabled: true });
      vi.spyOn(liveQueueItemDao, 'getNextPending').mockRejectedValue(new Error('DynamoDB throttle'));

      const output = await EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          autoLaunchEnabled: true,
        },
        TEST_OPERATION_CONTEXT,
      );

      expect(output.leaderboard).toBeDefined();
    });
  });
});
