// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  lapDao,
  runDao,
  TEST_EVENT_ID,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_LAP_ITEM,
  TEST_LEADERBOARD_ID,
  TEST_RUN_ITEM,
  type ResourceId,
} from '@deepracer-indy/database';
import { ConflictError, NotAuthorizedError, RunStatus, UserGroups } from '@deepracer-indy/typescript-server-client';
import { vi } from 'vitest';

import { cognitoClient } from '../../../utils/clients/cognitoClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { CreateLapOperation } from '../createLap.js';

vi.mock('@deepracer-indy/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepracer-indy/database')>();
  return {
    ...actual,
    runDao: { load: vi.fn<(typeof actual.runDao)['load']>() },
    lapDao: { createNextLap: vi.fn<(typeof actual.lapDao)['createNextLap']>() },
  };
});
const mockRunDao = vi.mocked(runDao);
const mockLapDao = vi.mocked(lapDao);

const INPUT = {
  eventId: TEST_EVENT_ID,
  leaderboardId: TEST_LEADERBOARD_ID,
  runId: TEST_RUN_ITEM.runId,
  lapTimeMs: 12500,
};

const DEVICE_ID = 'mi-0123456789abcdef0' as ResourceId;

describe('CreateLap operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USER_POOL_ID = 'test-user-pool-id';
  });

  it('should throw NotAuthorizedError when caller is not admin or facilitator', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACERS }] }),
    );

    await expect(CreateLapOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new NotAuthorizedError({ message: 'Not authorized.' }),
    );
    expect(mockRunDao.load).not.toHaveBeenCalled();
    expect(mockLapDao.createNextLap).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when run does not exist', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockRejectedValue(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(CreateLapOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
    expect(mockLapDao.createNextLap).not.toHaveBeenCalled();
  });

  it('should throw ConflictError when run is not IN_PROGRESS', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.READY });

    await expect(CreateLapOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(ConflictError);
    expect(mockLapDao.createNextLap).not.toHaveBeenCalled();
  });

  it('should create a lap using the run current lapCount, defaulting resets to 0', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACE_FACILITATORS }] }),
    );
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.IN_PROGRESS, lapCount: 0 });
    mockLapDao.createNextLap.mockResolvedValue({ ...TEST_LAP_ITEM, lapNumber: 1 });

    const output = await CreateLapOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(mockRunDao.load).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ITEM.runId,
    });
    expect(mockLapDao.createNextLap).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      runId: TEST_RUN_ITEM.runId,
      expectedLapCount: 0,
      lapTimeMs: 12500,
      resets: 0,
    });
    expect(output.lap.lapNumber).toBe(1);
    expect(output.lap.lapTimeMs).toBe(TEST_LAP_ITEM.lapTimeMs);
  });

  it('should default expectedLapCount to 0 when the run has no lapCount yet', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockResolvedValue({
      ...TEST_RUN_ITEM,
      runStatus: RunStatus.IN_PROGRESS,
      lapCount: undefined,
    });
    mockLapDao.createNextLap.mockResolvedValue({ ...TEST_LAP_ITEM, lapNumber: 1 });

    await CreateLapOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(mockLapDao.createNextLap).toHaveBeenCalledWith(expect.objectContaining({ expectedLapCount: 0 }));
  });

  it('should pass through resets when provided', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.IN_PROGRESS, lapCount: 1 });
    mockLapDao.createNextLap.mockResolvedValue({ ...TEST_LAP_ITEM, lapNumber: 2, resets: 3 });

    await CreateLapOperation({ ...INPUT, resets: 3 }, TEST_OPERATION_CONTEXT);

    expect(mockLapDao.createNextLap).toHaveBeenCalledWith(expect.objectContaining({ resets: 3 }));
  });

  it('should pass through the selected deviceId', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.IN_PROGRESS, lapCount: 0 });
    mockLapDao.createNextLap.mockResolvedValue({ ...TEST_LAP_ITEM, lapNumber: 1, deviceId: DEVICE_ID });

    const output = await CreateLapOperation({ ...INPUT, deviceId: DEVICE_ID }, TEST_OPERATION_CONTEXT);

    expect(mockLapDao.createNextLap).toHaveBeenCalledWith(expect.objectContaining({ deviceId: DEVICE_ID }));
    expect(output.lap.deviceId).toBe(DEVICE_ID);
  });

  it('should forward the clientToken idempotency token to createNextLap', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.IN_PROGRESS, lapCount: 0 });
    mockLapDao.createNextLap.mockResolvedValue({ ...TEST_LAP_ITEM, lapNumber: 1 });

    await CreateLapOperation({ ...INPUT, clientToken: 'token-abc' }, TEST_OPERATION_CONTEXT);

    expect(mockLapDao.createNextLap).toHaveBeenCalledWith(expect.objectContaining({ clientToken: 'token-abc' }));
  });
  it('should propagate ConflictError from lapDao.createNextLap', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.IN_PROGRESS, lapCount: 0 });
    mockLapDao.createNextLap.mockRejectedValue(new ConflictError({ message: 'Lap number conflict. Please retry.' }));

    await expect(CreateLapOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toBeInstanceOf(ConflictError);
  });

  it('should propagate unexpected errors from lapDao.createNextLap', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockRunDao.load.mockResolvedValue({ ...TEST_RUN_ITEM, runStatus: RunStatus.IN_PROGRESS, lapCount: 0 });
    mockLapDao.createNextLap.mockRejectedValue(new Error('DynamoDB error'));

    await expect(CreateLapOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toThrow('DynamoDB error');
  });
});
