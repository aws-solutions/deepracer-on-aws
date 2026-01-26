// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  ErrorMessage as DatabaseErrorMessage,
  evaluationDao,
  modelDao,
  submissionDao,
  TEST_EVALUATION_ITEM,
  TEST_MODEL_ITEM,
  TEST_SUBMISSION_ITEM,
  TEST_TRAINING_ITEM,
  trainingDao,
} from '@deepracer-indy/database';
import { BadRequestError, JobStatus, ModelStatus, NotFoundError } from '@deepracer-indy/typescript-server-client';

import { sageMakerHelper } from '../../../workflow/utils/SageMakerHelper.js';
import { workflowHelper } from '../../../workflow/utils/WorkflowHelper.js';
import { ErrorMessage as ApiErrorMessage } from '../../constants/errorMessages.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { StopModelOperation } from '../stopModel.js';

const STOPPABLE_MODEL_STATUSES: string[] = [ModelStatus.EVALUATING, ModelStatus.QUEUED, ModelStatus.TRAINING];

describe('StopModel operation', () => {
  beforeEach(() => {
    vi.spyOn(evaluationDao, 'getStoppableEvaluation');
    vi.spyOn(modelDao, 'update').mockResolvedValue(TEST_MODEL_ITEM);
    vi.spyOn(sageMakerHelper, 'stopTrainingJob').mockResolvedValue();
    vi.spyOn(sageMakerHelper, 'stopQueuedJob').mockResolvedValue();
    vi.spyOn(submissionDao, 'getStoppableSubmission');
    vi.spyOn(trainingDao, 'getStoppableTraining');
    vi.spyOn(workflowHelper, 'updateJob').mockResolvedValue(TEST_TRAINING_ITEM);
  });

  it('should handle stopping model in EVALUATING status when job is IN_PROGRESS', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.EVALUATING });
    vi.spyOn(evaluationDao, 'getStoppableEvaluation').mockResolvedValueOnce({
      ...TEST_EVALUATION_ITEM,
      status: JobStatus.IN_PROGRESS,
    });

    const output = await StopModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT);

    expect(output).toStrictEqual({});
    expect(evaluationDao.getStoppableEvaluation).toHaveBeenCalledWith(TEST_MODEL_ITEM.modelId);
    expect(sageMakerHelper.stopTrainingJob).toHaveBeenCalledWith(TEST_EVALUATION_ITEM.name);
    expect(modelDao.update).toHaveBeenCalledWith(
      {
        modelId: TEST_MODEL_ITEM.modelId,
        profileId: TEST_OPERATION_CONTEXT.profileId,
      },
      { status: ModelStatus.STOPPING },
    );
    expect(workflowHelper.updateJob).toHaveBeenCalledWith(
      {
        jobName: TEST_EVALUATION_ITEM.name,
        modelId: TEST_EVALUATION_ITEM.modelId,
        profileId: TEST_OPERATION_CONTEXT.profileId,
      },
      { status: JobStatus.STOPPING },
    );
    expect(submissionDao.getStoppableSubmission).not.toHaveBeenCalled();
    expect(trainingDao.getStoppableTraining).not.toHaveBeenCalled();
  });

  it('should handle stopping model in TRAINING status when job is IN_PROGRESS', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.TRAINING });
    vi.spyOn(trainingDao, 'getStoppableTraining').mockResolvedValueOnce({
      ...TEST_TRAINING_ITEM,
      status: JobStatus.IN_PROGRESS,
    });

    const output = await StopModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT);

    expect(output).toStrictEqual({});
    expect(trainingDao.getStoppableTraining).toHaveBeenCalledWith(TEST_MODEL_ITEM.modelId);
    expect(sageMakerHelper.stopTrainingJob).toHaveBeenCalledWith(TEST_TRAINING_ITEM.name);
    expect(modelDao.update).toHaveBeenCalledWith(
      {
        modelId: TEST_MODEL_ITEM.modelId,
        profileId: TEST_OPERATION_CONTEXT.profileId,
      },
      { status: ModelStatus.STOPPING },
    );
    expect(workflowHelper.updateJob).toHaveBeenCalledWith(
      {
        jobName: TEST_TRAINING_ITEM.name,
        modelId: TEST_TRAINING_ITEM.modelId,
        profileId: TEST_OPERATION_CONTEXT.profileId,
      },
      { status: JobStatus.STOPPING },
    );
    expect(evaluationDao.getStoppableEvaluation).not.toHaveBeenCalled();
    expect(submissionDao.getStoppableSubmission).not.toHaveBeenCalled();
  });

  it('should handle stopping model QUEUED for evaluation', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.QUEUED });
    vi.spyOn(evaluationDao, 'getStoppableEvaluation').mockResolvedValueOnce({
      ...TEST_EVALUATION_ITEM,
      status: JobStatus.QUEUED,
    });
    vi.spyOn(submissionDao, 'getStoppableSubmission').mockResolvedValueOnce(null);
    vi.spyOn(trainingDao, 'getStoppableTraining').mockResolvedValueOnce(null);

    const output = await StopModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT);

    expect(output).toEqual({});
    expect(sageMakerHelper.stopQueuedJob).toHaveBeenCalledWith(TEST_EVALUATION_ITEM.name);
    expect(modelDao.update).toHaveBeenCalledWith(
      {
        modelId: TEST_MODEL_ITEM.modelId,
        profileId: TEST_OPERATION_CONTEXT.profileId,
      },
      { status: ModelStatus.READY },
    );
    expect(workflowHelper.updateJob).toHaveBeenCalledWith(
      {
        jobName: TEST_EVALUATION_ITEM.name,
        modelId: TEST_MODEL_ITEM.modelId,
        profileId: TEST_OPERATION_CONTEXT.profileId,
      },
      { status: JobStatus.CANCELED },
    );
    expect(sageMakerHelper.stopTrainingJob).not.toHaveBeenCalled();
  });

  it('should handle stopping model QUEUED for submission', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.QUEUED });
    vi.spyOn(evaluationDao, 'getStoppableEvaluation').mockResolvedValueOnce(null);
    vi.spyOn(submissionDao, 'getStoppableSubmission').mockResolvedValueOnce({
      ...TEST_SUBMISSION_ITEM,
      status: JobStatus.QUEUED,
    });
    vi.spyOn(trainingDao, 'getStoppableTraining').mockResolvedValueOnce(null);

    const output = await StopModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT);

    expect(output).toEqual({});
    expect(sageMakerHelper.stopQueuedJob).toHaveBeenCalledWith(TEST_SUBMISSION_ITEM.name);
    expect(modelDao.update).toHaveBeenCalledWith(
      {
        modelId: TEST_MODEL_ITEM.modelId,
        profileId: TEST_OPERATION_CONTEXT.profileId,
      },
      { status: ModelStatus.READY },
    );
    expect(workflowHelper.updateJob).toHaveBeenCalledWith(
      {
        jobName: TEST_SUBMISSION_ITEM.name,
        modelId: TEST_MODEL_ITEM.modelId,
        profileId: TEST_OPERATION_CONTEXT.profileId,
        leaderboardId: TEST_SUBMISSION_ITEM.leaderboardId,
      },
      { status: JobStatus.CANCELED },
    );
    expect(sageMakerHelper.stopTrainingJob).not.toHaveBeenCalled();
  });

  it('should handle stopping model QUEUED for training', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.QUEUED });
    vi.spyOn(evaluationDao, 'getStoppableEvaluation').mockResolvedValueOnce(null);
    vi.spyOn(submissionDao, 'getStoppableSubmission').mockResolvedValueOnce(null);
    vi.spyOn(trainingDao, 'getStoppableTraining').mockResolvedValueOnce({
      ...TEST_TRAINING_ITEM,
      status: JobStatus.QUEUED,
    });

    const output = await StopModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT);

    expect(output).toEqual({});
    expect(sageMakerHelper.stopQueuedJob).toHaveBeenCalledWith(TEST_TRAINING_ITEM.name);
    expect(modelDao.update).toHaveBeenCalledWith(
      {
        modelId: TEST_MODEL_ITEM.modelId,
        profileId: TEST_OPERATION_CONTEXT.profileId,
      },
      { status: ModelStatus.ERROR },
    );
    expect(workflowHelper.updateJob).toHaveBeenCalledWith(
      {
        jobName: TEST_TRAINING_ITEM.name,
        modelId: TEST_MODEL_ITEM.modelId,
        profileId: TEST_OPERATION_CONTEXT.profileId,
      },
      { status: JobStatus.CANCELED },
    );
    expect(sageMakerHelper.stopTrainingJob).not.toHaveBeenCalled();
  });

  it('should throw error when stopQueuedJob times out waiting for job to stop', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.QUEUED });
    vi.spyOn(evaluationDao, 'getStoppableEvaluation').mockResolvedValueOnce({
      ...TEST_EVALUATION_ITEM,
      status: JobStatus.QUEUED,
    });
    vi.spyOn(submissionDao, 'getStoppableSubmission').mockResolvedValueOnce(null);
    vi.spyOn(trainingDao, 'getStoppableTraining').mockResolvedValueOnce(null);
    vi.spyOn(sageMakerHelper, 'stopQueuedJob').mockRejectedValueOnce(
      new Error('Failed to cancel job. Please check with your administrator'),
    );

    await expect(StopModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      'Failed to cancel job. Please check with your administrator',
    );

    expect(sageMakerHelper.stopQueuedJob).toHaveBeenCalledWith(TEST_EVALUATION_ITEM.name);
    expect(modelDao.update).not.toHaveBeenCalled();
    expect(workflowHelper.updateJob).not.toHaveBeenCalled();
  });

  it('should throw BadRequestError when model is in EVALUATING status and job is INITIALIZING', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.EVALUATING });
    vi.spyOn(evaluationDao, 'getStoppableEvaluation').mockResolvedValueOnce({
      ...TEST_EVALUATION_ITEM,
      status: JobStatus.INITIALIZING,
    });

    await expect(StopModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      BadRequestError,
    );

    expect(evaluationDao.getStoppableEvaluation).toHaveBeenCalledWith(TEST_MODEL_ITEM.modelId);
    expect(sageMakerHelper.stopTrainingJob).not.toHaveBeenCalled();
    expect(modelDao.update).not.toHaveBeenCalled();
    expect(workflowHelper.updateJob).not.toHaveBeenCalled();
    expect(submissionDao.getStoppableSubmission).not.toHaveBeenCalled();
    expect(trainingDao.getStoppableTraining).not.toHaveBeenCalled();
  });

  it('should throw BadRequestError when model is in TRAINING status and job is INITIALIZING', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.TRAINING });
    vi.spyOn(trainingDao, 'getStoppableTraining').mockResolvedValueOnce({
      ...TEST_TRAINING_ITEM,
      status: JobStatus.INITIALIZING,
    });

    await expect(StopModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      BadRequestError,
    );

    expect(trainingDao.getStoppableTraining).toHaveBeenCalledWith(TEST_MODEL_ITEM.modelId);
    expect(sageMakerHelper.stopTrainingJob).not.toHaveBeenCalled();
    expect(modelDao.update).not.toHaveBeenCalled();
    expect(workflowHelper.updateJob).not.toHaveBeenCalled();
    expect(submissionDao.getStoppableSubmission).not.toHaveBeenCalled();
    expect(evaluationDao.getStoppableEvaluation).not.toHaveBeenCalled();
  });

  it.each(Object.values(ModelStatus).filter((s) => !STOPPABLE_MODEL_STATUSES.includes(s)))(
    'should throw error when model is in non-stoppable status: %s',
    async (nonStoppableStatus) => {
      vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: nonStoppableStatus });

      await expect(
        StopModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT),
      ).rejects.toStrictEqual(new BadRequestError({ message: 'Model is not in a stoppable state.' }));
    },
  );

  it('should throw error when model is in stoppable status but no job is found', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.TRAINING });
    vi.spyOn(trainingDao, 'getStoppableTraining').mockResolvedValueOnce(null);

    await expect(StopModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      ApiErrorMessage.INTERNAL_SERVICE_ERROR,
    );

    expect(sageMakerHelper.stopTrainingJob).not.toHaveBeenCalled();
    expect(workflowHelper.updateJob).not.toHaveBeenCalled();
    expect(modelDao.update).not.toHaveBeenCalled();
  });

  it('should throw error when model item does not exist', async () => {
    const expectedError = new NotFoundError({ message: DatabaseErrorMessage.ITEM_NOT_FOUND });
    vi.spyOn(modelDao, 'load').mockRejectedValueOnce(expectedError);

    await expect(StopModelOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      expectedError,
    );
  });
});
