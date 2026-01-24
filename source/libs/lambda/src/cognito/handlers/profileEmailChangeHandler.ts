// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { profileDao } from '@deepracer-indy/database';
import { InternalFailureError } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { EventBridgeEvent } from 'aws-lambda';

import { CloudTrailEvent, CognitoEmailUpdateEventDetail } from './common/types';
import { cognitoClient } from '../../utils/clients/cognitoClient.js';
import { cognitoHelper } from '../../utils/CognitoHelper.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

export const ProfileEmailChangeHandler = async (
  event: EventBridgeEvent<typeof CloudTrailEvent, CognitoEmailUpdateEventDetail>,
) => {
  logger.info('ProfileEmailChangeHandler lambda start', { input: event });
  const [userPoolId, sub] = parseCognitoEmailUpdateEvent(event);
  const profileId = await cognitoHelper.getUsernameFromSub(userPoolId, sub);

  try {
    const res = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: profileId,
      }),
    );

    const emailAttribute = res.UserAttributes?.find((attr) => attr.Name === 'email');
    const currentEmailAddress = emailAttribute?.Value;

    if (!currentEmailAddress) {
      logger.warn('No email address found in Cognito user attributes');
      return;
    }

    await profileDao.update({ profileId }, { emailAddress: currentEmailAddress });
    logger.info('Profile email updated successfully');
  } catch (err) {
    logger.error('Failed to update profile with new email address');
    throw new InternalFailureError({ message: 'Failed to update profile with new email address' });
  }
};

/**
 * Parses the Cognito email update event to extract the userPoolId, sub, and username values.
 * @param event - the EventBridge event containing the Cognito email update event details.
 * @returns - a tuple containing [userPoolId, sub, username].
 */
const parseCognitoEmailUpdateEvent = (
  event: EventBridgeEvent<typeof CloudTrailEvent, CognitoEmailUpdateEventDetail>,
) => {
  const userPoolId = event.detail.requestParameters.userPoolId;
  const sub = event.detail.additionalEventData.sub;

  return [userPoolId, sub] as const;
};

export const lambdaHandler = instrumentHandler(ProfileEmailChangeHandler);
