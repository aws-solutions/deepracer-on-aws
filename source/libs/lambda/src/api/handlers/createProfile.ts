// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { Operation } from '@aws-smithy/server-common';
import { generateResourceId } from '@deepracer-indy/database';
import {
  BadRequestError,
  CreateProfileServerInput,
  CreateProfileServerOutput,
  getCreateProfileHandler,
  InternalFailureError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { UserGroups } from '../../cognito/handlers/common/constants.js';
import { cognitoClient } from '../../utils/clients/cognitoClient.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

async function CheckUserExists(userPoolId: string, emailAddress: string): Promise<boolean> {
  logger.info(`Checking if user exists with email: ${emailAddress}`);
  try {
    const response = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Filter: `email = "${emailAddress}"`,
      }),
    );
    return (response.Users?.length ?? 0) > 0;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
    throw new InternalFailureError({ message: 'Unable to verify user. Please try again.' });
  }
}

async function CreateUser(userPoolId: string, username: string, emailAddress: string) {
  logger.info(`Creating user with username: ${username}  emailAddress: ${emailAddress}} userPoolId: ${userPoolId}`);
  try {
    await cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: username,
        DesiredDeliveryMediums: ['EMAIL'],
        UserAttributes: [
          {
            Name: 'email',
            Value: emailAddress,
          },
          {
            Name: 'email_verified',
            Value: 'true',
          },
        ],
      }),
    );
  } catch (error) {
    if (error instanceof Error) {
      logger.error(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
    throw new InternalFailureError({ message: 'Unable to create profile. Please try again.' });
  }
}

async function AddUserToGroup(userPoolId: string, username: string) {
  logger.info(`Adding user to group: ${UserGroups.RACERS} userPoolId: ${userPoolId} username: ${username}`);
  try {
    await cognitoClient.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: username,
        GroupName: UserGroups.RACERS,
      }),
    );
  } catch (error) {
    if (error instanceof Error) {
      logger.error(JSON.stringify(error, Object.getOwnPropertyNames(error)));
      await DeleteUser(userPoolId, username);
      throw new InternalFailureError({ message: 'Unable to add user to Group. Please try again.' });
    }
  }
}

async function DeleteUser(userPoolId: string, username: string) {
  logger.info(`Deleting user with username: ${username} userPoolId: ${userPoolId}`);
  try {
    await cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      }),
    );
  } catch (error) {
    if (error instanceof Error) {
      logger.error(JSON.stringify(error, Object.getOwnPropertyNames(error)));
      throw new InternalFailureError({ message: 'Unable to delete user. Please try again.' });
    }
  }
}

export const CreateProfileOperation: Operation<
  CreateProfileServerInput,
  CreateProfileServerOutput,
  HandlerContext
> = async (input) => {
  const { emailAddress } = input;

  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) {
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }

  if (!EMAIL_REGEX.test(emailAddress)) {
    throw new BadRequestError({ message: 'Invalid email address format.' });
  }

  // Check if user already exists
  const userExists = await CheckUserExists(userPoolId, emailAddress);
  if (userExists) {
    throw new BadRequestError({ message: 'A user with this email address already exists.' });
  }

  const username = generateResourceId();

  await CreateUser(userPoolId, username, emailAddress);

  await AddUserToGroup(userPoolId, username);

  return {
    message: 'Profile created successfully. Check your email for login instructions.',
  };
};

export const lambdaHandler = getApiGatewayHandler(getCreateProfileHandler(instrumentOperation(CreateProfileOperation)));
