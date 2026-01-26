// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { PostConfirmationTriggerHandler } from 'aws-lambda';

import { UserGroups } from './common/constants';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

export const PostConfirmation: PostConfirmationTriggerHandler = async (event) => {
  const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
  });

  try {
    await cognitoClient.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: event.userPoolId,
        Username: event.userName,
        GroupName: UserGroups.RACERS, // Default group for new users
      }),
    );
    console.log('Success');
  } catch (error) {
    console.log(error);
    throw new Error('Failed to add user to group');
  }

  return event;
};

export const lambdaHandler = instrumentHandler(PostConfirmation);
