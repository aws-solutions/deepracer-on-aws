// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { logger } from '@deepracer-indy/utils';
import type { PostAuthenticationTriggerEvent, Context, Callback } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PostAuthentication } from '../postAuthentication';

describe('PostAuthentication lambda', () => {
  const cognitoMock = mockClient(CognitoIdentityProviderClient);
  const context = {} as Context;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const callback = (() => {}) as Callback<unknown>;

  const baseEvent: PostAuthenticationTriggerEvent = {
    version: '1',
    region: 'us-east-1',
    userPoolId: 'us-east-1_123456789',
    userName: 'sso_01a2b3c4-d5e6-f7g8-h9i0',
    callerContext: {
      awsSdkVersion: 'aws-sdk-unknown-unknown',
      clientId: 'client123',
    },
    triggerSource: 'PostAuthentication_Authentication',
    request: {
      userAttributes: { sub: 'user123', email: 'test@example.com' },
      newDeviceUsed: false,
    },
    response: {},
  };
  const event = baseEvent;

  beforeEach(() => {
    cognitoMock.reset();
    vi.restoreAllMocks();
  });

  it('adds a federated user with no dr-* group membership to the racers group', async () => {
    cognitoMock.on(AdminListGroupsForUserCommand).resolves({ Groups: [] });
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});

    const result = await PostAuthentication(event, context, callback);

    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)).toHaveLength(1);
    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)[0].args[0].input).toEqual({
      UserPoolId: 'us-east-1_123456789',
      Username: 'sso_01a2b3c4-d5e6-f7g8-h9i0',
      GroupName: 'dr-racers',
    });
    expect(result).toEqual(event);
  });

  it('does not re-add a federated user already in any dr-* group (e.g. an admin moved out of dr-racers)', async () => {
    cognitoMock.on(AdminListGroupsForUserCommand).resolves({ Groups: [{ GroupName: 'dr-admins' }] });

    await PostAuthentication(event, context, callback);

    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)).toHaveLength(0);
  });

  it('does not throw when the Cognito API call fails, so a transient failure cannot block sign-in', async () => {
    cognitoMock.on(AdminListGroupsForUserCommand).rejects(new Error('ThrottlingException'));
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const result = await PostAuthentication(event, context, callback);

    expect(result).toEqual(event);
    expect(loggerSpy).toHaveBeenCalledWith(
      'Failed to ensure user group membership',
      expect.objectContaining({ userName: 'sso_01a2b3c4-d5e6-f7g8-h9i0' }),
    );
  });

  it('skips Cognito API calls entirely for a native (non-federated) sign-in', async () => {
    const nativeEvent: PostAuthenticationTriggerEvent = { ...baseEvent, userName: 'abcdefghijklmno' };

    const result = await PostAuthentication(nativeEvent, context, callback);

    expect(cognitoMock.commandCalls(AdminListGroupsForUserCommand)).toHaveLength(0);
    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)).toHaveLength(0);
    expect(result).toEqual(nativeEvent);
  });
});
