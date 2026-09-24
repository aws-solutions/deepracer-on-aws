// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AdminCreateUserCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { mockClient } from 'aws-sdk-client-mock';

import { createRacerCognitoUser, sanitizeDisplayNameToAlias } from '../cognitoUserManagement.js';

const cognitoMock = mockClient(CognitoIdentityProviderClient);

describe('sanitizeDisplayNameToAlias', () => {
  it('returns undefined when displayName is absent', () => {
    expect(sanitizeDisplayNameToAlias(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(sanitizeDisplayNameToAlias('')).toBeUndefined();
  });

  it('strips spaces, producing a valid alias from a multi-word display name', () => {
    expect(sanitizeDisplayNameToAlias('Alice Smith')).toBe('AliceSmith');
  });

  it('strips punctuation such as apostrophes and periods', () => {
    expect(sanitizeDisplayNameToAlias("O'Brien Jr.")).toBe('OBrienJr');
  });

  it('preserves hyphens and underscores (already valid alias characters)', () => {
    expect(sanitizeDisplayNameToAlias('mary-jane_doe')).toBe('mary-jane_doe');
  });

  it('truncates to 20 characters', () => {
    expect(sanitizeDisplayNameToAlias('AVeryLongDisplayNameIndeed')).toBe('AVeryLongDisplayName');
    expect(sanitizeDisplayNameToAlias('AVeryLongDisplayNameIndeed')).toHaveLength(20);
  });

  it('returns undefined when sanitization leaves fewer than 3 characters', () => {
    expect(sanitizeDisplayNameToAlias('A')).toBeUndefined();
    expect(sanitizeDisplayNameToAlias('A.')).toBeUndefined();
    expect(sanitizeDisplayNameToAlias('  ')).toBeUndefined();
  });

  it('returns a valid alias once sanitization reaches the 3-character minimum', () => {
    expect(sanitizeDisplayNameToAlias('Al Bo')).toBe('AlBo');
  });

  it('strips non-Latin/accented characters not in the allowed alias set', () => {
    expect(sanitizeDisplayNameToAlias('José')).toBe('Jos');
  });
});

describe('createRacerCognitoUser', () => {
  beforeEach(() => {
    cognitoMock.reset();
    cognitoMock.on(AdminCreateUserCommand).resolves({});
  });

  it('does not set custom:racerAlias when no alias is provided', async () => {
    await createRacerCognitoUser('pool-1', 'racer@example.com');

    const call = cognitoMock.commandCalls(AdminCreateUserCommand)[0];
    const attributeNames = call.args[0].input.UserAttributes?.map((attr) => attr.Name);
    expect(attributeNames).not.toContain('custom:racerAlias');
  });

  it('sets custom:racerAlias when an alias is provided', async () => {
    await createRacerCognitoUser('pool-1', 'racer@example.com', 'AliceSmith');

    const call = cognitoMock.commandCalls(AdminCreateUserCommand)[0];
    expect(call.args[0].input.UserAttributes).toContainEqual({ Name: 'custom:racerAlias', Value: 'AliceSmith' });
  });

  it('still sets the required email attributes regardless of alias', async () => {
    await createRacerCognitoUser('pool-1', 'racer@example.com', 'AliceSmith');

    const call = cognitoMock.commandCalls(AdminCreateUserCommand)[0];
    expect(call.args[0].input.UserAttributes).toContainEqual({ Name: 'email', Value: 'racer@example.com' });
    expect(call.args[0].input.UserAttributes).toContainEqual({ Name: 'email_verified', Value: 'true' });
  });
});
