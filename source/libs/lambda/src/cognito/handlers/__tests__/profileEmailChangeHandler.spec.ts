// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { profileDao } from '@deepracer-indy/database';
import { InternalFailureError } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { EventBridgeEvent } from 'aws-lambda';
import { describe, expect, it, vi, beforeEach, Mock } from 'vitest';

import { cognitoClient } from '../../../utils/clients/cognitoClient.js';
import { cognitoHelper } from '../../../utils/CognitoHelper.js';
import { CloudTrailEvent, CognitoEmailUpdateEventDetail } from '../common/types';
import { ProfileEmailChangeHandler } from '../profileEmailChangeHandler';

vi.mock('@deepracer-indy/database', () => ({
  profileDao: {
    update: vi.fn(),
  },
}));

vi.mock('@deepracer-indy/utils', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('#utils/CognitoHelper.js', () => ({
  cognitoHelper: {
    getUsernameFromSub: vi.fn(),
  },
}));

vi.mock('#utils/clients/cognitoClient.js', () => ({
  cognitoClient: {
    send: vi.fn(),
  },
}));

vi.mock('#utils/instrumentation/instrumentHandler.js', () => ({
  instrumentHandler: vi.fn((handler) => handler),
}));

describe('profileEmailChangeHandler', () => {
  // Create mock event data for email update
  const mockEmailUpdateEvent: EventBridgeEvent<typeof CloudTrailEvent, CognitoEmailUpdateEventDetail> = {
    id: '12345',
    version: '0',
    account: '123456789012',
    time: '2025-09-02T12:00:00Z',
    region: 'us-east-1',
    resources: [],
    source: 'aws.cognito-idp',
    'detail-type': 'AWS API Call via CloudTrail',
    detail: {
      version: '1.08',
      userIdentity: {
        type: 'IAMUser',
        principalId: 'AIDAEXAMPLE',
        arn: 'arn:aws:iam::123456789012:user/admin',
        accountId: '123456789012',
        accessKeyId: 'AKIAEXAMPLE',
      },
      eventTime: '2025-09-02T12:00:00Z',
      eventSource: 'cognito-idp.amazonaws.com',
      eventName: 'AdminUpdateUserAttributes',
      awsRegion: 'us-east-1',
      sourceIPAddress: '192.168.1.1',
      userAgent: 'aws-sdk-js/3.0.0',
      requestParameters: {
        userPoolId: 'us-east-1_abcdefghi',
        username: 'test-user',
        userAttributes: [
          {
            name: 'email',
            value: 'newemail@example.com',
          },
          {
            name: 'email_verified',
            value: 'true',
          },
        ],
      },
      responseElements: null,
      requestID: 'request-id-123',
      eventID: 'event-id-123',
      readOnly: false,
      eventType: 'AwsApiCall',
      managementEvent: true,
      recipientAccountId: '123456789012',
      eventCategory: 'Management',
      additionalEventData: {
        sub: 'user-sub-123',
      },
    },
  };

  const mockProfileId = 'profile-123';
  const mockCognitoUserResponse = {
    UserAttributes: [
      { Name: 'email', Value: 'current@example.com' },
      { Name: 'email_verified', Value: 'true' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (cognitoHelper.getUsernameFromSub as Mock).mockResolvedValue(mockProfileId);
    (profileDao.update as Mock).mockResolvedValue({});
    (cognitoClient.send as Mock).mockResolvedValue(mockCognitoUserResponse);
  });

  describe('ProfileEmailChangeHandler', () => {
    it('should log the start of the handler with input event', async () => {
      await ProfileEmailChangeHandler(mockEmailUpdateEvent);
      expect(logger.info).toHaveBeenCalledWith('ProfileEmailChangeHandler lambda start', {
        input: mockEmailUpdateEvent,
      });
    });

    it('should extract userPoolId, emailAddress, and sub from the event', async () => {
      await ProfileEmailChangeHandler(mockEmailUpdateEvent);
      expect(cognitoHelper.getUsernameFromSub).toHaveBeenCalledWith(
        mockEmailUpdateEvent.detail.requestParameters.userPoolId,
        mockEmailUpdateEvent.detail.additionalEventData.sub,
      );
    });

    it('should get the username from the sub using cognitoHelper', async () => {
      await ProfileEmailChangeHandler(mockEmailUpdateEvent);
      expect(cognitoHelper.getUsernameFromSub).toHaveBeenCalledWith('us-east-1_abcdefghi', 'user-sub-123');
    });

    it('should fetch current email from Cognito API and update the profile', async () => {
      await ProfileEmailChangeHandler(mockEmailUpdateEvent);
      expect(cognitoClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            UserPoolId: 'us-east-1_abcdefghi',
            Username: mockProfileId,
          },
        }),
      );
      expect(profileDao.update).toHaveBeenCalledWith(
        { profileId: mockProfileId },
        { emailAddress: 'current@example.com' },
      );
    });

    it('should log successful email update', async () => {
      await ProfileEmailChangeHandler(mockEmailUpdateEvent);
      expect(logger.info).toHaveBeenCalledWith('Profile email updated successfully');
    });

    it('should throw InternalFailureError when profileDao.update fails', async () => {
      const mockError = new Error('Database error');
      (profileDao.update as Mock).mockRejectedValue(mockError);

      await expect(ProfileEmailChangeHandler(mockEmailUpdateEvent)).rejects.toThrow(InternalFailureError);
      await expect(ProfileEmailChangeHandler(mockEmailUpdateEvent)).rejects.toThrow(
        'Failed to update profile with new email address',
      );

      expect(logger.error).toHaveBeenCalledWith('Failed to update profile with new email address');
    });

    it('should process event regardless of userAttributes in event', async () => {
      const eventWithoutEmail = {
        ...mockEmailUpdateEvent,
        detail: {
          ...mockEmailUpdateEvent.detail,
          requestParameters: {
            ...mockEmailUpdateEvent.detail.requestParameters,
            userAttributes: [
              {
                name: 'given_name',
                value: 'John',
              },
            ],
          },
        },
      };

      await ProfileEmailChangeHandler(eventWithoutEmail);

      expect(logger.info).toHaveBeenCalledWith('ProfileEmailChangeHandler lambda start', {
        input: eventWithoutEmail,
      });
      expect(cognitoHelper.getUsernameFromSub).toHaveBeenCalled();
      expect(cognitoClient.send).toHaveBeenCalled();
      expect(profileDao.update).toHaveBeenCalledWith(
        { profileId: mockProfileId },
        { emailAddress: 'current@example.com' },
      );
    });
  });

  describe('Cognito API integration', () => {
    it('should fetch email from Cognito API and use that for the update', async () => {
      await ProfileEmailChangeHandler(mockEmailUpdateEvent);

      expect(cognitoHelper.getUsernameFromSub).toHaveBeenCalledWith('us-east-1_abcdefghi', 'user-sub-123');
      expect(cognitoClient.send).toHaveBeenCalled();
      expect(profileDao.update).toHaveBeenCalledWith(
        { profileId: mockProfileId },
        { emailAddress: 'current@example.com' },
      );
    });

    it('should handle case when Cognito API returns no email attribute', async () => {
      const responseWithoutEmail = {
        UserAttributes: [
          { Name: 'given_name', Value: 'John' },
          { Name: 'family_name', Value: 'Doe' },
        ],
      };
      (cognitoClient.send as Mock).mockResolvedValue(responseWithoutEmail);

      await ProfileEmailChangeHandler(mockEmailUpdateEvent);

      expect(logger.warn).toHaveBeenCalledWith('No email address found in Cognito user attributes');
      expect(profileDao.update).not.toHaveBeenCalled();
    });

    it('should handle case when Cognito API returns empty UserAttributes', async () => {
      const responseWithEmptyAttributes = {
        UserAttributes: [],
      };
      (cognitoClient.send as Mock).mockResolvedValue(responseWithEmptyAttributes);

      await ProfileEmailChangeHandler(mockEmailUpdateEvent);

      expect(logger.warn).toHaveBeenCalledWith('No email address found in Cognito user attributes');
      expect(profileDao.update).not.toHaveBeenCalled();
    });

    it('should handle multiple attributes and find the email attribute', async () => {
      const eventWithMultipleAttributes = {
        ...mockEmailUpdateEvent,
        detail: {
          ...mockEmailUpdateEvent.detail,
          requestParameters: {
            ...mockEmailUpdateEvent.detail.requestParameters,
            userAttributes: [
              {
                name: 'given_name',
                value: 'John',
              },
              {
                name: 'email',
                value: 'updated@example.com',
              },
              {
                name: 'family_name',
                value: 'Doe',
              },
            ],
          },
        },
      };

      await ProfileEmailChangeHandler(eventWithMultipleAttributes);
      expect(profileDao.update).toHaveBeenCalledWith(
        { profileId: mockProfileId },
        { emailAddress: 'current@example.com' },
      );
    });
  });

  describe('edge cases', () => {
    it('should handle events with missing additionalEventData', async () => {
      const incompleteEvent = {
        ...mockEmailUpdateEvent,
        detail: {
          ...mockEmailUpdateEvent.detail,
          additionalEventData: undefined,
        },
      } as unknown as EventBridgeEvent<typeof CloudTrailEvent, CognitoEmailUpdateEventDetail>;

      await expect(ProfileEmailChangeHandler(incompleteEvent)).rejects.toThrow();
    });

    it('should handle events with missing requestParameters', async () => {
      const incompleteEvent = {
        ...mockEmailUpdateEvent,
        detail: {
          ...mockEmailUpdateEvent.detail,
          requestParameters: undefined,
        },
      } as unknown as EventBridgeEvent<typeof CloudTrailEvent, CognitoEmailUpdateEventDetail>;

      await expect(ProfileEmailChangeHandler(incompleteEvent)).rejects.toThrow();
    });

    it('should handle events with empty userAttributes array', async () => {
      const eventWithEmptyAttributes = {
        ...mockEmailUpdateEvent,
        detail: {
          ...mockEmailUpdateEvent.detail,
          requestParameters: {
            ...mockEmailUpdateEvent.detail.requestParameters,
            userAttributes: [],
          },
        },
      };

      await ProfileEmailChangeHandler(eventWithEmptyAttributes);
      expect(logger.info).toHaveBeenCalledWith('ProfileEmailChangeHandler lambda start', {
        input: eventWithEmptyAttributes,
      });
      expect(cognitoHelper.getUsernameFromSub).toHaveBeenCalled();
      expect(profileDao.update).toHaveBeenCalled();
    });

    it('should handle events where email attribute has empty value', async () => {
      const eventWithEmptyEmail = {
        ...mockEmailUpdateEvent,
        detail: {
          ...mockEmailUpdateEvent.detail,
          requestParameters: {
            ...mockEmailUpdateEvent.detail.requestParameters,
            userAttributes: [
              {
                name: 'email',
                value: '',
              },
            ],
          },
        },
      };

      await ProfileEmailChangeHandler(eventWithEmptyEmail);
      expect(logger.info).toHaveBeenCalledWith('ProfileEmailChangeHandler lambda start', {
        input: eventWithEmptyEmail,
      });
      expect(cognitoHelper.getUsernameFromSub).toHaveBeenCalled();
      expect(profileDao.update).toHaveBeenCalled();
    });
  });
});
