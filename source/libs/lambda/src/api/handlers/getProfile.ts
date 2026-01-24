// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { profileDao } from '@deepracer-indy/database';
import {
  getGetProfileHandler,
  GetProfileServerInput,
  GetProfileServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { metricsLogger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const GetProfileOperation: Operation<GetProfileServerInput, GetProfileServerOutput, HandlerContext> = async (
  _input,
  context,
) => {
  const { profileId } = context;

  const profileItem = await profileDao.load({ profileId });

  metricsLogger.logUserLogin({
    profileId: profileItem.profileId,
  });
  return {
    profile: {
      alias: profileItem.alias,
      avatar: profileItem.avatar,
      profileId: profileItem.profileId,
      emailAddress: profileItem.emailAddress,
      computeMinutesUsed: profileItem.computeMinutesUsed,
      computeMinutesQueued: profileItem.computeMinutesQueued,
      maxTotalComputeMinutes: profileItem.maxTotalComputeMinutes,
      modelCount: profileItem.modelCount,
      maxModelCount: profileItem.maxModelCount,
    },
  } satisfies GetProfileServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getGetProfileHandler(instrumentOperation(GetProfileOperation)));
