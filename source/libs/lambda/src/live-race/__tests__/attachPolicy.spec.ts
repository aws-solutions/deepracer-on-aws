// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AttachPolicyCommand, IoTClient } from '@aws-sdk/client-iot';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIoTClient = mockClient(IoTClient);

const IOT_POLICY_NAME = 'DeepRacerSpectatorPolicy';
const IDENTITY_ID = 'eu-central-1:test-identity-id';

const makeEvent = (cognitoIdentityId?: string | null): APIGatewayProxyEvent =>
  ({
    headers: {},
    requestContext: {
      identity: {
        cognitoIdentityId: cognitoIdentityId ?? IDENTITY_ID,
      },
    },
  }) as unknown as APIGatewayProxyEvent;

describe('attachPolicy handler', () => {
  let handler: (typeof import('../attachPolicy.js'))['handler'];

  beforeEach(async () => {
    process.env.IOT_POLICY_NAME = IOT_POLICY_NAME;
    vi.resetModules();
    ({ handler } = await import('../attachPolicy.js'));
    mockIoTClient.reset();
  });

  it('throws at module load when IOT_POLICY_NAME is missing', async () => {
    vi.resetModules();
    delete process.env.IOT_POLICY_NAME;
    await expect(import('../attachPolicy.js')).rejects.toThrow(
      'Missing required environment variable: IOT_POLICY_NAME',
    );
  });

  it('attaches policy using cognitoIdentityId and returns 200', async () => {
    mockIoTClient.on(AttachPolicyCommand).resolves({});

    const result = await handler(makeEvent());

    expect(result).toEqual({ statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    expect(mockIoTClient).toHaveReceivedCommandWith(AttachPolicyCommand, {
      policyName: IOT_POLICY_NAME,
      target: IDENTITY_ID,
    });
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
