// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  evaluationDao,
  submissionDao,
  TEST_EVALUATION_ITEM,
  TEST_SUBMISSION_ITEM,
  TEST_TRAINING_ITEM,
  trainingDao,
} from '@deepracer-indy/database';
import { JobStatus } from '@deepracer-indy/typescript-server-client';

import { workflowHelper } from '../WorkflowHelper.js';

describe('WorkflowHelper', () => {
  describe('isEvaluation()', () => {
    it('should return true if given an evaluation item', () => {
      expect(workflowHelper.isEvaluation(TEST_EVALUATION_ITEM)).toBe(true);
    });
    it('should return false if not given an evaluation item', () => {
      expect(workflowHelper.isEvaluation(TEST_TRAINING_ITEM)).toBe(false);
      expect(workflowHelper.isEvaluation(TEST_SUBMISSION_ITEM)).toBe(false);
    });
  });

  describe('isSubmission()', () => {
    it('should return true if given a submission item', () => {
      expect(workflowHelper.isSubmission(TEST_SUBMISSION_ITEM)).toBe(true);
    });
    it('should return false if not given a submission item', () => {
      expect(workflowHelper.isSubmission(TEST_EVALUATION_ITEM)).toBe(false);
      expect(workflowHelper.isSubmission(TEST_TRAINING_ITEM)).toBe(false);
    });
  });

  describe('isTraining()', () => {
    it('should return true if given a training item', () => {
      expect(workflowHelper.isTraining(TEST_TRAINING_ITEM)).toBe(true);
    });
    it('should return false if not given a training item', () => {
      expect(workflowHelper.isTraining(TEST_EVALUATION_ITEM)).toBe(false);
      expect(workflowHelper.isTraining(TEST_SUBMISSION_ITEM)).toBe(false);
    });
  });

  describe('getJob()', () => {
    it('should retrieve an evaluation job', async () => {
      const evaluationDaoLoadSpy = vi.spyOn(evaluationDao, 'load');
      evaluationDaoLoadSpy.mockResolvedValueOnce(TEST_EVALUATION_ITEM);

      await expect(
        workflowHelper.getJob({
          jobName: TEST_EVALUATION_ITEM.name,
          modelId: TEST_EVALUATION_ITEM.modelId,
          profileId: TEST_EVALUATION_ITEM.profileId,
        }),
      ).resolves.toBe(TEST_EVALUATION_ITEM);

      expect(evaluationDaoLoadSpy).toHaveBeenCalledWith({
        modelId: TEST_EVALUATION_ITEM.modelId,
        evaluationId: TEST_EVALUATION_ITEM.evaluationId,
      });
    });

    it('should retrieve a training job', async () => {
      const trainingDaoLoadSpy = vi.spyOn(trainingDao, 'load');
      trainingDaoLoadSpy.mockResolvedValueOnce(TEST_TRAINING_ITEM);

      await expect(
        workflowHelper.getJob({
          jobName: TEST_TRAINING_ITEM.name,
          modelId: TEST_TRAINING_ITEM.modelId,
          profileId: TEST_TRAINING_ITEM.profileId,
        }),
      ).resolves.toBe(TEST_TRAINING_ITEM);

      expect(trainingDaoLoadSpy).toHaveBeenCalledWith({ modelId: TEST_TRAINING_ITEM.modelId });
    });

    it('should retrieve a submission job', async () => {
      const submissionLoadSpy = vi.spyOn(submissionDao, 'load');
      submissionLoadSpy.mockResolvedValueOnce(TEST_SUBMISSION_ITEM);

      await expect(
        workflowHelper.getJob({
          jobName: TEST_SUBMISSION_ITEM.name,
          modelId: TEST_SUBMISSION_ITEM.modelId,
          profileId: TEST_SUBMISSION_ITEM.profileId,
          leaderboardId: TEST_SUBMISSION_ITEM.leaderboardId,
        }),
      ).resolves.toBe(TEST_SUBMISSION_ITEM);

      expect(submissionLoadSpy).toHaveBeenCalledWith({
        submissionId: TEST_SUBMISSION_ITEM.submissionId,
        profileId: TEST_SUBMISSION_ITEM.profileId,
        leaderboardId: TEST_SUBMISSION_ITEM.leaderboardId,
      });
    });
  });

  describe('updateJob()', () => {
    const testUpdatedAttributes = { status: JobStatus.COMPLETED };

    it('should update an evaluation job', async () => {
      const evaluationDaoUpdateSpy = vi.spyOn(evaluationDao, 'update').mockResolvedValue(TEST_EVALUATION_ITEM);

      await expect(
        workflowHelper.updateJob(
          { jobName: TEST_EVALUATION_ITEM.name, modelId: TEST_EVALUATION_ITEM.modelId },
          testUpdatedAttributes,
        ),
      ).resolves.toBe(TEST_EVALUATION_ITEM);

      expect(evaluationDaoUpdateSpy).toHaveBeenCalledWith(
        { modelId: TEST_EVALUATION_ITEM.modelId, evaluationId: TEST_EVALUATION_ITEM.evaluationId },
        testUpdatedAttributes,
      );
    });

    it('should update a submission job', async () => {
      const submissionDaoUpdateSpy = vi.spyOn(submissionDao, 'update').mockResolvedValue(TEST_SUBMISSION_ITEM);

      await expect(
        workflowHelper.updateJob(
          {
            jobName: TEST_SUBMISSION_ITEM.name,
            modelId: TEST_SUBMISSION_ITEM.modelId,
            profileId: TEST_SUBMISSION_ITEM.profileId,
            leaderboardId: TEST_SUBMISSION_ITEM.leaderboardId,
          },
          testUpdatedAttributes,
        ),
      ).resolves.toBe(TEST_SUBMISSION_ITEM);

      expect(submissionDaoUpdateSpy).toHaveBeenCalledWith(
        {
          submissionId: TEST_SUBMISSION_ITEM.submissionId,
          profileId: TEST_SUBMISSION_ITEM.profileId,
          leaderboardId: TEST_SUBMISSION_ITEM.leaderboardId,
        },
        testUpdatedAttributes,
      );
    });

    it('should update a training job', async () => {
      const trainingDaoUpdateSpy = vi.spyOn(trainingDao, 'update').mockResolvedValueOnce(TEST_TRAINING_ITEM);

      await expect(
        workflowHelper.updateJob(
          { jobName: TEST_TRAINING_ITEM.name, modelId: TEST_TRAINING_ITEM.modelId },
          testUpdatedAttributes,
        ),
      ).resolves.toBe(TEST_TRAINING_ITEM);

      expect(trainingDaoUpdateSpy).toHaveBeenCalledWith({ modelId: TEST_TRAINING_ITEM.modelId }, testUpdatedAttributes);
    });
  });
});
