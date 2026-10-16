// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { DynamoDBItemAttribute, isConditionalCheckFailure, profileDao, ResourceId } from '@deepracer-indy/database';
import {
  getGetProfileHandler,
  GetProfileServerInput,
  GetProfileServerOutput,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import { isFederatedUserName } from '../../cognito/handlers/common/constants.js';
import { globalSettingsHelper } from '../../utils/GlobalSettingsHelper.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * Safety net for federated sign-in paths where PreSignUp may not fully populate a profile:
 * creates a minimal profile (same quota defaults PreSignUp uses) with a blank alias so the
 * frontend can detect "needs profile completion" rather than inventing a display name.
 *
 * Scoped to federated profileIds only — a missing profile for a native/admin-created user is a
 * genuine anomaly (bad delete, stuck migration, race) that should surface as an error, not be
 * silently papered over with a fresh zero-quota profile.
 */
async function provisionFallbackProfile(profileId: ResourceId) {
  logger.warn('Profile not found — creating fallback profile', { profileId });

  const newUserLimits = (await globalSettingsHelper.getGlobalSetting('usageQuotas.newUser')) as {
    newUserComputeMinutesLimit: number;
    newUserModelCountLimit: number;
  } | null;

  if (newUserLimits?.newUserComputeMinutesLimit === undefined || newUserLimits?.newUserModelCountLimit === undefined) {
    // Matches preSignUp.ts's validateNewUserLimits rigor: a misconfigured AppConfig should fail
    // loudly here too, rather than silently handing out a 0/0-quota profile nobody can debug.
    throw new Error('Failed to create fallback profile: missing usageQuotas.newUser global settings');
  }

  try {
    return await profileDao.create({
      profileId,
      alias: '',
      [DynamoDBItemAttribute.MAX_TOTAL_COMPUTE_MINUTES]: Number(newUserLimits.newUserComputeMinutesLimit),
      [DynamoDBItemAttribute.MAX_MODEL_COUNT]: Number(newUserLimits.newUserModelCountLimit),
      [DynamoDBItemAttribute.CREATED_AT]: new Date().toISOString(),
    });
  } catch (error) {
    // Mirrors preSignUp.ts's tolerance for the same race: two near-simultaneous getProfile calls
    // for a brand-new federated user (e.g. two browser tabs) can both hit NotFoundError and both
    // attempt to create the profile — the loser of that race should load the winner's record
    // instead of surfacing a 500.
    if (isConditionalCheckFailure(error)) {
      return profileDao.load({ profileId });
    }
    throw error;
  }
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
    if (error instanceof NotFoundError && isFederatedUserName(profileId)) {
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
