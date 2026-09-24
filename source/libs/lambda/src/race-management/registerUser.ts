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
  ConflictError,
  getRegisterUserHandler,
  InternalFailureError,
  RegisterUserServerInput,
  RegisterUserServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { HandlerContext } from '../api/types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../api/utils/apiGateway.js';
import { instrumentOperation } from '../api/utils/instrumentation/instrumentOperation.js';
import { UserGroups } from '../cognito/handlers/common/constants.js';
import { cognitoClient } from '../utils/clients/cognitoClient.js';

// The group assigned to walk-up racers is fixed here and is never taken from
// caller input, so the endpoint cannot be used to grant elevated access.
const REGISTERED_GROUP = UserGroups.RACERS;

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const userExists = async (userPoolId: string, emailAddress: string): Promise<boolean> => {
  try {
    const response = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Filter: `email = "${emailAddress}"`,
      }),
    );
    return (response.Users?.length ?? 0) > 0;
  } catch (error) {
    logger.error('Failed to check user existence', { error: JSON.stringify(error, Object.getOwnPropertyNames(error)) });
    throw new InternalFailureError({ message: 'Unable to verify user. Please try again.' });
  }
};

const createUser = async (
  userPoolId: string,
  username: string,
  emailAddress: string,
  countryCode?: string,
): Promise<void> => {
  try {
    await cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: username,
        DesiredDeliveryMediums: ['EMAIL'],
        UserAttributes: [
          { Name: 'email', Value: emailAddress },
          { Name: 'email_verified', Value: 'true' },
          // Optional racer country — persisted to the profile by the PreSignUp trigger
          // (AdminCreateUser fires PreSignUp), so it surfaces on leaderboards like self-signups.
          ...(countryCode ? [{ Name: 'custom:countryCode', Value: countryCode.toUpperCase() }] : []),
        ],
      }),
    );
  } catch (error) {
    logger.error('Failed to create Cognito user', { error: JSON.stringify(error, Object.getOwnPropertyNames(error)) });
    throw new InternalFailureError({ message: 'Unable to register racer. Please try again.' });
  }
};

const deleteUser = async (userPoolId: string, username: string): Promise<void> => {
  try {
    await cognitoClient.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username }));
  } catch (error) {
    // Best-effort rollback — log but do not rethrow
    logger.error('Failed to delete user during rollback', {
      username,
      error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
  }
};

const assignRacerGroup = async (userPoolId: string, username: string): Promise<void> => {
  try {
    await cognitoClient.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: username,
        GroupName: REGISTERED_GROUP,
      }),
    );
  } catch (error) {
    logger.error('Failed to assign racer group; rolling back user creation', {
      username,
      error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    await deleteUser(userPoolId, username);
    throw new InternalFailureError({ message: 'Unable to register racer. Please try again.' });
  }
};

export const RegisterUserOperation: Operation<
  RegisterUserServerInput,
  RegisterUserServerOutput,
  HandlerContext
> = async (input) => {
  const { emailAddress, countryCode } = input;

  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) {
    logger.error('USER_POOL_ID environment variable is not configured');
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }

  if (!EMAIL_REGEX.test(emailAddress)) {
    throw new BadRequestError({ message: 'Invalid email address format.' });
  }

  if (countryCode && !/^[A-Za-z]{2}$/.test(countryCode)) {
    throw new BadRequestError({ message: 'Country code must be 2 letters (e.g. US, GB).' });
  }

  if (await userExists(userPoolId, emailAddress)) {
    throw new ConflictError({ message: 'A user with this email address already exists.' });
  }

  const username = generateResourceId();
  await createUser(userPoolId, username, emailAddress, countryCode);
  await assignRacerGroup(userPoolId, username);

  return { id: username };
};

export const lambdaHandler = getApiGatewayHandler(getRegisterUserHandler(instrumentOperation(RegisterUserOperation)));
