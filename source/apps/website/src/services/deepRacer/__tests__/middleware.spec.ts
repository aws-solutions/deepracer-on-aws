// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SignatureV4 } from '@aws-sdk/signature-v4';
import { ServiceInputTypes, ServiceOutputTypes } from '@deepracer-indy/typescript-client';
import { HttpRequest } from '@smithy/protocol-http';
import { MiddlewareStack } from '@smithy/types';
import { type AuthSession, fetchAuthSession } from 'aws-amplify/auth';
import { vi } from 'vitest';

import { httpSigningMiddleware, httpSigningPlugin } from '../middleware';

// Mock dependencies
vi.mock('@aws-crypto/sha256-browser', () => ({
  Sha256: vi.fn(),
}));

vi.mock('@aws-sdk/signature-v4', () => ({
  SignatureV4: vi.fn(),
}));

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

vi.mock('#utils/envUtils', () => ({
  environmentConfig: {
    region: 'us-east-1',
  },
}));

describe('middleware', () => {
  const mockNext = vi.fn().mockImplementation((args) => Promise.resolve({ response: {} }));
  const mockContext = {
    logger: console,
    operation: { name: 'TestOperation' },
  };
  const mockSignedRequest = { headers: { Authorization: 'AWS4-HMAC-SHA256...' } };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock SignatureV4 instance
    (SignatureV4 as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      sign: vi.fn().mockResolvedValue(mockSignedRequest),
    }));
  });

  describe('httpSigningMiddleware', () => {
    it('should pass through non-HttpRequest without signing', async () => {
      const request = { method: 'GET' }; // Not an HttpRequest instance

      await httpSigningMiddleware(
        mockNext,
        mockContext,
      )({
        input: {},
        request,
      });

      // Verify SignatureV4 was not created
      expect(SignatureV4).not.toHaveBeenCalled();

      // Verify next middleware was called with original request
      expect(mockNext).toHaveBeenCalledWith({
        input: {},
        request,
      });
    });

    it('should throw error when credentials are missing', async () => {
      // Mock auth session without credentials
      const mockSessionWithoutCreds: AuthSession = {
        credentials: undefined,
        identityId: 'test-identity-id',
        tokens: {
          accessToken: {
            toString: () => 'test-access-token',
            payload: {},
          },
          idToken: {
            toString: () => 'test-id-token',
            payload: {},
          },
        },
      };
      (fetchAuthSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockSessionWithoutCreds);

      const request = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'api.example.com',
        path: '/test',
      });

      await expect(
        httpSigningMiddleware(
          mockNext,
          mockContext,
        )({
          input: {},
          request,
        }),
      ).rejects.toThrow('No credentials found');

      // Verify next middleware was not called
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('httpSigningPlugin', () => {
    it('should configure middleware in stack correctly', () => {
      const mockStack = {
        addRelativeTo: vi.fn(),
        add: vi.fn(),
        use: vi.fn(),
        clone: vi.fn(),
        remove: vi.fn(),
        identify: vi.fn(),
        concat: vi.fn(),
        resolve: vi.fn(),
        removeByTag: vi.fn(),
        filter: vi.fn(),
      } as unknown as MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>;

      httpSigningPlugin.applyToStack(mockStack);

      // Verify middleware was added with correct configuration
      expect(mockStack.addRelativeTo).toHaveBeenCalledWith(httpSigningMiddleware, {
        tags: ['HTTP_SIGNING'],
        name: 'httpSigningMiddleware',
        aliases: ['apiKeyMiddleware', 'tokenMiddleware', 'awsAuthMiddleware'],
        override: true,
        relation: 'after',
        toMiddleware: 'retryMiddleware',
      });
    });
  });
});
