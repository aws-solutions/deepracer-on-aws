// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { leaderboardDao, type LeaderboardItem, TEST_LEADERBOARD_ID, TEST_TIMESTAMP } from '@deepracer-indy/database';
import {
  BadRequestError,
  RaceType,
  TimingMethod,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import * as apiGatewayUtils from '../../utils/apiGateway.js';
import { EditLeaderboardOperation } from '../editLeaderboard.js';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const PAST = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const BASE_LEADERBOARD: LeaderboardItem = {
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
  name: 'Test Race',
  resettingBehaviorConfig: { continuousLap: true },
  raceType: RaceType.TIME_TRIAL,
  trackConfig: { trackId: TrackId.ACE_SPEEDWAY, trackDirection: TrackDirection.COUNTER_CLOCKWISE },
  leaderboardId: TEST_LEADERBOARD_ID,
  maxSubmissionsPerUser: 5,
  minimumLaps: 1,
  openTime: PAST,
  closeTime: FUTURE,
  participantCount: 10,
  submissionTerminationConditions: { maxLaps: 3, maxTimeInMinutes: 10 },
  timingMethod: TimingMethod.BEST_LAP_TIME,
  isLive: false,
  submissionPeriodOpen: false,
};

const FUTURE_LEADERBOARD: LeaderboardItem = {
  ...BASE_LEADERBOARD,
  openTime: FUTURE,
  closeTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
};

const ACTIVE_LEADERBOARD: LeaderboardItem = {
  ...BASE_LEADERBOARD,
  openTime: PAST,
  closeTime: FUTURE,
};

const BASE_DEFINITION = {
  name: BASE_LEADERBOARD.name,
  description: '',
  openTime: new Date(ACTIVE_LEADERBOARD.openTime),
  closeTime: new Date(ACTIVE_LEADERBOARD.closeTime),
  trackConfig: BASE_LEADERBOARD.trackConfig,
  raceType: BASE_LEADERBOARD.raceType,
  resettingBehaviorConfig: BASE_LEADERBOARD.resettingBehaviorConfig,
  submissionTerminationConditions: {
    maximumLaps: BASE_LEADERBOARD.submissionTerminationConditions.maxLaps,
    minimumLaps: BASE_LEADERBOARD.minimumLaps,
    maxTimeInMinutes: BASE_LEADERBOARD.submissionTerminationConditions.maxTimeInMinutes,
  },
  timingMethod: BASE_LEADERBOARD.timingMethod,
  maxSubmissionsPerUser: BASE_LEADERBOARD.maxSubmissionsPerUser,
};

// ── Active race — admin edit ─────────────────────────────────────────────────

describe('EditLeaderboard — active community race (admin)', () => {
  beforeEach(() => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(ACTIVE_LEADERBOARD);
    vi.spyOn(leaderboardDao, 'partialUpdate').mockResolvedValue(ACTIVE_LEADERBOARD);
    vi.spyOn(apiGatewayUtils, 'isUserAdmin').mockResolvedValue(true);
  });

  it('rejects a non-empty description — it is not a real leaderboard attribute with a value to compare against', async () => {
    await expect(
      EditLeaderboardOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, leaderboardDefinition: { ...BASE_DEFINITION, description: 'Updated' } },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Admins can only edit the end time and submission limits on an active race.',
      }),
    );
  });

  it('succeeds with an empty description — never sent to the server', async () => {
    const result = await EditLeaderboardOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, leaderboardDefinition: { ...BASE_DEFINITION, description: '' } },
      TEST_OPERATION_CONTEXT,
    );
    expect(result.leaderboard).toBeDefined();
    // description is not a real attribute on LeaderboardsEntity — sending it (even
    // implicitly as undefined) would throw an ElectroError, so it must never appear
    // in the partialUpdate payload at all.
    const updatePayload = vi.mocked(leaderboardDao.partialUpdate).mock.calls[0][1];
    expect(updatePayload).not.toHaveProperty('description');
    // Update must NOT spread the full definition — only the 2 permitted fields.
    expect(leaderboardDao.partialUpdate).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ timingMethod: expect.anything() }),
    );
  });

  it('should allow admin to extend the end time (closeTime) on active race', async () => {
    const newCloseTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const result = await EditLeaderboardOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, leaderboardDefinition: { ...BASE_DEFINITION, closeTime: newCloseTime } },
      TEST_OPERATION_CONTEXT,
    );
    expect(result.leaderboard).toBeDefined();
    expect(leaderboardDao.partialUpdate).toHaveBeenCalled();
  });

  it('should allow admin to change maxSubmissionsPerUser on active race', async () => {
    const result = await EditLeaderboardOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, leaderboardDefinition: { ...BASE_DEFINITION, maxSubmissionsPerUser: 10 } },
      TEST_OPERATION_CONTEXT,
    );
    expect(result.leaderboard).toBeDefined();
    expect(leaderboardDao.partialUpdate).toHaveBeenCalled();
  });

  it('should reject a new end time in the past', async () => {
    const pastCloseTime = new Date(Date.now() - 60 * 60 * 1000);
    await expect(
      EditLeaderboardOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, leaderboardDefinition: { ...BASE_DEFINITION, closeTime: pastCloseTime } },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'End time must be in the future.' }));
  });

  it('should block structural changes (raceType) on active race', async () => {
    await expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: { ...BASE_DEFINITION, raceType: RaceType.OBJECT_AVOIDANCE },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Admins can only edit the end time and submission limits on an active race.',
      }),
    );
  });

  it('should block openTime changes on active race', async () => {
    const newOpenTime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: { ...BASE_DEFINITION, openTime: newOpenTime },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Admins can only edit the end time and submission limits on an active race.',
      }),
    );
  });

  it('should block resettingBehaviorConfig changes on active race', async () => {
    await expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: { ...BASE_DEFINITION, resettingBehaviorConfig: { continuousLap: false } },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Admins can only edit the end time and submission limits on an active race.',
      }),
    );
  });

  it('should block timingMethod changes on active race (scoring param — deferred)', async () => {
    await expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: { ...BASE_DEFINITION, timingMethod: TimingMethod.AVG_LAP_TIME },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Admins can only edit the end time and submission limits on an active race.',
      }),
    );
  });

  it('should block minimumLaps changes on active race (scoring param — deferred)', async () => {
    await expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: {
            ...BASE_DEFINITION,
            submissionTerminationConditions: {
              ...BASE_DEFINITION.submissionTerminationConditions,
              minimumLaps: 2,
            },
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Admins can only edit the end time and submission limits on an active race.',
      }),
    );
  });

  it('should block maximumLaps changes on active race (scoring param — deferred)', async () => {
    await expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: {
            ...BASE_DEFINITION,
            submissionTerminationConditions: {
              ...BASE_DEFINITION.submissionTerminationConditions,
              maximumLaps: 10,
            },
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Admins can only edit the end time and submission limits on an active race.',
      }),
    );
  });

  it('should block maxTimeInMinutes changes on active race (affects run termination)', async () => {
    await expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: {
            ...BASE_DEFINITION,
            submissionTerminationConditions: {
              ...BASE_DEFINITION.submissionTerminationConditions,
              maxTimeInMinutes: 99,
            },
          },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Admins can only edit the end time and submission limits on an active race.',
      }),
    );
  });

  it('should block name changes on active race', async () => {
    await expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: { ...BASE_DEFINITION, name: 'Renamed Race' },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Admins can only edit the end time and submission limits on an active race.',
      }),
    );
  });

  it('should block objectAvoidanceConfig changes on active race (affects score computation)', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...ACTIVE_LEADERBOARD,
      objectAvoidanceConfig: { numberOfObjects: 5 },
    });
    await expect(
      EditLeaderboardOperation(
        {
          leaderboardId: TEST_LEADERBOARD_ID,
          leaderboardDefinition: { ...BASE_DEFINITION, objectAvoidanceConfig: { numberOfObjects: 10 } },
        },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({
        message: 'Admins can only edit the end time and submission limits on an active race.',
      }),
    );
  });
});

describe('EditLeaderboard — active community race (non-admin)', () => {
  beforeEach(() => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(ACTIVE_LEADERBOARD);
    vi.spyOn(apiGatewayUtils, 'isUserAdmin').mockResolvedValue(false);
  });

  it('should reject non-admin attempting to edit active race', async () => {
    await expect(
      EditLeaderboardOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, leaderboardDefinition: BASE_DEFINITION },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new BadRequestError({ message: 'Can only edit future leaderboards that have not started yet.' }),
    );
  });
});

// ── Future race — standard edit (existing behaviour preserved) ────────────────

describe('EditLeaderboard — future community race', () => {
  beforeEach(() => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(FUTURE_LEADERBOARD);
    vi.spyOn(leaderboardDao, 'update').mockResolvedValue(FUTURE_LEADERBOARD);
    vi.spyOn(apiGatewayUtils, 'isUserAdmin').mockResolvedValue(false);
  });

  it('should allow edit of a future race without admin check', async () => {
    const result = await EditLeaderboardOperation(
      {
        leaderboardId: TEST_LEADERBOARD_ID,
        leaderboardDefinition: {
          ...BASE_DEFINITION,
          openTime: new Date(FUTURE_LEADERBOARD.openTime),
          closeTime: new Date(FUTURE_LEADERBOARD.closeTime),
        },
      },
      TEST_OPERATION_CONTEXT,
    );
    expect(result.leaderboard).toBeDefined();
    // isUserAdmin should NOT be called for future races
    expect(apiGatewayUtils.isUserAdmin).not.toHaveBeenCalled();
  });
});
