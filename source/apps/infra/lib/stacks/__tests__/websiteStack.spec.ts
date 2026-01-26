// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, CfnParameter, Stack } from 'aws-cdk-lib';
import { ApiDefinition, SpecRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Source } from 'aws-cdk-lib/aws-s3-deployment';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { TEST_NAMESPACE } from '../../constants/testConstants.js';
import { WebsiteStack, WebsiteStackProps } from '../websiteStack.js';

describe('WebsiteStack', () => {
  let originalAsset: typeof Source.asset;

  beforeEach(() => {
    // Mock Source.asset to prevent it from looking for actual asset directories
    originalAsset = Source.asset;
    Source.asset = vi.fn().mockImplementation((path: string) => ({
      bind: vi.fn().mockReturnValue({
        bucket: undefined,
        zipObjectKey: 'mock-key',
      }),
    })) as typeof Source.asset;
  });

  afterEach(() => {
    // Restore the original Source.asset implementation
    Source.asset = originalAsset;
  });
  it('can be instantiated successfully', () => {
    const app = new App();
    const parentStack = new Stack(app, 'ParentStack');

    // Create resources in parent stack
    const mockApi = new SpecRestApi(parentStack, 'MockApi', {
      apiDefinition: ApiDefinition.fromInline({
        openapi: '3.0.1',
        info: { title: 'Mock API', version: '1.0.0' },
        paths: {},
      }),
    });

    const mockModelStorageBucket = new Bucket(parentStack, 'MockModelStorage');
    const mockUploadBucket = new Bucket(parentStack, 'MockUpload');

    const customDomainParam = new CfnParameter(parentStack, 'CustomDomainParam', {
      type: 'String',
      default: '',
      description: 'Custom domain parameter for testing',
    });

    const props: WebsiteStackProps = {
      api: mockApi,
      identityPoolId: 'us-east-1:12345678-1234-1234-1234-123456789012',
      userPoolId: 'us-east-1_ABCDEFGHI',
      userPoolClientId: 'test-client-id',
      modelStorageBucket: mockModelStorageBucket,
      uploadBucket: mockUploadBucket,
      namespace: TEST_NAMESPACE,
      customDomainParam,
    };

    // Test stack instantiation
    const websiteStack = new WebsiteStack(parentStack, 'TestWebsiteStack', props);

    expect(websiteStack).toBeDefined();
    expect(websiteStack.nestedStackParent).toBe(parentStack);
  });

  it('validates constructor parameters', () => {
    const app = new App();
    const parentStack = new Stack(app, 'ParentStack');

    const mockApi = new SpecRestApi(parentStack, 'MockApi', {
      apiDefinition: ApiDefinition.fromInline({
        openapi: '3.0.1',
        info: { title: 'Mock API', version: '1.0.0' },
        paths: {},
      }),
    });

    const mockModelStorageBucket = new Bucket(parentStack, 'MockModelStorage');
    const mockUploadBucket = new Bucket(parentStack, 'MockUpload');

    const customDomainParam = new CfnParameter(parentStack, 'CustomDomainParam', {
      type: 'String',
      default: '',
      description: 'Custom domain parameter for testing',
    });

    // Test with valid props
    const validProps: WebsiteStackProps = {
      api: mockApi,
      identityPoolId: 'us-east-1:12345678-1234-1234-1234-123456789012',
      userPoolId: 'us-east-1_ABCDEFGHI',
      userPoolClientId: 'test-client-id',
      modelStorageBucket: mockModelStorageBucket,
      uploadBucket: mockUploadBucket,
      namespace: TEST_NAMESPACE,
      customDomainParam,
    };

    expect(() => {
      new WebsiteStack(parentStack, 'TestWebsiteStack', validProps);
    }).not.toThrow();
  });
});
