// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface BaseCognitoEventDetail {
  version: string;
  userIdentity: {
    type: string;
    principalId: string;
    arn: string;
    accountId: string;
    accessKeyId: string;
    sessionContext?: {
      attributes: {
        creationDate: string;
        mfaAuthenticated: string;
      };
    };
  };
  eventTime: string;
  eventSource: 'cognito-idp.amazonaws.com';
  awsRegion: string;
  sourceIPAddress: string;
  userAgent: string;
  additionalEventData: {
    sub: string;
  };
  responseElements: null;
  requestID: string;
  eventID: string;
  readOnly: boolean;
  eventType: 'AwsApiCall';
  managementEvent: boolean;
  recipientAccountId: string;
  eventCategory: 'Management';
}

export interface CognitoEventDetail extends BaseCognitoEventDetail {
  eventName: 'AdminAddUserToGroup' | 'AdminRemoveUserFromGroup';
  requestParameters: {
    username: string;
    groupName: string;
    userPoolId: string;
  };
}

export interface CognitoEmailUpdateEventDetail extends BaseCognitoEventDetail {
  eventName: 'AdminUpdateUserAttributes';
  requestParameters: {
    username: string;
    userPoolId: string;
    userAttributes: Array<{
      name: string;
      value: string;
    }>;
  };
}

export const CloudTrailEvent = 'AWS API Call via CloudTrail';
