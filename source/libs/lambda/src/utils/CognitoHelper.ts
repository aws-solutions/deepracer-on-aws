// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { ResourceId } from '@deepracer-indy/database';

import { cognitoClient } from './clients/cognitoClient';

class CognitoHelper {
  /**
   * Given a sub attribute, queries the Cognito user pool to return the corresponding username.
   * @param userPoolId - the Cognito user pool ID.
   * @param sub - the Cognito user's sub attribute.
   * @returns - the Cognito username.
   */
  async getUsernameFromSub(userPoolId: string, sub: string) {
    let username: ResourceId;
    const listUsersCommand = new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `sub = "${sub}"`,
    });

    try {
      const response = await cognitoClient.send(listUsersCommand);
      if (response.Users?.length === 1) {
        username = response.Users[0]?.Username as ResourceId;
      } else {
        throw new Error('Failed to get username');
      }
    } catch (error) {
      throw new Error('Failed to get username');
    }
    return username;
  }
}

export const cognitoHelper = new CognitoHelper();
