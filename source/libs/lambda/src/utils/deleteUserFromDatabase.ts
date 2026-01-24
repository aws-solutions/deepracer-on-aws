// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { profileDao, ResourceId } from '@deepracer-indy/database';
import { logger } from '@deepracer-indy/utils';

export async function deleteUserFromDatabase(profileId: ResourceId): Promise<void> {
  logger.info('Deleting user profile from database', { profileId });

  try {
    await profileDao.delete({ profileId });
    logger.info('Deleted user profile from database', { profileId });
  } catch (error) {
    logger.error('Failed to delete user profile from database', { profileId, error });
    throw error;
  }
}
