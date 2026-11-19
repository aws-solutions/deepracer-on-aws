// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach } from 'vitest';

import { ensureDefaultRacerGroupMembership } from '../groupMembership';

describe('ensureDefaultRacerGroupMembership', () => {
  const cognitoMock = mockClient(CognitoIdentityProviderClient);

  beforeEach(() => {
    cognitoMock.reset();
  });

  it('adds a user with no dr-* group membership to the racers group', async () => {
    cognitoMock.on(AdminListGroupsForUserCommand).resolves({ Groups: [] });
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

    await ensureDefaultRacerGroupMembership('us-east-1_123456789', 'testuser');

    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)[0].args[0].input).toEqual({
      UserPoolId: 'us-east-1_123456789',
      Username: 'testuser',
      GroupName: 'dr-racers',
    });
  });

  it('does not re-add a user already in any dr-* group (e.g. an admin moved out of dr-racers)', async () => {
    cognitoMock.on(AdminListGroupsForUserCommand).resolves({ Groups: [{ GroupName: 'dr-admins' }] });

    await ensureDefaultRacerGroupMembership('us-east-1_123456789', 'testuser');

    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)).toHaveLength(0);
  });

  it('propagates failures to the caller', async () => {
    cognitoMock.on(AdminListGroupsForUserCommand).rejects(new Error('ThrottlingException'));

    await expect(ensureDefaultRacerGroupMembership('us-east-1_123456789', 'testuser')).rejects.toThrow(
      'ThrottlingException',
    );
  });
});
