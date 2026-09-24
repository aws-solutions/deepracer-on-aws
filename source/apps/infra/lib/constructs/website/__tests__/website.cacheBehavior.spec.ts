// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Source } from 'aws-cdk-lib/aws-s3-deployment';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { StaticWebsite } from '../website.js';

// The sibling website.spec.ts is entirely describe.skip'd because most of its assertions were
// written against a real built website/dist bundle, which isn't available in CI. These two tests
// only inspect the CloudFront/cache-policy resources StaticWebsite synthesizes — mocking
// Source.asset (the same pattern used in websiteStack.spec.ts) lets them run without that asset.
describe('StaticWebsite — public/leaderboards/* cache behavior', () => {
  let template: Template;
  let originalAsset: typeof Source.asset;

  beforeAll(() => {
    // Mocked before StaticWebsite is constructed below, in this same hook, since a per-test setup
    // hook would run too late here — after construction already needed the (nonexistent, in CI)
    // asset directory. The mock's bind() result needs a real bucket in the SAME app as the stack
    // under test (not undefined, and not a separate app) — this test calls Template.fromStack(),
    // which fully resolves every token, including BucketDeployment's reference to the source
    // bucket, and CDK rejects cross-app/cross-environment resource references during resolution.
    originalAsset = Source.asset;

    const app = new App();
    const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1' } });
    const mockSourceBucket = new Bucket(stack, 'MockSourceBucket');
    Source.asset = vi.fn().mockImplementation(() => ({
      bind: vi.fn().mockReturnValue({ bucket: mockSourceBucket, zipObjectKey: 'mock-key' }),
    })) as typeof Source.asset;

    const modelStorageBucket = new Bucket(stack, 'TestModelStorageBucket', {
      bucketName: 'test-model-storage-bucket',
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const uploadBucket = new Bucket(stack, 'TestUploadBucket', {
      bucketName: 'test-upload-bucket',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new StaticWebsite(stack, 'TestStaticWebsite', {
      apiEndpointUrl: 'https://api.example.com',
      identityPoolId: 'us-east-1:12345678-1234-1234-1234-123456789012',
      userPoolId: 'us-east-1_ABCDEFGHI',
      userPoolClientId: 'abcdefghijklmnopqrstuvwxyz',
      modelStorageBucket,
      uploadBucket,
      namespace: TEST_NAMESPACE,
      solutionVersion: 'v1.0.0',
    });

    template = Template.fromStack(stack);
  });

  afterAll(() => {
    Source.asset = originalAsset;
  });

  it('scopes a short-TTL cache policy to public/leaderboards/*, leaving the default behavior untouched', () => {
    template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
      CachePolicyConfig: Match.objectLike({
        DefaultTTL: 5,
        MaxTTL: 5,
        MinTTL: 0,
      }),
    });

    const distributions = template.findResources('AWS::CloudFront::Distribution');
    const [distribution] = Object.values(distributions);
    const cacheBehaviors = distribution.Properties.DistributionConfig.CacheBehaviors;
    expect(cacheBehaviors).toHaveLength(1);
    expect(cacheBehaviors[0].PathPattern).toBe('public/leaderboards/*');
    expect(cacheBehaviors[0].ViewerProtocolPolicy).toBe('redirect-to-https');
    // Must share the default behavior's origin (additionalBehaviors omit `origin`, auto-filled).
    expect(cacheBehaviors[0].TargetOriginId).toBe(
      distribution.Properties.DistributionConfig.DefaultCacheBehavior.TargetOriginId,
    );
  });

  it("excludes only the page's ?t= cache-buster from the cache key, so the 5s TTL still collapses concurrent requests at the edge", () => {
    // The public leaderboard page fetches with a ?t=${Date.now()} cache-buster (also meant to
    // defeat the browser's own HTTP cache). It must be excluded from the CDN cache key
    // specifically — forwarding ALL query strings (QueryStringBehavior "all") would make every
    // request's key unique, since ?t= is unique every time, defeating the 5s TTL's entire
    // load-absorbing purpose. denyList('t') synthesizes as "allExcept" with QueryStrings: ['t'].
    expect(() =>
      template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
        CachePolicyConfig: Match.objectLike({
          ParametersInCacheKeyAndForwardedToOrigin: Match.objectLike({
            QueryStringsConfig: Match.objectLike({ QueryStringBehavior: 'allExcept', QueryStrings: ['t'] }),
          }),
        }),
      }),
    ).not.toThrow();
  });

  it('attaches a dedicated ResponseHeadersPolicy carrying the same security headers as the default behavior', () => {
    const distributions = template.findResources('AWS::CloudFront::Distribution');
    const [distribution] = Object.values(distributions);
    const cacheBehaviors = distribution.Properties.DistributionConfig.CacheBehaviors;
    // additionalBehaviors aren't covered by the default behavior's responseHeadersPolicyProps.
    expect(cacheBehaviors[0].ResponseHeadersPolicyId).not.toEqual(
      distribution.Properties.DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId,
    );

    const policies = template.findResources('AWS::CloudFront::ResponseHeadersPolicy');
    expect(Object.keys(policies)).toHaveLength(2);
    const str = JSON.stringify(template.toJSON());
    expect(str).toContain("frame-ancestors 'none'");
  });
});

describe('StaticWebsite — deployment artifact exclusions', () => {
  let originalAsset: typeof Source.asset;

  afterEach(() => {
    Source.asset = originalAsset;
  });

  it('excludes dev/toolchain artifacts (MSW worker, package.json, source maps) from the deployed website asset', () => {
    originalAsset = Source.asset;

    const app = new App();
    const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1' } });
    const mockSourceBucket = new Bucket(stack, 'MockSourceBucket');
    // Constructed inside the test (not beforeAll) so the recorded call survives clearMocks.
    const assetSpy = vi.fn().mockImplementation(() => ({
      bind: vi.fn().mockReturnValue({ bucket: mockSourceBucket, zipObjectKey: 'mock-key' }),
    }));
    Source.asset = assetSpy as typeof Source.asset;

    const modelStorageBucket = new Bucket(stack, 'TestModelStorageBucket', { removalPolicy: RemovalPolicy.DESTROY });
    const uploadBucket = new Bucket(stack, 'TestUploadBucket', { removalPolicy: RemovalPolicy.DESTROY });

    new StaticWebsite(stack, 'TestStaticWebsite', {
      apiEndpointUrl: 'https://api.example.com',
      identityPoolId: 'us-east-1:12345678-1234-1234-1234-123456789012',
      userPoolId: 'us-east-1_ABCDEFGHI',
      userPoolClientId: 'abcdefghijklmnopqrstuvwxyz',
      modelStorageBucket,
      uploadBucket,
      namespace: TEST_NAMESPACE,
      solutionVersion: 'v1.0.0',
    });

    expect(assetSpy).toHaveBeenCalledWith(
      expect.stringContaining('website/dist'),
      expect.objectContaining({ exclude: ['mockServiceWorker.js', 'package.json', '**/*.map'] }),
    );
  });
});
