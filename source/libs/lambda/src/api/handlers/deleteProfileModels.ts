// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { ResourceId } from '@deepracer-indy/database';
import {
  getDeleteProfileModelsHandler,
  DeleteProfileModelsServerInput,
  DeleteProfileModelsServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import { deleteModelsForProfile } from '../../utils/deleteModelsForProfile.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const DeleteProfileModelsOperation: Operation<
  DeleteProfileModelsServerInput,
  DeleteProfileModelsServerOutput,
  HandlerContext
> = async (input, context) => {
  const targetProfileId = input.profileId as ResourceId;

  logger.info('Deleting all models for profile', { targetProfileId });
  await deleteModelsForProfile(targetProfileId);
  logger.info('Deleted all models for profile', { targetProfileId });

  metricsLogger.logDeleteProfileModels();

  return {};
};

export const lambdaHandler = getApiGatewayHandler(
  getDeleteProfileModelsHandler(instrumentOperation(DeleteProfileModelsOperation)),
);
