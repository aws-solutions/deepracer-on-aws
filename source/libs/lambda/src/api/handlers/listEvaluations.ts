// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { evaluationDao, modelDao, ResourceId } from '@deepracer-indy/database';
import {
  Evaluation,
  getListEvaluationsHandler,
  JobStatus,
  ListEvaluationsServerInput,
  ListEvaluationsServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { s3Helper, waitForAll } from '@deepracer-indy/utils';

import { modelPerformanceMetricsHelper } from '../../workflow/utils/ModelPerformanceMetricsHelper.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const ListEvaluationsOperation: Operation<
  ListEvaluationsServerInput,
  ListEvaluationsServerOutput,
  HandlerContext
> = async (input, context) => {
  const modelId = input.modelId as ResourceId;
  const { profileId } = context;

  // Validate model exists
  await modelDao.load({ profileId, modelId });

  const { cursor, data: evaluationItems } = await evaluationDao.list({ modelId, cursor: input.token });

  const evaluations = await waitForAll(
    evaluationItems.map(
      async (evaluationItem): Promise<Evaluation> => ({
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
      }),
    ),
  );

  return { evaluations, token: cursor ?? undefined } satisfies ListEvaluationsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getListEvaluationsHandler(instrumentOperation(ListEvaluationsOperation)),
);
