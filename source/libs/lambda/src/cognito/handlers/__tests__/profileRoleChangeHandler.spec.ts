// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { profileDao } from '@deepracer-indy/database';
import { InternalFailureError } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { EventBridgeEvent } from 'aws-lambda';
import { describe, expect, it, vi, beforeEach, Mock } from 'vitest';

import { cognitoHelper } from '../../../utils/CognitoHelper.js';
import { CloudTrailEvent, CognitoEventDetail } from '../common/types';
import { ProfileRoleChangeHandler } from '../profileRoleChangeHandler';

vi.mock('@deepracer-indy/database', () => ({
  profileDao: {
    update: vi.fn(),
  },
}));

vi.mock('@deepracer-indy/utils', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('#utils/CognitoHelper.js', () => ({
  cognitoHelper: {
    getUsernameFromSub: vi.fn(),
  },
}));

vi.mock('#utils/instrumentation/instrumentHandler.js', () => ({
  instrumentHandler: vi.fn((handler) => handler),
}));

describe('profileRoleChangeHandler', () => {
  // Create mock event data
  const mockEvent: EventBridgeEvent<typeof CloudTrailEvent, CognitoEventDetail> = {
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
      eventName: 'AdminAddUserToGroup',
      awsRegion: 'us-east-1',
      sourceIPAddress: '192.168.1.1',
      userAgent: 'aws-sdk-js/3.0.0',
      requestParameters: {
        userPoolId: 'us-east-1_abcdefghi',
        username: 'test-user',
        groupName: 'dr-admins',
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

  beforeEach(() => {
    vi.clearAllMocks();
    (cognitoHelper.getUsernameFromSub as Mock).mockResolvedValue(mockProfileId);
    (profileDao.update as Mock).mockResolvedValue({});
  });

  describe('ProfileRoleChangeHandler', () => {
    it('should log the start of the handler with input event', async () => {
      await ProfileRoleChangeHandler(mockEvent);
      expect(logger.info).toHaveBeenCalledWith('ProfileRoleChangeHandler lambda start', { input: mockEvent });
    });

    it('should extract userPoolId, groupName, and sub from the event', async () => {
      await ProfileRoleChangeHandler(mockEvent);
      expect(cognitoHelper.getUsernameFromSub).toHaveBeenCalledWith(
        mockEvent.detail.requestParameters.userPoolId,
        mockEvent.detail.additionalEventData.sub,
      );
    });

    it('should get the username from the sub using cognitoHelper', async () => {
      await ProfileRoleChangeHandler(mockEvent);
      expect(cognitoHelper.getUsernameFromSub).toHaveBeenCalledWith('us-east-1_abcdefghi', 'user-sub-123');
    });

    it('should update the profile with the new role name', async () => {
      await ProfileRoleChangeHandler(mockEvent);
      expect(profileDao.update).toHaveBeenCalledWith(
        { profileId: mockProfileId },
        { roleName: mockEvent.detail.requestParameters.groupName },
      );
    });

    it('should throw InternalFailureError when profileDao.update fails', async () => {
      (profileDao.update as Mock).mockRejectedValue(new Error('Database error'));
      await expect(ProfileRoleChangeHandler(mockEvent)).rejects.toThrow(InternalFailureError);
      await expect(ProfileRoleChangeHandler(mockEvent)).rejects.toThrow('Failed to update profile with current role');
    });
  });

  describe('parseCognitoEvent', () => {
    it('should correctly extract userPoolId, groupName, and sub from the event', async () => {
      await ProfileRoleChangeHandler(mockEvent);

      expect(cognitoHelper.getUsernameFromSub).toHaveBeenCalledWith('us-east-1_abcdefghi', 'user-sub-123');
      expect(profileDao.update).toHaveBeenCalledWith({ profileId: mockProfileId }, { roleName: 'dr-admins' });
    });
  });

  describe('edge cases', () => {
    it('should handle events with missing additionalEventData', async () => {
      const incompleteEvent = {
        ...mockEvent,
        detail: {
          ...mockEvent.detail,
          additionalEventData: undefined,
        },
      } as unknown as EventBridgeEvent<typeof CloudTrailEvent, CognitoEventDetail>;
      await expect(ProfileRoleChangeHandler(incompleteEvent)).rejects.toThrow();
    });

    it('should handle events with missing requestParameters', async () => {
      const incompleteEvent = {
        ...mockEvent,
        detail: {
          ...mockEvent.detail,
          requestParameters: undefined,
        },
      } as unknown as EventBridgeEvent<typeof CloudTrailEvent, CognitoEventDetail>;
      await expect(ProfileRoleChangeHandler(incompleteEvent)).rejects.toThrow();
    });
  });
});
