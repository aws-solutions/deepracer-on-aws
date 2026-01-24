// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { modelDao, ResourceId } from '@deepracer-indy/database';
import {
  getDeleteModelHandler,
  DeleteModelServerInput,
  DeleteModelServerOutput,
  ModelStatus,
  BadRequestError,
} from '@deepracer-indy/typescript-server-client';
import { metricsLogger } from '@deepracer-indy/utils';

import { deleteModelData } from '../../utils/deleteModelData.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

// TODO: Move most of this into a util, separate lambda, or sqs queue for admin delete use case
// TODO: Delete submissions
/** This is the implementation of business logic of the DeleteModel operation. */
export const DeleteModelOperation: Operation<DeleteModelServerInput, DeleteModelServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  const { profileId } = context;
  const modelId = input.modelId as ResourceId;

  const modelItem = await modelDao.load({ profileId, modelId });

  if (modelItem.status !== ModelStatus.READY && modelItem.status !== ModelStatus.ERROR) {
    throw new BadRequestError({ message: 'This resource cannot be deleted at this time. Try again later.' });
  }

  await modelDao.update({ profileId, modelId }, { status: ModelStatus.DELETING });

  await deleteModelData(profileId, modelItem);

  metricsLogger.logDeleteModel();

  return {};
};

export const lambdaHandler = getApiGatewayHandler(getDeleteModelHandler(instrumentOperation(DeleteModelOperation)));
