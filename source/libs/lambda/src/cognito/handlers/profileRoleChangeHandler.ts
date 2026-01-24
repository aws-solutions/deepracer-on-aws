// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { profileDao } from '@deepracer-indy/database';
import { InternalFailureError } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { EventBridgeEvent } from 'aws-lambda';

import { CloudTrailEvent, CognitoEventDetail } from './common/types';
import { cognitoHelper } from '../../utils/CognitoHelper.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

export const ProfileRoleChangeHandler = async (event: EventBridgeEvent<typeof CloudTrailEvent, CognitoEventDetail>) => {
  logger.info('ProfileRoleChangeHandler lambda start', { input: event });

  const [userPoolId, groupName, sub] = parseCognitoEvent(event);

  const profileId = await cognitoHelper.getUsernameFromSub(userPoolId, sub);

  try {
    await profileDao.update({ profileId }, { roleName: groupName });
  } catch (err) {
    throw new InternalFailureError({ message: 'Failed to update profile with current role' });
  }
};

/**
 * Parses the Cognito event to extract the userPoolId, groupName, and sub values.
 * @param event - the EventBridge event containing the Cognito event details.
 * @returns - a tuple containing [userPoolId, groupName, sub].
 */
const parseCognitoEvent = (event: EventBridgeEvent<typeof CloudTrailEvent, CognitoEventDetail>) => {
  const userPoolId = event.detail.requestParameters.userPoolId;
  const groupName = event.detail.requestParameters.groupName;
  const sub = event.detail.additionalEventData.sub;
  return [userPoolId, groupName, sub];
};

export const lambdaHandler = instrumentHandler(ProfileRoleChangeHandler);
