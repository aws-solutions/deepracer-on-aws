// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EnvironmentConfig } from '../envUtils';

describe('envUtils', () => {
  // Save original window.EnvironmentConfig
  const originalConfig = window.EnvironmentConfig;

  beforeEach(() => {
    // Clear module cache
    vi.resetModules();
    // Reset window.EnvironmentConfig before each test
    window.EnvironmentConfig = undefined as unknown as EnvironmentConfig;
  });

  afterEach(() => {
    // Restore original window.EnvironmentConfig after each test
    window.EnvironmentConfig = originalConfig;
  });

  it('should use default values when window.EnvironmentConfig is undefined', async () => {
    // Use isolateModules to get fresh module instance
    const { environmentConfig } = await vi.importActual<typeof import('../envUtils')>('../envUtils');
    expect(environmentConfig).toEqual({
      apiEndpointUrl: 'https://localhost',
      userPoolId: 'placeholder-user-pool-id',
      identityPoolId: 'placeholder-identity-pool-id',
      userPoolClientId: 'placeholder-user-pool-client-id',
      region: 'us-east-1',
      uploadBucketName: 'upload-bucket',
    });
  });

  it('should use values from window.EnvironmentConfig when defined', async () => {
    const testConfig = {
      apiEndpointUrl: 'https://api.example.com',
      userPoolId: 'test-user-pool-id',
      identityPoolId: 'test-identity-pool-id',
      userPoolClientId: 'test-user-pool-client-id',
      region: 'eu-west-1',
      uploadBucketName: 'test-upload-bucket',
    };

    window.EnvironmentConfig = testConfig;

    const { environmentConfig } = await vi.importActual<typeof import('../envUtils')>('../envUtils');
    expect(environmentConfig).toEqual(testConfig);
  });

  it('should use fallback values for undefined properties', async () => {
    // Create a base config
    const partialConfig: EnvironmentConfig = {
      apiEndpointUrl: 'https://api.example.com',
      userPoolId: 'test-user-pool-id',
      identityPoolId: 'placeholder-identity-pool-id',
      userPoolClientId: 'test-user-pool-client-id',
      region: 'us-east-1',
      uploadBucketName: 'test-upload-bucket',
    };

    // Set some values to undefined to test fallbacks
    window.EnvironmentConfig = {
      ...partialConfig,
      identityPoolId: undefined as unknown as string,
      region: undefined as unknown as string,
    };

    const { environmentConfig } = await vi.importActual<typeof import('../envUtils')>('../envUtils');
    expect(environmentConfig).toEqual({
      apiEndpointUrl: 'https://api.example.com',
      userPoolId: 'test-user-pool-id',
      identityPoolId: 'placeholder-identity-pool-id', // fallback
      userPoolClientId: 'test-user-pool-client-id',
      region: 'us-east-1', // fallback
      uploadBucketName: 'test-upload-bucket',
    });
  });

  it('should use fallback values for null properties', async () => {
    // Create a base config
    const partialConfig: EnvironmentConfig = {
      apiEndpointUrl: 'https://api.example.com',
      userPoolId: 'test-user-pool-id',
      identityPoolId: 'placeholder-identity-pool-id',
      userPoolClientId: 'test-user-pool-client-id',
      region: 'us-east-1',
      uploadBucketName: 'test-upload-bucket',
    };

    // Set some values to null to test fallbacks
    window.EnvironmentConfig = {
      ...partialConfig,
      identityPoolId: null as unknown as string,
      region: null as unknown as string,
      uploadBucketName: null as unknown as string,
    };

    const { environmentConfig } = await vi.importActual<typeof import('../envUtils')>('../envUtils');
    expect(environmentConfig).toEqual({
      apiEndpointUrl: 'https://api.example.com',
      userPoolId: 'test-user-pool-id',
      identityPoolId: 'placeholder-identity-pool-id', // fallback
      userPoolClientId: 'test-user-pool-client-id',
      region: 'us-east-1', // fallback
      uploadBucketName: 'upload-bucket', // fallback
    });
  });
});
