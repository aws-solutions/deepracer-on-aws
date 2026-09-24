// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AttachPolicyCommand, DetachPolicyCommand, IoTClient } from '@aws-sdk/client-iot';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the group-resolution utilities so we can drive the group-branching logic without spinning
// up the full API/Cognito stack.
const mockGetCognitoUserId = vi.fn();
const mockIsUserAdminOrFacilitator = vi.fn();
vi.mock('../../api/utils/apiGateway.js', () => ({
  getCognitoUserId: (...args: unknown[]) => mockGetCognitoUserId(...args),
  isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args),
}));

const mockIoTClient = mockClient(IoTClient);

const IOT_POLICY_NAME = 'DeepRacerSpectatorPolicy';
const IOT_PUBLISH_POLICY_NAME = 'DeepRacerFacilitatorPolicy';
const USER_POOL_ID = 'eu-central-1_testpool';
const IDENTITY_ID = 'eu-central-1:test-identity-id';
const AUTH_PROVIDER =
  'cognito-idp.eu-central-1.amazonaws.com/eu-central-1_pool,cognito-idp.eu-central-1.amazonaws.com/eu-central-1_pool:CognitoSignIn:test-sub';

const makeEvent = (opts: { cognitoIdentityId?: string | null; authProvider?: string } = {}): APIGatewayProxyEvent =>
  ({
    headers: {},
    requestContext: {
      identity: {
        cognitoIdentityId: opts.cognitoIdentityId ?? IDENTITY_ID,
        cognitoAuthenticationProvider: opts.authProvider,
      },
    },
  }) as unknown as APIGatewayProxyEvent;

describe('attachPolicy handler', () => {
  let handler: (typeof import('../attachPolicy.js'))['handler'];

  beforeEach(async () => {
    process.env.IOT_POLICY_NAME = IOT_POLICY_NAME;
    process.env.IOT_PUBLISH_POLICY_NAME = IOT_PUBLISH_POLICY_NAME;
    process.env.USER_POOL_ID = USER_POOL_ID;
    vi.resetModules();
    mockGetCognitoUserId.mockReset();
    mockIsUserAdminOrFacilitator.mockReset();
    ({ handler } = await import('../attachPolicy.js'));
    mockIoTClient.reset();
    mockIoTClient.on(AttachPolicyCommand).resolves({});
    mockIoTClient.on(DetachPolicyCommand).resolves({});
  });

  it('throws at module load when IOT_POLICY_NAME is missing', async () => {
    vi.resetModules();
    delete process.env.IOT_POLICY_NAME;
    await expect(import('../attachPolicy.js')).rejects.toThrow(
      'Missing required environment variable: IOT_POLICY_NAME',
    );
  });

  it('throws at module load when IOT_PUBLISH_POLICY_NAME is missing', async () => {
    vi.resetModules();
    process.env.IOT_POLICY_NAME = IOT_POLICY_NAME;
    delete process.env.IOT_PUBLISH_POLICY_NAME;
    await expect(import('../attachPolicy.js')).rejects.toThrow(
      'Missing required environment variable: IOT_PUBLISH_POLICY_NAME',
    );
  });

  it('throws at module load when USER_POOL_ID is missing', async () => {
    vi.resetModules();
    process.env.IOT_POLICY_NAME = IOT_POLICY_NAME;
    process.env.IOT_PUBLISH_POLICY_NAME = IOT_PUBLISH_POLICY_NAME;
    delete process.env.USER_POOL_ID;
    await expect(import('../attachPolicy.js')).rejects.toThrow('Missing required environment variable: USER_POOL_ID');
  });

  it('attaches the base policy for a caller with no auth provider and returns 200', async () => {
    const result = await handler(makeEvent());

    expect(result).toEqual({ statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    expect(mockIoTClient).toHaveReceivedCommandWith(AttachPolicyCommand, {
      policyName: IOT_POLICY_NAME,
      target: IDENTITY_ID,
    });
    expect(mockGetCognitoUserId).not.toHaveBeenCalled();
  });

  it('attaches the base policy and detaches the publish policy for a non-privileged caller', async () => {
    mockGetCognitoUserId.mockResolvedValue('profile-123');
    mockIsUserAdminOrFacilitator.mockResolvedValue(false);

    await handler(makeEvent({ authProvider: AUTH_PROVIDER }));

    expect(mockIoTClient).toHaveReceivedCommandWith(AttachPolicyCommand, {
      policyName: IOT_POLICY_NAME,
      target: IDENTITY_ID,
    });
    // Reconcile: the publish-capable policy must be detached so a demoted facilitator loses publish.
    expect(mockIoTClient).toHaveReceivedCommandWith(DetachPolicyCommand, {
      policyName: IOT_PUBLISH_POLICY_NAME,
      target: IDENTITY_ID,
    });
  });

  it('attaches the publish-capable policy and detaches the base policy for an admin/facilitator caller', async () => {
    mockGetCognitoUserId.mockResolvedValue('profile-123');
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);

    await handler(makeEvent({ authProvider: AUTH_PROVIDER }));

    expect(mockIoTClient).toHaveReceivedCommandWith(AttachPolicyCommand, {
      policyName: IOT_PUBLISH_POLICY_NAME,
      target: IDENTITY_ID,
    });
    expect(mockIoTClient).toHaveReceivedCommandWith(DetachPolicyCommand, {
      policyName: IOT_POLICY_NAME,
      target: IDENTITY_ID,
    });
  });

  it('still attaches (returns 200) when the reconcile detach fails', async () => {
    mockIoTClient.on(DetachPolicyCommand).rejects(new Error('policy not attached'));

    const result = await handler(makeEvent());

    expect(result).toMatchObject({ statusCode: 200 });
    expect(mockIoTClient).toHaveReceivedCommandWith(AttachPolicyCommand, {
      policyName: IOT_POLICY_NAME,
      target: IDENTITY_ID,
    });
  });

  it('fails closed to the base policy when group resolution throws', async () => {
    mockGetCognitoUserId.mockRejectedValue(new Error('cognito unavailable'));

    const result = await handler(makeEvent({ authProvider: AUTH_PROVIDER }));

    expect(result).toMatchObject({ statusCode: 200 });
    expect(mockIoTClient).toHaveReceivedCommandWith(AttachPolicyCommand, {
      policyName: IOT_POLICY_NAME,
      target: IDENTITY_ID,
    });
  });

  it('attaches before detaching so a failed attach never leaves the caller without a policy', async () => {
    await handler(makeEvent());

    const calls = mockIoTClient.calls();
    const attachIdx = calls.findIndex((c) => c.args[0] instanceof AttachPolicyCommand);
    const detachIdx = calls.findIndex((c) => c.args[0] instanceof DetachPolicyCommand);
    expect(attachIdx).toBeGreaterThanOrEqual(0);
    expect(detachIdx).toBeGreaterThan(attachIdx);
  });

  it('returns 400 when cognitoIdentityId is missing', async () => {
    const event = {
      headers: {},
      requestContext: { identity: {} },
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result).toMatchObject({ statusCode: 400 });
  });

  it('returns 500 when AttachPolicy fails', async () => {
    mockIoTClient.on(AttachPolicyCommand).rejects(new Error('Access denied'));

    const result = await handler(makeEvent());

    expect(result).toMatchObject({ statusCode: 500 });
  });
});
