// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { evaluationDao, ResourceId } from '@deepracer-indy/database';
import {
  getGetEvaluationHandler,
  GetEvaluationServerInput,
  GetEvaluationServerOutput,
  NotFoundError,
  JobStatus,
} from '@deepracer-indy/typescript-server-client';
import { s3Helper } from '@deepracer-indy/utils';

import { modelPerformanceMetricsHelper } from '../../workflow/utils/ModelPerformanceMetricsHelper.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/** This is the implementation of business logic of the GetEvaluation operation. */
export const GetEvaluationOperation: Operation<
  GetEvaluationServerInput,
  GetEvaluationServerOutput,
  HandlerContext
> = async (input, context) => {
  const evaluationId = input.evaluationId as ResourceId;
  const modelId = input.modelId as ResourceId;

  const evaluationItem = await evaluationDao.load({ evaluationId, modelId });

  if (evaluationItem.profileId !== context.profileId) {
    throw new NotFoundError({ message: 'The evaluation cannot be found.' });
  }

  return {
    evaluation: {
      config: {
        evaluationName: evaluationItem.evaluationName,
        maxLaps: evaluationItem.terminationConditions.maxLaps,
        maxTimeInMinutes: evaluationItem.terminationConditions.maxTimeInMinutes,
        objectAvoidanceConfig: evaluationItem.objectAvoidanceConfig,
        raceType: evaluationItem.raceType,
        resettingBehaviorConfig: evaluationItem.resettingBehaviorConfig,
        trackConfig: evaluationItem.trackConfig,
      },
      createdAt: new Date(evaluationItem.createdAt),
      evaluationId: evaluationItem.evaluationId,
      metrics:
        evaluationItem.metrics ??
        (await modelPerformanceMetricsHelper.getEvaluationMetrics(evaluationItem.assetS3Locations.metricsS3Location)),
      modelId: evaluationItem.modelId,
      status: evaluationItem.status,
      videoStreamUrl: evaluationItem.videoStreamUrl, // Only present while SimApp is streaming
      videoUrl:
        evaluationItem.status === JobStatus.COMPLETED && evaluationItem.metrics?.length // We don't send videoUrl if the evaluation doesn't have any completed laps because SimApp does not save the video in that case
          ? await s3Helper.getPresignedUrl(evaluationItem.assetS3Locations.primaryVideoS3Location)
          : undefined,
    },
  } satisfies GetEvaluationServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getGetEvaluationHandler(instrumentOperation(GetEvaluationOperation)));
