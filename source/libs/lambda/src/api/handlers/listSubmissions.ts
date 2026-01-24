// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { ResourceId, submissionDao } from '@deepracer-indy/database';
import {
  getListSubmissionsHandler,
  ListSubmissionsServerInput,
  ListSubmissionsServerOutput,
  Submission,
} from '@deepracer-indy/typescript-server-client';
import { s3Helper, waitForAll } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const ListSubmissionsOperation: Operation<
  ListSubmissionsServerInput,
  ListSubmissionsServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;
  const leaderboardId = input.leaderboardId as ResourceId;

  const { cursor, data: submissionItems } = await submissionDao.listByCreatedAt({
    profileId,
    leaderboardId,
    cursor: input.token,
  });

  const submissions = await waitForAll(
    submissionItems.map(
      async (submissionItem): Promise<Submission> => ({
        modelId: submissionItem.modelId,
        modelName: submissionItem.modelName,
        rankingScore: submissionItem.rankingScore,
        stats: submissionItem.stats,
        status: submissionItem.status,
        submissionNumber: submissionItem.submissionNumber,
        submittedAt: new Date(submissionItem.createdAt),
        videoUrl: await s3Helper.getPresignedUrl(submissionItem.assetS3Locations.primaryVideoS3Location),
      }),
    ),
  );

  return { submissions, token: cursor ?? undefined } satisfies ListSubmissionsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getListSubmissionsHandler(instrumentOperation(ListSubmissionsOperation)),
);
