// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InternalFailureError, UserGroups } from '@deepracer-indy/typescript-server-client';

import { getCarLogAccess, requireCarLogEnv } from '../carLogAccess.js';

const mockGetUserGroups = vi.fn();
vi.mock('../apiGateway.js', () => ({ getUserGroups: (...args: unknown[]) => mockGetUserGroups(...args) }));

describe('getCarLogAccess', () => {
  it.each([
    [[UserGroups.ADMIN], 'manager'],
    [[UserGroups.RACE_FACILITATORS], 'manager'],
    [[UserGroups.COMMENTATORS], 'viewer'],
    [[UserGroups.COMMENTATORS, UserGroups.ADMIN], 'manager'],
    [[UserGroups.RACERS], 'racer'],
    [[], 'racer'],
  ])('maps groups %j to %s', async (groups, expected) => {
    mockGetUserGroups.mockResolvedValue(groups);

    await expect(getCarLogAccess('profile1234567890' as never)).resolves.toBe(expected);
  });
});

describe('requireCarLogEnv', () => {
  it('fails with a generic error when the variable is missing', () => {
    delete process.env.CAR_LOG_STATE_MACHINE_ARN;

    expect(() => requireCarLogEnv('CAR_LOG_STATE_MACHINE_ARN')).toThrow(InternalFailureError);
  });
});
