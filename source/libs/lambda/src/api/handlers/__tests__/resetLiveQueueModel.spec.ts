// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  leaderboardDao,
  liveQueueItemDao,
  type JobName,
  type LeaderboardItem,
  TEST_LEADERBOARD_ID,
  TEST_LEADERBOARD_ITEM,
  TEST_LIVE_QUEUE_ITEM,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_SUBMISSION_ID_1,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  ConflictError,
  InternalFailureError,
  LiveEventStatus,
  LiveQueueItemStatus,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';

import { sageMakerHelper } from '../../../workflow/utils/SageMakerHelper.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import * as lookupModule from '../../utils/lookupInProgressSageMakerJob.js';
import { ResetLiveQueueModelOperation } from '../resetLiveQueueModel.js';

const TEST_EXECUTION_ARN = 'arn:aws:states:us-east-1:123:execution:LiveRaceWorkflow:running';
const TEST_SAGEMAKER_JOB_NAME = 'deepracerindy-submission-abc-live-a1b2c3d4' as JobName;

const TEST_LIVE_LEADERBOARD: LeaderboardItem = {
  ...TEST_LEADERBOARD_ITEM,
  isLive: true,
  liveEventStatus: LiveEventStatus.IN_PROGRESS,
  autoLaunchEnabled: true,
  currentExecutionArn: '',
};

const FAILED_ITEM = {
  ...TEST_LIVE_QUEUE_ITEM,
  submissionId: TEST_SUBMISSION_ID_1,
  status: LiveQueueItemStatus.FAILED,
};

const RESET_ITEM = {
  ...FAILED_ITEM,
  status: LiveQueueItemStatus.PENDING,
  resetCount: 1,
  queuePosition: 'Zz',
};

describe('ResetLiveQueueModel', () => {
  beforeEach(() => {
    vi.spyOn(sageMakerHelper, 'stopTrainingJob').mockResolvedValue(undefined as never);
    vi.spyOn(lookupModule, 'lookupInProgressSageMakerJob').mockResolvedValue(undefined);
  });

  it('should reset a FAILED item successfully', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'resetModel').mockResolvedValue(RESET_ITEM);

    const result = await ResetLiveQueueModelOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(result).toStrictEqual({
      status: LiveQueueItemStatus.PENDING,
      resetCount: 1,
      queuePosition: 'Zz',
      autoLaunchEnabled: true,
    });
    expect(liveQueueItemDao.resetModel).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      submissionId: TEST_SUBMISSION_ID_1,
    });
  });

  it('should stop SageMaker when item is IN_PROGRESS', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      currentExecutionArn: TEST_EXECUTION_ARN,
    });
    vi.spyOn(lookupModule, 'lookupInProgressSageMakerJob').mockResolvedValue(TEST_SAGEMAKER_JOB_NAME);
    vi.spyOn(liveQueueItemDao, 'resetModel').mockResolvedValue(RESET_ITEM);

    await ResetLiveQueueModelOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(sageMakerHelper.stopTrainingJob).toHaveBeenCalledWith(TEST_SAGEMAKER_JOB_NAME);
    expect(lookupModule.lookupInProgressSageMakerJob).toHaveBeenCalledWith({
      leaderboardId: TEST_LEADERBOARD_ID,
      submissionId: TEST_SUBMISSION_ID_1,
    });
  });

  it('should perform DDB write before stopping SageMaker', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      currentExecutionArn: TEST_EXECUTION_ARN,
    });
    vi.spyOn(lookupModule, 'lookupInProgressSageMakerJob').mockResolvedValue(TEST_SAGEMAKER_JOB_NAME);

    const callOrder: string[] = [];
    vi.spyOn(liveQueueItemDao, 'resetModel').mockImplementation(async () => {
      callOrder.push('ddb');
      return RESET_ITEM;
    });
    vi.spyOn(sageMakerHelper, 'stopTrainingJob').mockImplementation(async () => {
      callOrder.push('sagemaker');
    });

    await ResetLiveQueueModelOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(callOrder).toStrictEqual(['ddb', 'sagemaker']);
  });

  it('should not stop SageMaker when no currentExecutionArn', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({ ...TEST_LIVE_LEADERBOARD, currentExecutionArn: '' });
    vi.spyOn(liveQueueItemDao, 'resetModel').mockResolvedValue(RESET_ITEM);

    await ResetLiveQueueModelOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(sageMakerHelper.stopTrainingJob).not.toHaveBeenCalled();
  });

  it('should throw BadRequestError if leaderboard is not live', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({ ...TEST_LEADERBOARD_ITEM, isLive: false });

    await expect(
      ResetLiveQueueModelOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Not a live race.' }));
  });

  it('should throw BadRequestError if race is completed', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.COMPLETED,
    });

    await expect(
      ResetLiveQueueModelOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Cannot modify after race closed.' }));
  });

  it('should allow reset when race is SCHEDULED', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      liveEventStatus: LiveEventStatus.SCHEDULED,
    });
    vi.spyOn(liveQueueItemDao, 'resetModel').mockResolvedValue(RESET_ITEM);

    await expect(
      ResetLiveQueueModelOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).resolves.toMatchObject({ status: LiveQueueItemStatus.PENDING });
  });

  it('should throw ConflictError if resetModel fails with ConditionalCheckFailedException', async () => {
    const condError = Object.assign(new Error('conditional request failed'), {
      name: 'ConditionalCheckFailedException',
    });
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'resetModel').mockRejectedValue(condError);

    await expect(
      ResetLiveQueueModelOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new ConflictError({ message: 'Item status changed or max resets reached. Please refresh and try again.' }),
    );
  });

  it('should throw NotFoundError if resetModel returns null', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'resetModel').mockResolvedValue(null as never);

    await expect(
      ResetLiveQueueModelOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new NotFoundError({ message: 'Submission not found in queue.' }));
  });

  it('should throw ConflictError if resetModel fails via err.cause.name', async () => {
    const wrappedError = Object.assign(new Error('wrapped'), {
      cause: { name: 'ConditionalCheckFailedException' },
    });
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'resetModel').mockRejectedValue(wrappedError);

    await expect(
      ResetLiveQueueModelOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new ConflictError({ message: 'Item status changed or max resets reached. Please refresh and try again.' }),
    );
  });

  it('should throw ConflictError if resetModel fails via message includes conditional', async () => {
    const msgError = new Error('The conditional request failed');
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'resetModel').mockRejectedValue(msgError);

    await expect(
      ResetLiveQueueModelOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(
      new ConflictError({ message: 'Item status changed or max resets reached. Please refresh and try again.' }),
    );
  });

  it('should propagate error if leaderboard not found', async () => {
    vi.spyOn(leaderboardDao, 'load').mockRejectedValue(TEST_ITEM_NOT_FOUND_ERROR);

    await expect(
      ResetLiveQueueModelOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });

  it('should propagate unexpected error from resetModel', async () => {
    const error = new InternalFailureError({ message: 'DynamoDB error' });
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue(TEST_LIVE_LEADERBOARD);
    vi.spyOn(liveQueueItemDao, 'resetModel').mockRejectedValue(error);

    await expect(
      ResetLiveQueueModelOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(error);
  });

  it('should succeed even if SageMaker stop throws', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      currentExecutionArn: TEST_EXECUTION_ARN,
    });
    vi.spyOn(lookupModule, 'lookupInProgressSageMakerJob').mockResolvedValue(TEST_SAGEMAKER_JOB_NAME);
    vi.spyOn(liveQueueItemDao, 'resetModel').mockResolvedValue(RESET_ITEM);
    vi.spyOn(sageMakerHelper, 'stopTrainingJob').mockRejectedValue(new Error('SageMaker error'));

    await expect(
      ResetLiveQueueModelOperation(
        { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
        TEST_OPERATION_CONTEXT,
      ),
    ).resolves.toMatchObject({ status: LiveQueueItemStatus.PENDING });
  });

  it('should return autoLaunchEnabled: false when leaderboard has no autoLaunchEnabled', async () => {
    vi.spyOn(leaderboardDao, 'load').mockResolvedValue({
      ...TEST_LIVE_LEADERBOARD,
      autoLaunchEnabled: undefined,
    } as never);
    vi.spyOn(liveQueueItemDao, 'resetModel').mockResolvedValue(RESET_ITEM);

    const result = await ResetLiveQueueModelOperation(
      { leaderboardId: TEST_LEADERBOARD_ID, submissionId: TEST_SUBMISSION_ID_1 },
      TEST_OPERATION_CONTEXT,
    );

    expect(result.autoLaunchEnabled).toBe(false);
  });
});
