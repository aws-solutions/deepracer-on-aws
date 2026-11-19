// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AdminUpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider';
import type { PostConfirmationTriggerHandler } from 'aws-lambda';

import { ensureDefaultRacerGroupMembership } from './common/groupMembership.js';
import { cognitoClient } from '../../utils/clients/cognitoClient.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

export const PostConfirmation: PostConfirmationTriggerHandler = async (event) => {
  try {
    // Shared with PostAuthentication (which also needs this for federated sign-ins, which never
    // reach PostConfirmation) so the two triggers can't drift into inconsistent behavior — see
    // ensureDefaultRacerGroupMembership for the membership-check rationale.
    await ensureDefaultRacerGroupMembership(event.userPoolId, event.userName);
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
