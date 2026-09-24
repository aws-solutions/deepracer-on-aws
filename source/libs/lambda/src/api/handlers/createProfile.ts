// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import {
  BadRequestError,
  CreateProfileServerInput,
  CreateProfileServerOutput,
  getCreateProfileHandler,
  InternalFailureError,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import {
  addUserToRacerGroup,
  createRacerCognitoUser,
  deleteCognitoUser,
  userExistsByEmail,
} from '../utils/cognitoUserManagement.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const logError = (error: unknown): void => {
  if (error instanceof Error) {
    logger.error(JSON.stringify(error, Object.getOwnPropertyNames(error)));
  }
};

export const CreateProfileOperation: Operation<
  CreateProfileServerInput,
  CreateProfileServerOutput,
  HandlerContext
> = async (input, context) => {
  const { emailAddress } = input;

  if (!(await isUserAdmin(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Only administrators can create profiles.' });
  }

  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) {
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }

  if (!EMAIL_REGEX.test(emailAddress)) {
    throw new BadRequestError({ message: 'Invalid email address format.' });
  }

  let userExists: boolean;
  try {
    userExists = await userExistsByEmail(userPoolId, emailAddress);
  } catch (error) {
    logError(error);
    throw new InternalFailureError({ message: 'Unable to verify user. Please try again.' });
  }
  if (userExists) {
    throw new BadRequestError({ message: 'A user with this email address already exists.' });
  }

  let username: string;
  try {
    username = await createRacerCognitoUser(userPoolId, emailAddress);
  } catch (error) {
    logError(error);
    throw new InternalFailureError({ message: 'Unable to create profile. Please try again.' });
  }

  try {
    await addUserToRacerGroup(userPoolId, username);
  } catch (error) {
    logError(error);
    // Roll back the just-created user so a failed group assignment does not leave an orphan.
    try {
      await deleteCognitoUser(userPoolId, username);
    } catch (deleteError) {
      logError(deleteError);
      throw new InternalFailureError({ message: 'Unable to delete user. Please try again.' });
    }
    throw new InternalFailureError({ message: 'Unable to add user to Group. Please try again.' });
  }

  return {
    message: 'Profile created successfully. Check your email for login instructions.',
  };
};

export const lambdaHandler = getApiGatewayHandler(getCreateProfileHandler(instrumentOperation(CreateProfileOperation)));
