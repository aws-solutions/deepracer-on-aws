// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserStatusType } from '@aws-sdk/client-cognito-identity-provider';
import type { Operation } from '@aws-smithy/server-common';
import { profileDao, type ResourceId } from '@deepracer-indy/database';
import {
  ConflictError,
  getResendInviteHandler,
  InternalFailureError,
  NotAuthorizedError,
  NotFoundError,
  ResendInviteServerInput,
  ResendInviteServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { findCognitoUsernameByEmail, getCognitoUserState, resendRacerInvite } from '../utils/cognitoUserManagement.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/**
 * `POST /profiles/{profileId}/resendInvite` — re-send the Cognito invitation email (with a new
 * temporary password) to a user who has not yet accepted their original invitation. Admin-only
 * Non-idempotent — each call issues a fresh temporary password. Only users still in
 * FORCE_CHANGE_PASSWORD may be resent to; every other Cognito state is rejected with a mapped
 * message.
 */
export const ResendInviteOperation: Operation<
  ResendInviteServerInput,
  ResendInviteServerOutput,
  HandlerContext
> = async (input, context) => {
  const { profileId: callerProfileId } = context;
  if (!(await isUserAdmin(callerProfileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: callerProfileId });
    throw new NotAuthorizedError({ message: 'Only administrators can resend invitations.' });
  }

  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) {
    logger.error('Missing required environment variable', { variable: 'USER_POOL_ID' });
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }

  const { profileId } = input;

  // 1. Profile must exist in DynamoDB (load throws NotFoundError → 404).
  const profile = await profileDao.load({ profileId: profileId as ResourceId });
  if (!profile.emailAddress) {
    throw new NotFoundError({ message: 'User account not found. The user may have been deleted externally.' });
  }

  // 2. Locate the Cognito user by email.
  const username = await findCognitoUsernameByEmail(userPoolId, profile.emailAddress);
  if (!username) {
    throw new NotFoundError({ message: 'User account not found. The user may have been deleted externally.' });
  }

  // 3. Read the current Cognito status and map it to an outcome.
  const { status, enabled } = await getCognitoUserState(userPoolId, username);
  if (enabled === false) {
    throw new ConflictError({ message: 'This user account is disabled.' });
  }
  switch (status) {
    case UserStatusType.FORCE_CHANGE_PASSWORD:
      break; // happy path — proceed to resend
    case UserStatusType.CONFIRMED:
      throw new ConflictError({ message: 'This user has already accepted their invitation and set a password.' });
    case UserStatusType.EXTERNAL_PROVIDER:
      throw new ConflictError({
        message: 'This user authenticates via an external identity provider. Invitation resend is not applicable.',
      });
    default:
      throw new ConflictError({ message: 'Unable to resend invitation for this user.' });
  }

  // 4. Resend the invitation email (new temporary password).
  try {
    await resendRacerInvite(userPoolId, username);
  } catch (error) {
    logger.error('Failed to resend invitation', { action: 'RESEND_INVITE_FAILURE', error });
    throw new InternalFailureError({ message: 'Failed to resend invitation. Please try again.' });
  }

  return {
    message: 'Invitation resent. The user will receive a new invitation email.',
  } satisfies ResendInviteServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getResendInviteHandler(instrumentOperation(ResendInviteOperation)));
