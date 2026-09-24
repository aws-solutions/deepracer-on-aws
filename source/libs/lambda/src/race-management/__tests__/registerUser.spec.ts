// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { BadRequestError, ConflictError, InternalFailureError } from '@deepracer-indy/typescript-server-client';
import { mockClient } from 'aws-sdk-client-mock';

import { TEST_OPERATION_CONTEXT } from '../../api/constants/testConstants.js';
import { UserGroups } from '../../cognito/handlers/common/constants.js';
import { RegisterUserOperation } from '../registerUser.js';

describe('RegisterUser', () => {
  const cognitoMock = mockClient(CognitoIdentityProviderClient);

  beforeEach(() => {
    cognitoMock.reset();
    process.env.USER_POOL_ID = 'us-east-1_testpool';
  });

  afterEach(() => {
    delete process.env.USER_POOL_ID;
  });

  it('registers a walk-up racer and assigns the racer group', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

    const result = await RegisterUserOperation({ emailAddress: 'racer@example.com' }, TEST_OPERATION_CONTEXT);
    // id is the sole return value per API design guide
    expect(result.id).toMatch(/^[A-Za-z0-9]+$/);

    const createUserCalls = cognitoMock.commandCalls(AdminCreateUserCommand);
    expect(createUserCalls).toHaveLength(1);
    expect(createUserCalls[0].args[0].input.Username).toMatch(/^[A-Za-z0-9]+$/);
    expect(createUserCalls[0].args[0].input.DesiredDeliveryMediums).toEqual(['EMAIL']);

    const addToGroupCalls = cognitoMock.commandCalls(AdminAddUserToGroupCommand);
    expect(addToGroupCalls).toHaveLength(1);
    expect(addToGroupCalls[0].args[0].input.GroupName).toBe(UserGroups.RACERS);

    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)).toHaveLength(0);
  });

  it('passes custom:countryCode to AdminCreateUser when a country code is provided', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

    await RegisterUserOperation({ emailAddress: 'racer@example.com', countryCode: 'gb' }, TEST_OPERATION_CONTEXT);

    const attrs = cognitoMock.commandCalls(AdminCreateUserCommand)[0].args[0].input.UserAttributes ?? [];
    const country = attrs.find((a) => a.Name === 'custom:countryCode');
    expect(country?.Value).toBe('GB'); // uppercased
  });

  it('omits custom:countryCode when no country code is provided', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

    await RegisterUserOperation({ emailAddress: 'racer@example.com' }, TEST_OPERATION_CONTEXT);

    const attrs = cognitoMock.commandCalls(AdminCreateUserCommand)[0].args[0].input.UserAttributes ?? [];
    expect(attrs.find((a) => a.Name === 'custom:countryCode')).toBeUndefined();
  });

  it('throws BadRequestError for an invalid country code', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });

    await expect(
      RegisterUserOperation({ emailAddress: 'racer@example.com', countryCode: 'USA' }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow('Country code must be 2 letters (e.g. US, GB).');
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
  });

  it('always assigns only the racer group (escalation prevention — verified at input model and call site)', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

    // The RegisterUserServerInput type has no group field — verified at compile time.
    // The handler hardcodes REGISTERED_GROUP from a server-side constant and never
    // reads from caller input, so this test verifies the invariant at the call site.
    await RegisterUserOperation({ emailAddress: 'racer@example.com' }, TEST_OPERATION_CONTEXT);

    const addToGroupCalls = cognitoMock.commandCalls(AdminAddUserToGroupCommand);
    expect(addToGroupCalls).toHaveLength(1);
    // The only group ever assigned is RACERS, regardless of what the caller sends.
    expect(addToGroupCalls[0].args[0].input.GroupName).toBe(UserGroups.RACERS);
  });

  it('throws ConflictError when a user with the email already exists', async () => {
    cognitoMock.on(ListUsersCommand).resolves({
      Users: [{ Username: 'existing-user', Attributes: [{ Name: 'email', Value: 'racer@example.com' }] }],
    });

    await expect(
      RegisterUserOperation({ emailAddress: 'racer@example.com' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new ConflictError({ message: 'A user with this email address already exists.' }));

    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
  });

  it('throws BadRequestError for an invalid email', async () => {
    await expect(RegisterUserOperation({ emailAddress: 'not-an-email' }, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new BadRequestError({ message: 'Invalid email address format.' }),
    );

    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
  });

  it('throws InternalFailureError when USER_POOL_ID is missing', async () => {
    delete process.env.USER_POOL_ID;

    await expect(
      RegisterUserOperation({ emailAddress: 'racer@example.com' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Service configuration error.' }));
  });

  it('rolls back the created user when group assignment fails', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).rejects(new Error('Group not found'));
    cognitoMock.on(AdminDeleteUserCommand).resolves({});

    await expect(
      RegisterUserOperation({ emailAddress: 'racer@example.com' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Unable to register racer. Please try again.' }));

    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)).toHaveLength(1);
  });

  it('throws InternalFailureError when the existence check fails', async () => {
    cognitoMock.on(ListUsersCommand).rejects(new Error('Cognito unavailable'));

    await expect(
      RegisterUserOperation({ emailAddress: 'racer@example.com' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Unable to verify user. Please try again.' }));

    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
  });

  it('throws InternalFailureError when user creation fails', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).rejects(new Error('Cognito create failed'));

    await expect(
      RegisterUserOperation({ emailAddress: 'racer@example.com' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Unable to register racer. Please try again.' }));

    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)).toHaveLength(0);
  });

  it('surfaces a failure even when rollback deletion also fails', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });
    cognitoMock.on(AdminCreateUserCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).rejects(new Error('Group add failed'));
    cognitoMock.on(AdminDeleteUserCommand).rejects(new Error('Delete failed'));

    await expect(
      RegisterUserOperation({ emailAddress: 'racer@example.com' }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new InternalFailureError({ message: 'Unable to register racer. Please try again.' }));

    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)).toHaveLength(1);
  });
});
