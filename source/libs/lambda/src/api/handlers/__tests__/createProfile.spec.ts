// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { BadRequestError, InternalFailureError } from '@deepracer-indy/typescript-server-client';
import { mockClient } from 'aws-sdk-client-mock';

import { UserGroups } from '../../../cognito/handlers/common/constants.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { CreateProfileOperation } from '../createProfile.js';

describe('CreateProfile', () => {
  const cognitoMock = mockClient(CognitoIdentityProviderClient);

  beforeEach(() => {
    cognitoMock.reset();
    process.env.USER_POOL_ID = 'us-east-1_testpool';
  });

  afterEach(() => {
    delete process.env.USER_POOL_ID;
  });

  it('should create profile successfully', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

    await expect(CreateProfileOperation({ emailAddress: 'test@example.com' }, TEST_OPERATION_CONTEXT)).resolves.toEqual(
      { message: 'Profile created successfully. Check your email for login instructions.' },
    );

    const listUsersCalls = cognitoMock.commandCalls(ListUsersCommand);
    expect(listUsersCalls).toHaveLength(1);
    expect(listUsersCalls[0].args[0].input.Filter).toBe('email = "test@example.com"');

    const createUserCalls = cognitoMock.commandCalls(AdminCreateUserCommand);
    expect(createUserCalls).toHaveLength(1);
    expect(createUserCalls[0].args[0].input.Username).toMatch(/^[A-Za-z0-9]+$/);

    const addToGroupCalls = cognitoMock.commandCalls(AdminAddUserToGroupCommand);
    expect(addToGroupCalls).toHaveLength(1);
    expect(addToGroupCalls[0].args[0].input.GroupName).toBe(UserGroups.RACERS);

    const deleteUserCalls = cognitoMock.commandCalls(AdminDeleteUserCommand);
    expect(deleteUserCalls).toHaveLength(0);
  });

  it('should throw InternalFailureError if group addition fails', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    const groupError = new Error('Group not found');
    groupError.name = 'ResourceNotFoundException';
    cognitoMock.on(AdminAddUserToGroupCommand).rejects(groupError);
    cognitoMock.on(AdminDeleteUserCommand).resolves({});

    await expect(
      CreateProfileOperation({ emailAddress: 'test@example.com' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Unable to add user to Group. Please try again.' }));

    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)).toHaveLength(1);
  });

  it('should throw BadRequestError for invalid email', async () => {
    await expect(
      CreateProfileOperation({ emailAddress: 'invalid-email' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'Invalid email address format.' }));
  });

  it('should throw BadRequestError when user with email already exists', async () => {
    cognitoMock.on(ListUsersCommand).resolves({
      Users: [{ Username: 'existing-user', Attributes: [{ Name: 'email', Value: 'test@example.com' }] }],
    });

    await expect(
      CreateProfileOperation({ emailAddress: 'test@example.com' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new BadRequestError({ message: 'A user with this email address already exists.' }));

    // Should not attempt to create user if duplicate exists
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
  });

  it('should throw InternalFailureError when USER_POOL_ID is missing', async () => {
    delete process.env.USER_POOL_ID;

    await expect(
      CreateProfileOperation({ emailAddress: 'test@example.com' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Service configuration error.' }));
  });

  it('should throw InternalFailureError for user creation failure', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    const error = new Error('User already exists');
    error.name = 'UsernameExistsException';
    cognitoMock.on(AdminCreateUserCommand).rejects(error);

    await expect(
      CreateProfileOperation({ emailAddress: 'test@example.com' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Unable to create profile. Please try again.' }));
  });

  it('should throw InternalFailureError for other Cognito errors', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    const error = new Error('Access denied');
    error.name = 'AccessDeniedException';
    cognitoMock.on(AdminCreateUserCommand).rejects(error);

    await expect(
      CreateProfileOperation({ emailAddress: 'test@example.com' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Unable to create profile. Please try again.' }));
  });

  it('should throw InternalFailureError if delete user fails during cleanup', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    const groupError = new Error('Group not found');
    cognitoMock.on(AdminAddUserToGroupCommand).rejects(groupError);
    const deleteError = new Error('Delete failed');
    cognitoMock.on(AdminDeleteUserCommand).rejects(deleteError);

    await expect(
      CreateProfileOperation({ emailAddress: 'test@example.com' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Unable to delete user. Please try again.' }));
  });
});
