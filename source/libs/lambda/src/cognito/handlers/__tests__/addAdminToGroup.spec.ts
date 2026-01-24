// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import type { CloudFormationCustomResourceCreateEvent, CloudFormationCustomResourceUpdateEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AddAdminToGroup } from '../addAdminToGroup';

interface CustomResourceProperties {
  ServiceToken: string;
  userPoolId: string;
  adminEmail: string;
}

describe('AddAdminToGroup Lambda', () => {
  const cognitoMock = mockClient(CognitoIdentityProviderClient);
  const testEvent: CloudFormationCustomResourceCreateEvent = {
    RequestType: 'Create',
    ServiceToken: 'token',
    ResponseURL: 'https://example.com',
    StackId: 'stack-id',
    RequestId: 'request-id',
    LogicalResourceId: 'resource-id',
    ResourceType: 'Custom::AddAdminToGroup',
    ResourceProperties: {
      ServiceToken: 'token',
      userPoolId: 'us-east-1_123456789',
      adminEmail: 'admin@example.com',
    } as CustomResourceProperties,
  };

  beforeEach(() => {
    cognitoMock.reset();
    // Mock Date.now() to return a consistent value for testing
    // Mock Date.now() to return a value that will convert to 'kwo' in base36
    vi.spyOn(Date, 'now').mockReturnValue(1234);
  });

  describe('when handling Create events', () => {
    describe('when user exists', () => {
      it('adds user to admin group successfully', async () => {
        cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

        const result = await AddAdminToGroup(testEvent);

        // Verify Cognito API call
        expect(cognitoMock.calls()).toHaveLength(1);
        const call = cognitoMock.calls()[0];
        expect(call.args[0].input).toEqual({
          UserPoolId: 'us-east-1_123456789',
          Username: 'admin@example.com',
          GroupName: 'dr-admins',
        });

        // Verify the Lambda response
        expect(result).toEqual({
          Status: 'SUCCESS',
          RequestId: 'request-id',
          LogicalResourceId: 'resource-id',
          StackId: 'stack-id',
          PhysicalResourceId: 'admin-group-membership',
          Data: {
            Message: 'Successfully added user to admin group',
          },
        });
      });

      it('throws error if adding to group fails with non-UserNotFound error', async () => {
        cognitoMock.on(AdminAddUserToGroupCommand).rejects(new Error('Cognito error'));

        await expect(AddAdminToGroup(testEvent)).rejects.toThrow('Failed to add admin to group');
      });
    });

    describe('when user does not exist', () => {
      it('creates user and adds to admin group', async () => {
        // First attempt to add to group fails with UserNotFound
        cognitoMock
          .on(AdminAddUserToGroupCommand)
          .rejectsOnce(new UserNotFoundException({ message: 'User does not exist', $metadata: {} }))
          .resolves({});

        // User creation succeeds
        cognitoMock.on(AdminCreateUserCommand).resolves({});

        const result = await AddAdminToGroup(testEvent);

        // Verify sequence of Cognito API calls
        expect(cognitoMock.calls()).toHaveLength(3);

        // First call - failed attempt to add to group
        expect(cognitoMock.calls()[0].args[0].input).toEqual({
          UserPoolId: 'us-east-1_123456789',
          Username: 'admin@example.com',
          GroupName: 'dr-admins',
        });

        // Second call - create user with generated username and suppressed email
        expect(cognitoMock.calls()[1].args[0].input).toEqual({
          UserPoolId: 'us-east-1_123456789',
          Username: 'admin4d2',
          MessageAction: 'SUPPRESS',
          DesiredDeliveryMediums: ['EMAIL'],
          UserAttributes: [
            {
              Name: 'email',
              Value: 'admin@example.com',
            },
            {
              Name: 'email_verified',
              Value: 'true',
            },
          ],
        });

        // Third call - successful add to group with generated username
        expect(cognitoMock.calls()[2].args[0].input).toEqual({
          UserPoolId: 'us-east-1_123456789',
          Username: 'admin4d2',
          GroupName: 'dr-admins',
        });

        // Verify the Lambda response
        expect(result).toEqual({
          Status: 'SUCCESS',
          RequestId: 'request-id',
          LogicalResourceId: 'resource-id',
          StackId: 'stack-id',
          PhysicalResourceId: 'admin-group-membership',
          Data: {
            Message: 'Successfully added user to admin group',
          },
        });
      });

      it('throws error if user creation fails', async () => {
        cognitoMock
          .on(AdminAddUserToGroupCommand)
          .rejects(new UserNotFoundException({ message: 'User does not exist', $metadata: {} }));
        cognitoMock.on(AdminCreateUserCommand).rejects(new Error('Failed to create user'));

        await expect(AddAdminToGroup(testEvent)).rejects.toThrow('Failed to add admin to group');
      });
    });
  });

  describe('when handling non-Create events', () => {
    it('returns success without making any Cognito calls', async () => {
      const updateEvent: CloudFormationCustomResourceUpdateEvent = {
        ...testEvent,
        RequestType: 'Update',
        PhysicalResourceId: 'admin-group-membership',
        OldResourceProperties: testEvent.ResourceProperties,
      };

      const result = await AddAdminToGroup(updateEvent);

      // Verify no Cognito API calls were made
      expect(cognitoMock.calls()).toHaveLength(0);

      // Verify the Lambda response
      expect(result).toEqual({
        Status: 'SUCCESS',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        StackId: 'stack-id',
        PhysicalResourceId: 'admin-group-membership',
      });
    });
  });
});
