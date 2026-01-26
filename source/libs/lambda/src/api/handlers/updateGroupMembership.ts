// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { Operation } from '@aws-smithy/server-common';
import {
  getUpdateGroupMembershipHandler,
  UpdateGroupMembershipServerInput,
  UpdateGroupMembershipServerOutput,
  UserGroups,
  InternalFailureError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { cognitoClient } from '../../utils/clients/cognitoClient.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const UpdateGroupMembershipOperation: Operation<
  UpdateGroupMembershipServerInput,
  UpdateGroupMembershipServerOutput,
  HandlerContext
> = async (input, _context) => {
  const { profileId, targetUserPoolGroup } = input;
  const userPoolId = process.env.USER_POOL_ID;

  if (!userPoolId) {
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }

  logger.info(`Updating group membership for user ${profileId} to ${targetUserPoolGroup}`);

  const originalGroups = await removeUserFromExistingGroups(userPoolId, profileId);

  try {
    await addUserToGroup(userPoolId, profileId, targetUserPoolGroup);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(JSON.stringify(error, Object.getOwnPropertyNames(error)));
      await restoreOriginalGroups(originalGroups, userPoolId, profileId);
    }
    throw new InternalFailureError({ message: 'Failed to add user to new group.' });
  }

  return {} as UpdateGroupMembershipServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getUpdateGroupMembershipHandler(instrumentOperation(UpdateGroupMembershipOperation)),
);

async function addUserToGroup(userPoolId: string, profileId: string, groupName: UserGroups) {
  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: profileId,
      GroupName: groupName,
    }),
  );
  logger.info(`Added user ${profileId} to group ${groupName}`);
}

async function restoreOriginalGroups(originalGroups: string[], userPoolId: string, profileId: string) {
  const failedGroups: string[] = [];

  for (const groupName of originalGroups) {
    try {
      await cognitoClient.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: profileId,
          GroupName: groupName,
        }),
      );
    } catch (restoreError) {
      failedGroups.push(groupName);
      logger.error(
        `Failed to restore group ${groupName}: ${JSON.stringify(restoreError, Object.getOwnPropertyNames(restoreError))}`,
      );
    }
  }

  if (failedGroups.length > 0) {
    throw new InternalFailureError({ message: 'Failed to restore membership in one or more groups.' });
  }
}

async function removeUserFromExistingGroups(userPoolId: string, profileId: string) {
  try {
    const listGroupsResponse = await cognitoClient.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: userPoolId,
        Username: profileId,
      }),
    );
    logger.info(`Current group memberships: ${JSON.stringify(listGroupsResponse)}`);

    let originalGroups: string[] = [];
    if (listGroupsResponse.Groups) {
      originalGroups = listGroupsResponse.Groups.map((group) => group.GroupName).filter(Boolean) as string[];
      for (const group of listGroupsResponse.Groups) {
        if (group.GroupName) {
          await cognitoClient.send(
            new AdminRemoveUserFromGroupCommand({
              UserPoolId: userPoolId,
              Username: profileId,
              GroupName: group.GroupName,
            }),
          );
        }
      }
    }

    logger.info(`Removed user ${profileId} from all groups`);
    return originalGroups;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
    throw new InternalFailureError({ message: 'Failed to remove user from groups.' });
  }
}
