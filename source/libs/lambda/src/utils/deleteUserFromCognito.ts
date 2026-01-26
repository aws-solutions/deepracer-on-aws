// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { ResourceId } from '@deepracer-indy/database';
import { logger } from '@deepracer-indy/utils';

import { cognitoClient } from './clients/cognitoClient.js';

export async function deleteUserFromCognito(profileId: ResourceId): Promise<void> {
  const userPoolId = process.env.USER_POOL_ID;

  if (!userPoolId) {
    throw new Error('USER_POOL_ID environment variable not set');
  }

  logger.info('Deleting user from Cognito', { profileId });

  try {
    const command = new AdminDeleteUserCommand({
      UserPoolId: userPoolId,
      Username: profileId,
    });

    await cognitoClient.send(command);
    logger.info('Deleted user from Cognito', { profileId });
  } catch (error) {
    logger.error('Failed to delete user from Cognito', { profileId, error });
    throw error;
  }
}
