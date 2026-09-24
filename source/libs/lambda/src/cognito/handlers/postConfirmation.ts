// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminAddUserToGroupCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
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
  } catch (error) {
    console.log(error);
    throw new Error('Failed to add user to group');
  }

  // Persist countryCode from sign-up attributes so self-registered and
  // walk-up accounts produce identical profile records.
  const countryCode = event.request.userAttributes['custom:countryCode'];
  if (countryCode) {
    try {
      await cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: event.userPoolId,
          Username: event.userName,
          UserAttributes: [{ Name: 'custom:countryCode', Value: countryCode }],
        }),
      );
    } catch (error) {
      console.log(error);
      throw new Error('Failed to update custom:countryCode attribute');
    }
  }

  console.log('Success');

  return event;
};

export const lambdaHandler = instrumentHandler(PostConfirmation);
