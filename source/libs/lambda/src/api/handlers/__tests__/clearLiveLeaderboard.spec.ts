// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StopExecutionCommand } from '@aws-sdk/client-sfn';
import {
  leaderboardDao,
  liveQueueItemDao,
  rankingDao,
  type JobName,
  type LeaderboardItem,
  TEST_LEADERBOARD_ID,
  TEST_LEADERBOARD_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
} from '@deepracer-indy/database';
import { BadRequestError, InternalFailureError, LiveEventStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { mockClient } from 'aws-sdk-client-mock';

import { sfnClient } from '../../../utils/clients/sfnClient.js';
import { sageMakerHelper } from '../../../workflow/utils/SageMakerHelper.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import * as lookupModule from '../../utils/lookupInProgressSageMakerJob.js';
import { ClearLiveLeaderboardOperation } from '../clearLiveLeaderboard.js';

const mockSfnClient = mockClient(sfnClient);

const TEST_LIVE_LEADERBOARD: LeaderboardItem = {
  ...TEST_LEADERBOARD_ITEM,
  isLive: true,
  liveEventStatus: LiveEventStatus.IN_PROGRESS,
  currentExecutionArn: '',
};

const TEST_EXECUTION_ARN = 'arn:aws:states:us-east-1:123:execution:LiveRaceWorkflow:running';
const TEST_SAGEMAKER_JOB_NAME = 'deepracerindy-submission-abc-live-a1b2c3d4' as JobName;

describe('ClearLiveLeaderboard', () => {
  beforeEach(() => {
    mockSfnClient.reset();
    mockSfnClient.on(StopExecutionCommand).resolves({});
    vi.spyOn(rankingDao, 'deleteByLeaderboardId').mockResolvedValue(undefined);
    vi.spyOn(lookupModule, 'lookupInProgressSageMakerJob').mockResolvedValue(undefined);
    vi.spyOn(sageMakerHelper, 'stopTrainingJob').mockResolvedValue();
  });

  it('should reset all items and return counts', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'resetAll').mockResolvedValue({ itemsReset: 3, itemsFailed: 0 });

    const result = await ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result).toStrictEqual({ itemsReset: 3, itemsFailed: 0 });
    expect(liveQueueItemDao.resetAll).toHaveBeenCalledWith({ leaderboardId: TEST_LEADERBOARD_ID });
    expect(rankingDao.deleteByLeaderboardId).toHaveBeenCalledWith(TEST_LEADERBOARD_ID);
  });

  it('should return partial counts when some items fail', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'resetAll').mockResolvedValue({ itemsReset: 2, itemsFailed: 1 });

    const result = await ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result).toStrictEqual({ itemsReset: 2, itemsFailed: 1 });
  });

  it('should log warn when itemsFailed > 0', async () => {
    const warnSpy = vi.spyOn(logger, 'warn');
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'resetAll').mockResolvedValue({ itemsReset: 2, itemsFailed: 1 });

    await ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(warnSpy).toHaveBeenCalledWith(
      'Live leaderboard clear had failures',
      expect.objectContaining({ itemsReset: 2, itemsFailed: 1 }),
    );
  });

  it('should throw BadRequestError if leaderboard is not live', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({ ...TEST_LEADERBOARD_ITEM, isLive: false });

    await expect(
      ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Not a live race.' }));
  });

  it('should throw BadRequestError if race is completed', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.COMPLETED,
    });

    await expect(
      ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Cannot modify after race closed.' }));
  });

  it('should stop SF execution before resetting when execution is running', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      currentExecutionArn: TEST_EXECUTION_ARN,
    });
    vi.spyOn(liveQueueItemDao, 'resetAll').mockResolvedValue({ itemsReset: 5, itemsFailed: 0 });

    const result = await ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(mockSfnClient.commandCalls(StopExecutionCommand)).toHaveLength(1);
    expect(mockSfnClient.commandCalls(StopExecutionCommand)[0].args[0].input).toStrictEqual({
      executionArn: TEST_EXECUTION_ARN,
    });
    expect(liveQueueItemDao.resetAll).toHaveBeenCalledWith({ leaderboardId: TEST_LEADERBOARD_ID });
    expect(sageMakerHelper.stopTrainingJob).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ itemsReset: 5, itemsFailed: 0 });
  });

  it('should proceed with clear if StopExecution throws', async () => {
    mockSfnClient.on(StopExecutionCommand).rejects(new Error('Execution does not exist'));
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      currentExecutionArn: TEST_EXECUTION_ARN,
    });
    vi.spyOn(liveQueueItemDao, 'resetAll').mockResolvedValue({ itemsReset: 3, itemsFailed: 0 });

    const result = await ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result).toStrictEqual({ itemsReset: 3, itemsFailed: 0 });
  });

  it('should stop SageMaker job when lookup returns a job name', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      currentExecutionArn: TEST_EXECUTION_ARN,
    });
    vi.spyOn(lookupModule, 'lookupInProgressSageMakerJob').mockResolvedValue(TEST_SAGEMAKER_JOB_NAME);
    vi.spyOn(liveQueueItemDao, 'resetAll').mockResolvedValue({ itemsReset: 3, itemsFailed: 0 });

    await ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(lookupModule.lookupInProgressSageMakerJob).toHaveBeenCalledWith({ leaderboardId: TEST_LEADERBOARD_ID });
    expect(sageMakerHelper.stopTrainingJob).toHaveBeenCalledWith(TEST_SAGEMAKER_JOB_NAME);
  });

  it('should not stop SageMaker job when lookup returns undefined', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      currentExecutionArn: TEST_EXECUTION_ARN,
    });
    vi.spyOn(liveQueueItemDao, 'resetAll').mockResolvedValue({ itemsReset: 3, itemsFailed: 0 });

    await ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(sageMakerHelper.stopTrainingJob).not.toHaveBeenCalled();
  });

  it('should not block clear if SageMaker stop throws', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      currentExecutionArn: TEST_EXECUTION_ARN,
    });
    vi.spyOn(lookupModule, 'lookupInProgressSageMakerJob').mockResolvedValue(TEST_SAGEMAKER_JOB_NAME);
    vi.spyOn(sageMakerHelper, 'stopTrainingJob').mockRejectedValue(new Error('SageMaker error'));
    vi.spyOn(liveQueueItemDao, 'resetAll').mockResolvedValue({ itemsReset: 3, itemsFailed: 0 });

    await expect(
      ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).resolves.toStrictEqual({ itemsReset: 3, itemsFailed: 0 });
  });

  it('should not call StopExecution when no execution is running', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'resetAll').mockResolvedValue({ itemsReset: 2, itemsFailed: 0 });

    await ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(mockSfnClient.commandCalls(StopExecutionCommand)).toHaveLength(0);
  });

  it('should propagate error if leaderboard not found', async () => {
    vi.spyOn(leaderboardDao, 'load').mockRejectedValue(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });

  it('should propagate error if resetAll fails', async () => {
    const error = new InternalFailureError({ message: 'DynamoDB error' });
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'resetAll').mockRejectedValue(error);

    await expect(
      ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(error);
  });

  it('should succeed even if rankingDao.deleteByLeaderboardId throws', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'resetAll').mockResolvedValue({ itemsReset: 3, itemsFailed: 0 });
    vi.spyOn(rankingDao, 'deleteByLeaderboardId').mockRejectedValue(new Error('DynamoDB error'));

    await expect(
      ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT),
    ).resolves.toStrictEqual({ itemsReset: 3, itemsFailed: 0 });
  });

  it('should allow clear when race is SCHEDULED', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.SCHEDULED,
    });
    vi.spyOn(liveQueueItemDao, 'resetAll').mockResolvedValue({ itemsReset: 1, itemsFailed: 0 });

    const result = await ClearLiveLeaderboardOperation({ leaderboardId: TEST_LEADERBOARD_ID }, TEST_OPERATION_CONTEXT);

    expect(result).toStrictEqual({ itemsReset: 1, itemsFailed: 0 });
  });
});
