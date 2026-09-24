// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { DynamoDBItemAttribute, modelDao, profileDao } from '@deepracer-indy/database';
import {
  AdminModelExtended,
  AdminModelMetadata,
  getListAdminModelsHandler,
  ListAdminModelsServerInput,
  ListAdminModelsServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const PROFILE_PROJECTION = [DynamoDBItemAttribute.PROFILE_ID, DynamoDBItemAttribute.ALIAS] as const;

export const ListAdminModelsOperation: Operation<
  ListAdminModelsServerInput,
  ListAdminModelsServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId } = context;

  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.info('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Not authorized.' });
  }

  // Get all profiles (projected to id + alias only)
  const profiles = await profileDao.listProjected(PROFILE_PROJECTION);

  // Query models per profile in parallel — allSettled so one bad profile can't nuke the entire list
  const results = await Promise.allSettled(
    profiles.map(async (profile) => {
      const { data: models } = await modelDao.listAll({ profileId: profile.profileId });
      return models.map((model) => ({ ...model, username: profile.alias }));
    }),
  );

  const modelsByProfile = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  const failedCount = results.filter((r) => r.status === 'rejected').length;
  if (failedCount > 0) {
    logger.warn('Some profile model queries failed', { failedCount, totalProfiles: profiles.length });
  }

  // Flatten into single list
  let allModels = modelsByProfile;

  // Apply optional server-side filters
  if (input.status) {
    allModels = allModels.filter((m) => m.status === input.status);
  }
  if (input.optimizationStatus) {
    allModels = allModels.filter((m) => m.optimizationStatus === input.optimizationStatus);
  }

  // Sort by createdAt descending (newest first)
  allModels.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  logger.info('Admin list all models', {
    action: 'ADMIN_LIST_ALL_MODELS',
    adminProfileId: profileId,
    modelCount: allModels.length,
  });

  const models: AdminModelExtended[] = allModels.map((item) => {
    const metadata: AdminModelMetadata | undefined = item.metadata
      ? {
          agentAlgorithm: item.metadata.agentAlgorithm,
          sensors: item.metadata.sensors,
          actionSpace: item.metadata.actionSpace,
          modelMD5: (item.metadata as Record<string, unknown>).modelMD5 as string | undefined,
          metadataMD5: (item.metadata as Record<string, unknown>).metadataMD5 as string | undefined,
        }
      : undefined;

    return {
      modelId: item.modelId,
      name: item.name,
      username: item.username,
      profileId: item.profileId,
      status: item.status,
      createdAt: new Date(item.createdAt),
      modelSource: item.modelSource,
      optimizationStatus: item.optimizationStatus,
      importErrorMessage: item.importErrorMessage,
      optimizationErrorMessage: item.optimizationErrorMessage,
      metadata,
    };
  });

  return { models };
};

export const lambdaHandler = getApiGatewayHandler(
  getListAdminModelsHandler(instrumentOperation(ListAdminModelsOperation)),
);
