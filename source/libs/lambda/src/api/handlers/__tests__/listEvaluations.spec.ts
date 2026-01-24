// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  evaluationDao,
  modelDao,
  TEST_EVALUATION_ITEMS,
  TEST_ITEM_NOT_FOUND_ERROR,
  TEST_MODEL_ITEM,
} from '@deepracer-indy/database';
import { JobStatus } from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';

import { modelPerformanceMetricsHelper } from '../../../workflow/utils/ModelPerformanceMetricsHelper.js';
import { MOCK_EVALUATION_METRICS, TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListEvaluationsOperation } from '../listEvaluations.js';

describe('ListEvaluations operation', () => {
  beforeEach(() => {
    vi.spyOn(s3Helper, 'getPresignedUrl').mockImplementation((location) => Promise.resolve(location));
  });

  it('should return a list of evaluations on success', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue(TEST_MODEL_ITEM);
    vi.spyOn(evaluationDao, 'list').mockResolvedValue({ data: TEST_EVALUATION_ITEMS, cursor: null });
    vi.spyOn(modelPerformanceMetricsHelper, 'getEvaluationMetrics').mockResolvedValue(MOCK_EVALUATION_METRICS);

    const output = await ListEvaluationsOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT);

    expect(output.evaluations).toHaveLength(TEST_EVALUATION_ITEMS.length);
    expect(output.token).toBeUndefined();
    output.evaluations.forEach((evaluation, i) => {
      expect(evaluation).toEqual({
        config: {
          evaluationName: TEST_EVALUATION_ITEMS[i].evaluationName,
          maxLaps: TEST_EVALUATION_ITEMS[i].terminationConditions.maxLaps,
          maxTimeInMinutes: TEST_EVALUATION_ITEMS[i].terminationConditions.maxTimeInMinutes,
          objectAvoidanceConfig: TEST_EVALUATION_ITEMS[i].objectAvoidanceConfig,
          raceType: TEST_EVALUATION_ITEMS[i].raceType,
          resettingBehaviorConfig: TEST_EVALUATION_ITEMS[i].resettingBehaviorConfig,
          trackConfig: TEST_EVALUATION_ITEMS[i].trackConfig,
        },
        createdAt: new Date(TEST_EVALUATION_ITEMS[i].createdAt),
        evaluationId: TEST_EVALUATION_ITEMS[i].evaluationId,
        metrics: TEST_EVALUATION_ITEMS[i].metrics ?? MOCK_EVALUATION_METRICS,
        modelId: TEST_EVALUATION_ITEMS[i].modelId,
        status: TEST_EVALUATION_ITEMS[i].status,
        videoStreamUrl: TEST_EVALUATION_ITEMS[i].videoStreamUrl,
        videoUrl:
          TEST_EVALUATION_ITEMS[i].status === JobStatus.COMPLETED && TEST_EVALUATION_ITEMS[i].metrics?.length
            ? TEST_EVALUATION_ITEMS[i].assetS3Locations.primaryVideoS3Location
            : undefined,
      });
    });
  });

  it('should return a list of evaluations on success with token', async () => {
    const mockToken = 'nextToken';
    vi.spyOn(modelDao, 'load').mockResolvedValue(TEST_MODEL_ITEM);
    vi.spyOn(evaluationDao, 'list').mockResolvedValue({ data: TEST_EVALUATION_ITEMS, cursor: mockToken });
    vi.spyOn(modelPerformanceMetricsHelper, 'getEvaluationMetrics').mockResolvedValue(MOCK_EVALUATION_METRICS);

    const output = await ListEvaluationsOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT);

    expect(output.evaluations).toHaveLength(TEST_EVALUATION_ITEMS.length);
    expect(output.token).toBe(mockToken);
    output.evaluations.forEach((evaluation, i) => {
      expect(evaluation).toEqual({
        config: {
          evaluationName: TEST_EVALUATION_ITEMS[i].evaluationName,
          maxLaps: TEST_EVALUATION_ITEMS[i].terminationConditions.maxLaps,
          maxTimeInMinutes: TEST_EVALUATION_ITEMS[i].terminationConditions.maxTimeInMinutes,
          objectAvoidanceConfig: TEST_EVALUATION_ITEMS[i].objectAvoidanceConfig,
          raceType: TEST_EVALUATION_ITEMS[i].raceType,
          resettingBehaviorConfig: TEST_EVALUATION_ITEMS[i].resettingBehaviorConfig,
          trackConfig: TEST_EVALUATION_ITEMS[i].trackConfig,
        },
        createdAt: new Date(TEST_EVALUATION_ITEMS[i].createdAt),
        evaluationId: TEST_EVALUATION_ITEMS[i].evaluationId,
        metrics: TEST_EVALUATION_ITEMS[i].metrics ?? MOCK_EVALUATION_METRICS,
        modelId: TEST_EVALUATION_ITEMS[i].modelId,
        status: TEST_EVALUATION_ITEMS[i].status,
        videoStreamUrl: TEST_EVALUATION_ITEMS[i].videoStreamUrl,
        videoUrl:
          TEST_EVALUATION_ITEMS[i].status === JobStatus.COMPLETED && TEST_EVALUATION_ITEMS[i].metrics?.length
            ? TEST_EVALUATION_ITEMS[i].assetS3Locations.primaryVideoS3Location
            : undefined,
      });
    });
  });

  it('should throw NotFoundError if model does not exist', async () => {
    vi.spyOn(modelDao, 'load').mockRejectedValue(TEST_ITEM_NOT_FOUND_ERROR);

    return expect(
      ListEvaluationsOperation({ modelId: TEST_MODEL_ITEM.modelId }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });
});
