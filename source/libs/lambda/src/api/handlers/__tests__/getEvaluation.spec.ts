// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  evaluationDao,
  EvaluationItem,
  generateResourceId,
  TEST_EVALUATION_ITEM,
  TEST_EVALUATION_ITEM_OA,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_MODEL_ITEM,
} from '@deepracer-indy/database';
import { JobStatus, NotFoundError } from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';

import { modelPerformanceMetricsHelper } from '../../../workflow/utils/ModelPerformanceMetricsHelper.js';
import { MOCK_EVALUATION_METRICS, TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetEvaluationOperation } from '../getEvaluation.js';

describe('GetEvaluation operation', () => {
  it('should return evaluation in response', async () => {
    const mockEvaluationItem: EvaluationItem = { ...TEST_EVALUATION_ITEM_OA, status: JobStatus.COMPLETED };

    vi.spyOn(evaluationDao, 'load').mockResolvedValue(mockEvaluationItem);
    vi.spyOn(s3Helper, 'getPresignedUrl').mockImplementation((location) => Promise.resolve(location));

    const output = await GetEvaluationOperation(
      { modelId: TEST_MODEL_ITEM.modelId, evaluationId: mockEvaluationItem.evaluationId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.evaluation).toEqual({
      config: {
        evaluationName: mockEvaluationItem.evaluationName,
        maxLaps: mockEvaluationItem.terminationConditions.maxLaps,
        maxTimeInMinutes: mockEvaluationItem.terminationConditions.maxTimeInMinutes,
        objectAvoidanceConfig: mockEvaluationItem.objectAvoidanceConfig,
        raceType: mockEvaluationItem.raceType,
        resettingBehaviorConfig: mockEvaluationItem.resettingBehaviorConfig,
        trackConfig: mockEvaluationItem.trackConfig,
      },
      createdAt: new Date(mockEvaluationItem.createdAt),
      evaluationId: mockEvaluationItem.evaluationId,
      metrics: mockEvaluationItem.metrics ?? MOCK_EVALUATION_METRICS,
      modelId: mockEvaluationItem.modelId,
      status: mockEvaluationItem.status,
      videoStreamUrl: mockEvaluationItem.videoStreamUrl,
      videoUrl:
        mockEvaluationItem.status === JobStatus.COMPLETED
          ? mockEvaluationItem.assetS3Locations.primaryVideoS3Location
          : undefined,
    });
  });

  it('should exclude videoUrl when evaluation status is not COMPLETED', async () => {
    const mockEvaluationItem: EvaluationItem = { ...TEST_EVALUATION_ITEM_OA, status: JobStatus.IN_PROGRESS };

    vi.spyOn(evaluationDao, 'load').mockResolvedValue(mockEvaluationItem);

    const output = await GetEvaluationOperation(
      { modelId: TEST_MODEL_ITEM.modelId, evaluationId: mockEvaluationItem.evaluationId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.evaluation.videoUrl).toBeUndefined();
  });

  it('should exclude videoUrl when evaluation status is COMPLETED but there are no metrics (no completed laps)', async () => {
    const mockEvaluationItem: EvaluationItem = { ...TEST_EVALUATION_ITEM_OA, status: JobStatus.COMPLETED, metrics: [] };

    vi.spyOn(evaluationDao, 'load').mockResolvedValue(mockEvaluationItem);

    const output = await GetEvaluationOperation(
      { modelId: TEST_MODEL_ITEM.modelId, evaluationId: mockEvaluationItem.evaluationId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.evaluation.videoUrl).toBeUndefined();
  });

  it('should retrieve evaluation metrics from s3 when evaluationItem has no metrics', async () => {
    const mockEvaluationItem: EvaluationItem = {
      ...TEST_EVALUATION_ITEM_OA,
      metrics: undefined,
      status: JobStatus.IN_PROGRESS,
    };

    vi.spyOn(evaluationDao, 'load').mockResolvedValue(mockEvaluationItem);
    vi.spyOn(modelPerformanceMetricsHelper, 'getEvaluationMetrics').mockResolvedValue(MOCK_EVALUATION_METRICS);

    const output = await GetEvaluationOperation(
      { modelId: TEST_MODEL_ITEM.modelId, evaluationId: mockEvaluationItem.evaluationId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.evaluation.metrics).toEqual(MOCK_EVALUATION_METRICS);
    expect(modelPerformanceMetricsHelper.getEvaluationMetrics).toHaveBeenCalledWith(
      mockEvaluationItem.assetS3Locations.metricsS3Location,
    );
  });

  it('should throw NotFoundError if evaluation item does not match context profileId', async () => {
    expect.assertions(1);
    vi.spyOn(evaluationDao, 'load').mockResolvedValue({ ...TEST_EVALUATION_ITEM, profileId: generateResourceId() });

    return expect(
      GetEvaluationOperation(
        { modelId: TEST_MODEL_ITEM.modelId, evaluationId: TEST_EVALUATION_ITEM.evaluationId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(new NotFoundError({ message: 'The evaluation cannot be found.' }));
  });

  it('should throw NotFoundError if evaluation item does not exist', async () => {
    expect.assertions(1);
    vi.spyOn(evaluationDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    return expect(
      GetEvaluationOperation(
        { modelId: TEST_MODEL_ITEM.modelId, evaluationId: TEST_EVALUATION_ITEM.evaluationId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });
});
