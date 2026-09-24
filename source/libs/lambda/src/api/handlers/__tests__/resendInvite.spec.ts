// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { profileDao } from '@deepracer-indy/database';
import {
  ConflictError,
  InternalFailureError,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import {
  findCognitoUsernameByEmail,
  getCognitoUserState,
  resendRacerInvite,
} from '../../utils/cognitoUserManagement.js';
import { ResendInviteOperation } from '../resendInvite.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

vi.mock('../../utils/cognitoUserManagement.js', () => ({
  findCognitoUsernameByEmail: vi.fn(),
  getCognitoUserState: vi.fn(),
  resendRacerInvite: vi.fn(),
}));

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);
const input = { profileId: 'profile-1' };

describe('ResendInvite operation', () => {
  beforeEach(() => {
    mockIsUserAdmin.mockResolvedValue(true);
    process.env.USER_POOL_ID = 'us-east-1_pool';
    vi.spyOn(profileDao, 'load').mockResolvedValue({ emailAddress: 'racer@example.com' } as never);
    vi.mocked(findCognitoUsernameByEmail).mockResolvedValue('cognito-user-1');
    vi.mocked(getCognitoUserState).mockResolvedValue({ status: 'FORCE_CHANGE_PASSWORD', enabled: true });
    vi.mocked(resendRacerInvite).mockResolvedValue();
  });

  it('rejects non-admin callers', async () => {
    mockIsUserAdmin.mockResolvedValue(false);
    await expect(ResendInviteOperation(input, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
  });

  it('propagates 404 when the profile is not in DynamoDB', async () => {
    vi.spyOn(profileDao, 'load').mockRejectedValue(new NotFoundError({ message: 'x' }));
    await expect(ResendInviteOperation(input, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotFoundError);
  });

  it('returns 404 when the user is not found in Cognito', async () => {
    vi.mocked(findCognitoUsernameByEmail).mockResolvedValue(null);
    await expect(ResendInviteOperation(input, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotFoundError);
  });

  it('rejects a disabled user with 409', async () => {
    vi.mocked(getCognitoUserState).mockResolvedValue({ status: 'FORCE_CHANGE_PASSWORD', enabled: false });
    await expect(ResendInviteOperation(input, TEST_OPERATION_CONTEXT)).rejects.toThrow(ConflictError);
    expect(resendRacerInvite).not.toHaveBeenCalled();
  });

  it('rejects a confirmed user with 409', async () => {
    vi.mocked(getCognitoUserState).mockResolvedValue({ status: 'CONFIRMED', enabled: true });
    await expect(ResendInviteOperation(input, TEST_OPERATION_CONTEXT)).rejects.toThrow(ConflictError);
  });

  it('rejects an external-provider user with 409', async () => {
    vi.mocked(getCognitoUserState).mockResolvedValue({ status: 'EXTERNAL_PROVIDER', enabled: true });
    await expect(ResendInviteOperation(input, TEST_OPERATION_CONTEXT)).rejects.toThrow(ConflictError);
  });

  it('resends the invitation for a FORCE_CHANGE_PASSWORD user', async () => {
    const output = await ResendInviteOperation(input, TEST_OPERATION_CONTEXT);
    expect(resendRacerInvite).toHaveBeenCalledWith('us-east-1_pool', 'cognito-user-1');
    expect(output.message).toContain('resent');
  });

  it('maps a Cognito resend failure to 500', async () => {
    vi.mocked(resendRacerInvite).mockRejectedValue(new Error('cognito down'));
    await expect(ResendInviteOperation(input, TEST_OPERATION_CONTEXT)).rejects.toThrow(InternalFailureError);
  });
});
