// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { beforeAll, describe, expect, it } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { StaticWebsite } from '../website.js';

// TODO Test is currently skipped as it fails in CI due to:
// Error: Cannot find asset at workspace/src/DeepRacerIndy/source/apps/website/dist
// Test runs locally as expected and .skip() can be removed to verify
describe.skip('StaticWebsite', () => {
  let app: App;
  let stack: Stack;
  let template: Template;
  let modelStorageBucket: Bucket;
  let uploadBucket: Bucket;

  const testProps = {
    apiEndpointUrl: 'https://api.example.com',
    identityPoolId: 'us-east-1:12345678-1234-1234-1234-123456789012',
    userPoolId: 'us-east-1_ABCDEFGHI',
    userPoolClientId: 'abcdefghijklmnopqrstuvwxyz',
  };

  beforeAll(() => {
    app = new App();
    stack = new Stack(app, 'TestStack', {
      env: { region: 'us-east-1' },
    });

    modelStorageBucket = new Bucket(stack, 'TestModelStorageBucket', {
      bucketName: 'test-model-storage-bucket',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    uploadBucket = new Bucket(stack, 'TestUploadBucket', {
      bucketName: 'test-upload-bucket',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new StaticWebsite(stack, 'TestStaticWebsite', {
      ...testProps,
      modelStorageBucket,
      uploadBucket,
      namespace: TEST_NAMESPACE,
    });

    template = Template.fromStack(stack);
  });

  describe('Security configuration', () => {
    it('configures content-security-policy correctly', () => {
      const str = JSON.stringify(template.toJSON());
      expect(str).toContain("base-uri 'none'");
      expect(str).toContain("default-src 'none'");
      expect(str).toContain("frame-ancestors 'none'");
      expect(str).toContain("media-src 'self' blob: https://");
    });

    it('configures strict-transport-security correctly', () => {
      const str = JSON.stringify(template.toJSON());
      expect(str.includes('"AccessControlMaxAgeSec":47304000')).toBe(true);
    });

    it('configures cache-control correctly', () => {
      const str = JSON.stringify(template.toJSON());
      expect(str.includes('{"Header":"Cache-Control","Override":true,"Value":"no-cache,no-store"}')).toBe(true);
    });

    it('configures cross-origin-opener-policy correctly', () => {
      const str = JSON.stringify(template.toJSON());
      expect(str.includes('{"Header":"Cross-Origin-Opener-Policy","Override":true,"Value":"same-origin"}')).toBe(true);
    });
  });
});
