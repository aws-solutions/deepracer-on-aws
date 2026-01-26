// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { profileDao, ResourceId } from '@deepracer-indy/database';
import {
  AvatarConfig,
  BadRequestError,
  getUpdateProfileHandler,
  UpdateProfileServerInput,
  UpdateProfileServerOutput,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

type UpdatableAttributes = {
  alias?: string;
  avatar?: AvatarConfig;
  maxTotalComputeMinutes?: number;
  maxModelCount?: number;
};

/**
 * Builds the attributes object for updating based on user permissions.
 * Only admins can modify maxTotalComputeMinutes and maxModelCount.
 */
function buildUpdateAttributes(
  input: UpdateProfileServerInput,
  isAdmin: boolean,
): { attributes: UpdatableAttributes; hasUpdates: boolean } {
  const { alias, avatar, maxTotalComputeMinutes, maxModelCount } = input;
  const attributes: UpdatableAttributes = {};

  // Fields that don't require admin permissions
  if (alias) {
    attributes.alias = alias;
  }

  if (avatar && Object.keys(avatar).length) {
    attributes.avatar = avatar;
  }

  // Fields that are restricted to admins only
  if (maxTotalComputeMinutes !== undefined || maxModelCount !== undefined) {
    if (!isAdmin) {
      const attemptedFields = [];
      if (maxTotalComputeMinutes !== undefined) attemptedFields.push('maxTotalComputeMinutes');
      if (maxModelCount !== undefined) attemptedFields.push('maxModelCount');

      throw new BadRequestError({
        message: 'Non-admin user requesting to change one or more admin-only properties.',
      });
    }

    if (maxTotalComputeMinutes !== undefined) {
      attributes.maxTotalComputeMinutes = maxTotalComputeMinutes;
    }

    if (maxModelCount !== undefined) {
      attributes.maxModelCount = maxModelCount;
    }
  }

  const hasUpdates = Object.keys(attributes).length > 0;
  return { attributes, hasUpdates };
}

export const UpdateProfileOperation: Operation<
  UpdateProfileServerInput,
  UpdateProfileServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId: contextProfileId } = context;
  const { profileId: inputProfileId } = input;

  // Determine target profile and validate admin permissions
  const targetProfileId = (inputProfileId || contextProfileId) as ResourceId;
  const isAdmin = await isUserAdmin(contextProfileId);

  // If user is trying to update another user's profile, they must be an admin
  if (inputProfileId && inputProfileId !== contextProfileId && !isAdmin) {
    throw new BadRequestError({
      message: 'Admin permission required to make this change.',
    });
  }

  // Build update attributes based on permissions
  const { attributes, hasUpdates } = buildUpdateAttributes(input, isAdmin);

  if (!hasUpdates) {
    throw new BadRequestError({
      message:
        'At least one valid field (alias, avatar, maxTotalComputeMinutes, or maxModelCount) needs to be provided.',
    });
  }

  // Update the profile
  const profileItem = await profileDao.update({ profileId: targetProfileId }, attributes);

  return {
    profile: {
      alias: profileItem.alias,
      avatar: profileItem.avatar,
      profileId: profileItem.profileId,
      computeMinutesUsed: profileItem.computeMinutesUsed,
      computeMinutesQueued: profileItem.computeMinutesQueued,
      maxTotalComputeMinutes: profileItem.maxTotalComputeMinutes,
      maxModelCount: profileItem.maxModelCount,
    },
  } satisfies UpdateProfileServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getUpdateProfileHandler(instrumentOperation(UpdateProfileOperation)));
