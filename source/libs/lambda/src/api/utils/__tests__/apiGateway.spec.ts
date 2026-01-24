// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { ResourceId } from '@deepracer-indy/database';
import { UserGroups } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { type Mock, vi } from 'vitest';

import { cognitoClient } from '#utils/clients/cognitoClient.js';

import { getCognitoUserId, getApiGatewayHandler, isUserAdmin } from '../apiGateway';

class MockListUsersCommand {
  constructor(public input: unknown) {}
}

class MockAdminListGroupsForUserCommand {
  constructor(public input: unknown) {}
}

// Mock external dependencies
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  ListUsersCommand: vi.fn().mockImplementation((input) => new MockListUsersCommand(input)),
  AdminListGroupsForUserCommand: vi.fn().mockImplementation((input) => new MockAdminListGroupsForUserCommand(input)),
}));

vi.mock('@aws-smithy/server-apigateway', () => ({
  convertEvent: vi.fn().mockReturnValue({}),
  convertVersion1Response: vi.fn((response) => response),
}));

vi.mock('@deepracer-indy/utils', () => ({
  logger: {
    appendKeys: vi.fn(),
    addContext: vi.fn(),
    removeContext: vi.fn(),
    clearContext: vi.fn(),
    setContext: vi.fn(),
    logEventIfEnabled: vi.fn(),
    error: vi.fn(),
    clearBuffer: vi.fn(),
    refreshSampleRateCalculation: vi.fn(),
  },
  metrics: {
    setDefaultDimensions: vi.fn(),
    setFunctionName: vi.fn(),
    publishStoredMetrics: vi.fn(),
  },
  tracer: {
    wrap: vi.fn((name, fn) => fn),
    captureAWSv3Client: vi.fn(),
    isTracingEnabled: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('#utils/clients/cognitoClient.js', () => ({
  cognitoClient: {
    send: vi.fn(),
  },
}));

vi.mock('../../utils/CognitoHelper.js', () => ({
  cognitoHelper: {
    getUsernameFromSub: vi.fn(),
  },
}));

describe('getCognitoUserId', () => {
  let mockCognitoClientForGetUserId: { send: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCognitoClientForGetUserId = { send: vi.fn() };
    (CognitoIdentityProviderClient as Mock).mockReturnValue(mockCognitoClientForGetUserId);
  });

  it('should throw error if cognitoAuthProvider is missing', async () => {
    await expect(getCognitoUserId('')).rejects.toThrow('User is not authenticated');
  });

  it('should throw error if string has no comma', async () => {
    await expect(getCognitoUserId('invalid-format')).rejects.toThrow('Could not parse authentication provider');
  });

  it('should throw error if first part has no slash', async () => {
    await expect(getCognitoUserId('no-slash-part,test-user')).rejects.toThrow(
      'Could not parse authentication provider',
    );
  });

  it('should throw error if user pool ID is missing after slash', async () => {
    await expect(getCognitoUserId('cognito-idp.us-east-1.amazonaws.com/,test-user')).rejects.toThrow(
      'Could not parse userPoolId',
    );
  });

  it('should throw error if sub is empty', async () => {
    await expect(getCognitoUserId('cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,')).rejects.toThrow(
      'Could not parse sub',
    );
  });

  it('should throw error if Cognito API call fails', async () => {
    (cognitoClient.send as Mock).mockRejectedValueOnce(new Error('Cognito error'));

    await expect(getCognitoUserId('cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,test-user')).rejects.toThrow(
      'Failed to get username',
    );
  });

  it('should throw error if no users are found', async () => {
    (cognitoClient.send as Mock).mockResolvedValueOnce({
      Users: [],
      $metadata: {},
    });

    await expect(getCognitoUserId('cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,test-user')).rejects.toThrow(
      'Failed to get username',
    );
  });

  it('should throw error if multiple users are found', async () => {
    (cognitoClient.send as Mock).mockResolvedValueOnce({
      Users: [{ Username: 'user1' }, { Username: 'user2' }],
      $metadata: {},
    });

    await expect(getCognitoUserId('cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,test-user')).rejects.toThrow(
      'Failed to get username',
    );
  });
});

describe('isUserAdmin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw error if USER_POOL_ID is not set', async () => {
    delete process.env.USER_POOL_ID;

    await expect(isUserAdmin('testuser' as ResourceId)).rejects.toThrow('Service configuration error.');
  });

  it('should return true if user is in ADMIN group', async () => {
    process.env.USER_POOL_ID = 'us-east-1_test123';

    (cognitoClient.send as Mock).mockResolvedValueOnce({
      Groups: [{ GroupName: UserGroups.ADMIN }, { GroupName: 'OTHER_GROUP' }],
    });

    const result = await isUserAdmin('testuser' as ResourceId);
    expect(result).toBe(true);
  });

  it('should return false if user is not in ADMIN group', async () => {
    process.env.USER_POOL_ID = 'us-east-1_test123';

    (cognitoClient.send as Mock).mockResolvedValueOnce({
      Groups: [{ GroupName: 'OTHER_GROUP' }],
    });

    const result = await isUserAdmin('testuser' as ResourceId);
    expect(result).toBe(false);
  });

  it('should return false if user has no groups', async () => {
    process.env.USER_POOL_ID = 'us-east-1_test123';

    (cognitoClient.send as Mock).mockResolvedValueOnce({
      Groups: [],
    });

    const result = await isUserAdmin('testuser' as ResourceId);
    expect(result).toBe(false);
  });

  it('should return false if Groups is undefined', async () => {
    process.env.USER_POOL_ID = 'us-east-1_test123';

    (cognitoClient.send as Mock).mockResolvedValueOnce({});

    const result = await isUserAdmin('testuser' as ResourceId);
    expect(result).toBe(false);
  });

  it('should throw error if Cognito API call fails', async () => {
    process.env.USER_POOL_ID = 'us-east-1_test123';

    (cognitoClient.send as Mock).mockRejectedValueOnce(new Error('Cognito API error'));

    await expect(isUserAdmin('testuser' as ResourceId)).rejects.toThrow('Failed to verify user permissions.');
  });
});

describe('getApiGatewayHandler', () => {
  const mockServiceHandler = {
    handle: vi.fn(),
  };

  const mockEvent = {
    requestContext: {
      identity: {
        cognitoAuthenticationProvider:
          'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123:CognitoSignIn:abc-123-def',
        sourceIp: '192.168.1.100',
      },
      operationName: 'TestOperation',
      requestId: 'test-request-id',
      extendedRequestId: 'test-extended-request-id',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceHandler.handle.mockResolvedValue({
      headers: {},
    });
  });

  it('should throw error if cognitoAuthProvider is missing', async () => {
    const handler = getApiGatewayHandler(mockServiceHandler);
    await expect(
      handler(
        {
          ...mockEvent,
          requestContext: {
            ...mockEvent.requestContext,
            identity: { cognitoAuthenticationProvider: '' },
          },
        } as never,
        {} as never,
        {} as never,
      ),
    ).rejects.toThrow();
  });

  it('should append sourceIpAddress from event.requestContext.identity.sourceIp to logger', async () => {
    (cognitoClient.send as Mock).mockResolvedValueOnce({
      Users: [{ Username: 'testuser' }],
      $metadata: {},
    });

    const handler = getApiGatewayHandler(mockServiceHandler);
    await handler(mockEvent as never, {} as never, {} as never);

    expect(logger.appendKeys).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceIpAddress: '192.168.1.100',
      }),
    );
  });
});
