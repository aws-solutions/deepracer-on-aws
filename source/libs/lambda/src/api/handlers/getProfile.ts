// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { DynamoDBItemAttribute, profileDao, ResourceId } from '@deepracer-indy/database';
import {
  getGetProfileHandler,
  GetProfileServerInput,
  GetProfileServerOutput,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import { globalSettingsHelper } from '../../utils/GlobalSettingsHelper.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

// Safety net for federated sign-in paths where PreSignUp may not fully populate a profile:
// creates a minimal profile (same quota defaults PreSignUp uses) with a blank alias so the
// frontend can detect "needs profile completion" rather than inventing a display name.
async function provisionFallbackProfile(profileId: ResourceId) {
  logger.warn('Profile not found — creating fallback profile', { profileId });

  const newUserLimits = (await globalSettingsHelper.getGlobalSetting('usageQuotas.newUser')) as {
    newUserComputeMinutesLimit: number;
    newUserModelCountLimit: number;
  } | null;

  return profileDao.create({
    profileId,
    alias: '',
    [DynamoDBItemAttribute.MAX_TOTAL_COMPUTE_MINUTES]: Number(newUserLimits?.newUserComputeMinutesLimit ?? 0),
    [DynamoDBItemAttribute.MAX_MODEL_COUNT]: Number(newUserLimits?.newUserModelCountLimit ?? 0),
    [DynamoDBItemAttribute.CREATED_AT]: new Date().toISOString(),
  });
}

export const GetProfileOperation: Operation<GetProfileServerInput, GetProfileServerOutput, HandlerContext> = async (
  _input,
  context,
) => {
  const { profileId } = context;

  let profileItem;
  try {
    profileItem = await profileDao.load({ profileId });
  } catch (error) {
    if (error instanceof NotFoundError) {
      profileItem = await provisionFallbackProfile(profileId);
    } else {
      throw error;
    }
  }

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
