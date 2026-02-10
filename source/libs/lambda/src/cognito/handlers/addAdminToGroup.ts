// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { logger } from '@deepracer-indy/utils';
import type { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from 'aws-lambda';

import { UserGroups } from './common/constants';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

export const AddAdminToGroup = async (
  event: CloudFormationCustomResourceEvent,
): Promise<CloudFormationCustomResourceResponse> => {
  const { userPoolId, adminEmail } = event.ResourceProperties;

  // Only process Create events
  if (event.RequestType !== 'Create') {
    return {
      Status: 'SUCCESS',
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      StackId: event.StackId,
      PhysicalResourceId: 'admin-group-membership',
    };
  }

  logger.info('Adding admin to group');

  const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
  });

  try {
    await addUser(cognitoClient, userPoolId, adminEmail);
    return createSuccessResponse(event, adminEmail);
  } catch {
    throw new Error('Failed to add admin to group');
  }
};

const addUser = async (
  cognitoClient: CognitoIdentityProviderClient,
  userPoolId: string,
  adminEmail: string,
): Promise<void> => {
  try {
    await assignUserToAdminGroup(cognitoClient, userPoolId, adminEmail);
  } catch (error) {
    if (error instanceof UserNotFoundException) {
      const username = await createUser(cognitoClient, userPoolId, adminEmail);
      await assignUserToAdminGroup(cognitoClient, userPoolId, username);
    } else {
      throw new Error('Failed to add admin to group');
    }
  }

  logger.info('Successfully added admin to group');
};

const createUser = async (
  cognitoClient: CognitoIdentityProviderClient,
  userPoolId: string,
  adminEmail: string,
): Promise<string> => {
  // Generate a unique username that's not an email (must start with letter, only alphanumeric and underscore allowed)
  const timestamp = Date.now().toString(16); // Convert to base36 for shorter, alphanumeric result
  const username = `admin${timestamp}`.slice(0, 15);

  await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: username,
      MessageAction: 'SUPPRESS', // Suppress initial email - will be sent later with website URL
      DesiredDeliveryMediums: ['EMAIL'],
      UserAttributes: [
        {
          Name: 'email',
          Value: adminEmail,
        },
        {
          Name: 'email_verified',
          Value: 'true',
        },
      ],
    }),
  );

  return username;
};

const assignUserToAdminGroup = async (
  cognitoClient: CognitoIdentityProviderClient,
  userPoolId: string,
  username: string,
): Promise<void> => {
  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: UserGroups.ADMIN,
    }),
  );
};

const createSuccessResponse = (
  event: CloudFormationCustomResourceEvent,
  adminEmail: string,
): CloudFormationCustomResourceResponse => ({
  Status: 'SUCCESS',
  RequestId: event.RequestId,
  LogicalResourceId: event.LogicalResourceId,
  StackId: event.StackId,
  PhysicalResourceId: 'admin-group-membership',
  Data: {
    Message: 'Successfully added user to admin group',
  },
});

export const lambdaHandler = instrumentHandler(AddAdminToGroup);
