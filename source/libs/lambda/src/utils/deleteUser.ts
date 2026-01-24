// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourceId } from '@deepracer-indy/database';
import { logger } from '@deepracer-indy/utils';

import { deleteModelsForProfile } from './deleteModelsForProfile.js';
import { deleteUserFromCognito } from './deleteUserFromCognito.js';
import { deleteUserFromDatabase } from './deleteUserFromDatabase.js';

export async function deleteUser(profileId: ResourceId): Promise<void> {
  logger.info('Starting complete user deletion', { profileId });

  try {
    // Delete in order: 1) Cognito (revoke access), 2) Database (remove profile), 3) Models (cleanup resources)
    // This ensures user cannot access system while cleanup is in progress

    await deleteUserFromCognito(profileId);

    await deleteUserFromDatabase(profileId);

    await deleteModelsForProfile(profileId);

    logger.info('Completed user deletion', { profileId });
  } catch (error) {
    logger.error('Failed to delete user', { profileId, error });
    throw error;
  }
}
