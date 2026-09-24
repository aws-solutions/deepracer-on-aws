// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { CloudFrontToS3 } from '@aws-solutions-constructs/aws-cloudfront-s3';
import { CfnCondition, CfnOutput, CustomResource, Duration, Fn, Stack } from 'aws-cdk-lib';
import {
  BehaviorOptions,
  CachePolicy,
  CacheQueryStringBehavior,
  CfnDistribution,
  DistributionProps,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

import { LogGroupCategory } from '#constructs/common/logGroupsHelper.js';
import { functionNamePrefix, NodeLambdaFunction } from '#constructs/common/nodeLambdaFunction.js';

import { addCfnGuardSuppressionForAutoCreatedLambdas } from '../common/cfnGuardHelper.js';

interface StaticWebsiteProps {
  apiEndpointUrl: string;
  identityPoolId: string;
  userPoolId: string;
  userPoolClientId: string;
  modelStorageBucket: Bucket;
  uploadBucket: Bucket;
  namespace: string;
  solutionVersion: string;
  iotEndpoint?: string;
}

export class StaticWebsite extends Construct {
  public readonly cloudFrontDomainName: string;
  public readonly s3Bucket: Bucket;

  constructor(scope: Construct, id: string, props: StaticWebsiteProps) {
    super(scope, id);

    const {
      apiEndpointUrl,
      identityPoolId,
      userPoolId,
      userPoolClientId,
      modelStorageBucket,
      uploadBucket,
      namespace,
      solutionVersion,
      iotEndpoint,
    } = props;

    const region = Stack.of(this).region;

    // Regions that don't support CloudFront legacy access logging (opt-in regions)
    const unsupportedLoggingRegions = [
      'af-south-1', // Cape Town
      'ap-east-1', // Hong Kong
      'ap-south-2', // Hyderabad
      'ap-southeast-3', // Jakarta
      'ap-southeast-4', // Melbourne
      'ca-west-1', // Calgary
      'eu-central-2', // Zurich
      'eu-south-1', // Milan
      'eu-south-2', // Spain
      'il-central-1', // Tel Aviv
      'me-central-1', // UAE
      'me-south-1', // Bahrain
    ];

    const supportsCloudFrontLogging = new CfnCondition(this, 'SupportsCloudFrontLogging', {
      expression: Fn.conditionNot(
        Fn.conditionOr(
          ...unsupportedLoggingRegions.map((unsupportedRegion) =>
            Fn.conditionEquals(Fn.ref('AWS::Region'), unsupportedRegion),
          ),
        ),
      ),
    });

    // Shared with the public/leaderboards/* additionalBehavior below — additionalBehaviors
    // aren't covered by responseHeadersPolicyProps, which only attaches to the default behavior.
    const securityHeadersBehavior = {
      contentSecurityPolicy: {
        contentSecurityPolicy: [
          "base-uri 'none'",
          "default-src 'none'",
          "frame-ancestors 'none'",
          "font-src 'self' data:",
          "img-src 'self' data:",
          `media-src 'self' blob: https://${modelStorageBucket.bucketRegionalDomainName}`,
          "object-src 'none'",
          "style-src 'self'",
          "script-src 'self' 'wasm-unsafe-eval'",
          "worker-src 'self' blob:",
          `connect-src 'self' blob: ${apiEndpointUrl} https://cognito-idp.${region}.amazonaws.com https://cognito-identity.${region}.amazonaws.com https://*.kinesisvideo.${region}.amazonaws.com https://${uploadBucket.bucketRegionalDomainName} https://${modelStorageBucket.bucketRegionalDomainName} https://www.gstatic.com/draco/versioned/decoders/ https://api.github.com${iotEndpoint ? ` wss://${iotEndpoint}` : ''}`,
          'upgrade-insecure-requests',
        ].join('; '),
        override: true,
      },
      contentTypeOptions: {
        override: true,
      },
      frameOptions: {
        frameOption: HeadersFrameOption.DENY,
        override: true,
      },
      referrerPolicy: {
        referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
        override: true,
      },
      strictTransportSecurity: {
        accessControlMaxAge: Duration.seconds(47304000),
        includeSubdomains: true,
        preload: true,
        override: true,
      },
      xssProtection: {
        protection: true,
        modeBlock: true,
        override: true,
      },
    };
    const customHeadersBehavior = {
      customHeaders: [
        {
          header: 'Cache-Control',
          value: 'no-cache,no-store',
          override: true,
        },
        {
          header: 'Cross-Origin-Opener-Policy',
          value: 'same-origin',
          override: true,
        },
      ],
    };

    const publicLeaderboardResponseHeadersPolicy = new ResponseHeadersPolicy(this, 'PublicLeaderboardHeadersPolicy', {
      responseHeadersPolicyName: `${namespace}PublicLeaderboardHeadersPolicy-${region}`,
      securityHeadersBehavior,
      customHeadersBehavior,
    });

    const cloudFrontToS3 = new CloudFrontToS3(this, 'CloudFrontToS3', {
      cloudFrontDistributionProps: {
        defaultRootObject: 'index.html',
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
        ],
        // public/leaderboards/*.json needs a short cache TTL — the default behavior's managed
        // CachingOptimized policy ignores the S3 object's own Cache-Control and can serve a
        // stale, pre-race leaderboard for up to 24h. `origin` is omitted so CloudFrontToS3's
        // helper auto-fills it, avoiding a second S3 origin (the `as BehaviorOptions` cast below
        // works around CDK's type requiring `origin` even though the runtime helper does not).
        additionalBehaviors: {
          'public/leaderboards/*': {
            cachePolicy: new CachePolicy(this, 'PublicLeaderboardCachePolicy', {
              cachePolicyName: `${namespace}PublicLeaderboardCachePolicy-${region}`,
              comment: 'Short TTL so newly-published race results are never served stale from the edge.',
              defaultTtl: Duration.seconds(5),
              minTtl: Duration.seconds(0),
              maxTtl: Duration.seconds(5),
              // The public leaderboard page fetches with a ?t= cache-buster to also defeat the
              // browser's own HTTP cache. It must NOT be forwarded to the CDN cache key though —
              // it's unique on every request, so CacheQueryStringBehavior.all() would make every
              // request a guaranteed cache miss, defeating this policy's entire 5s-TTL purpose.
              // denyList('t') excludes just that param, so same-URL requests within the 5s window
              // still share a cache hit at the edge, while the buster still reaches the browser.
              queryStringBehavior: CacheQueryStringBehavior.denyList('t'),
            }),
            // additionalBehaviors aren't covered by the construct's default-behavior-only
            // responseHeadersPolicyProps, so this path needs its own copy of the security headers.
            responseHeadersPolicy: publicLeaderboardResponseHeadersPolicy,
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          } satisfies Omit<BehaviorOptions, 'origin'> as unknown as BehaviorOptions,
        },
      } satisfies Partial<DistributionProps>,
      insertHttpSecurityHeaders: false,
      responseHeadersPolicyProps: {
        responseHeadersPolicyName: `${namespace}SecurityHeadersPolicy-${region}`,
        securityHeadersBehavior,
        customHeadersBehavior,
      },
    });

    // Conditionally disable CloudFront logging in unsupported regions (opt-in regions)
    const cfnDistribution = cloudFrontToS3.cloudFrontWebDistribution.node.defaultChild as CfnDistribution;
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.Logging',
      Fn.conditionIf(
        supportsCloudFrontLogging.logicalId,
        {
          Bucket: cloudFrontToS3.cloudFrontLoggingBucket?.bucketDomainName,
          IncludeCookies: false,
        },
        Fn.ref('AWS::NoValue'),
      ),
    );

    const websiteDistPath = path.join(__dirname, '../../../../website/dist');

    const websiteDeployment = new BucketDeployment(this, 'DeployWebsite', {
      destinationBucket: cloudFrontToS3.s3Bucket as Bucket,
      distribution: cloudFrontToS3.cloudFrontWebDistribution,
      memoryLimit: 2048, // increased due to timeouts occurring at 512
      // Keep dev/toolchain artifacts out of the public origin: Vite copies public/* (incl. the MSW
      // worker) into dist/, and the build also emits package.json/source maps. Excluding them from
      // the asset means they are never uploaded and are pruned from the bucket on deploy.
      sources: [Source.asset(websiteDistPath, { exclude: ['mockServiceWorker.js', 'package.json', '**/*.map'] })],
      // The live-race broadcast handler writes public/leaderboards/*.json into this same
      // bucket at runtime (for the unauthenticated leaderboard page's initial S3 hydration).
      // Exclude that prefix from the deployment's prune so those files survive future deploys.
      exclude: ['public/leaderboards/*'],
    });

    addCfnGuardSuppressionForAutoCreatedLambdas(this, 'CDKBucketDeployment');

    // Custom resource to add the env file to the static website bucket
    const envFileFn = new NodeLambdaFunction(this, 'CreateWebsiteEnvFile', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/s3/handlers/createWebsiteEnvFile.ts'),
      functionName: `${functionNamePrefix}-CreateWebsiteEnvFile`,
      logGroupCategory: LogGroupCategory.SYSTEM_EVENTS,
      namespace,
      timeout: Duration.minutes(1),
    });

    envFileFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:PutObject', 's3:PutObjectAcl'],
        resources: [`${cloudFrontToS3.s3Bucket?.bucketArn}/*`],
      }),
    );

    // Add CloudFront invalidation permissions
    envFileFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['cloudfront:CreateInvalidation'],
        resources: [cloudFrontToS3.cloudFrontWebDistribution.distributionArn],
      }),
    );

    const createEnvFileProvider = new Provider(this, 'CreateEnvFileProvider', {
      onEventHandler: envFileFn,
    });

    const environmentConfig = {
      apiEndpointUrl: apiEndpointUrl,
      userPoolId,
      userPoolClientId,
      identityPoolId,
      region,
      uploadBucketName: uploadBucket.bucketName,
      iotEndpoint,
      solutionVersion,
      namespace,
    };

    const envConfigContents = `window.EnvironmentConfig = ${JSON.stringify(environmentConfig)};`;

    const envFileResource = new CustomResource(this, 'CreateEnvFileResource', {
      serviceToken: createEnvFileProvider.serviceToken,
      properties: {
        bucketName: cloudFrontToS3.s3Bucket?.bucketName,
        fileName: 'env.js',
        fileContent: envConfigContents,
        namespace: namespace,
        distributionId: cloudFrontToS3.cloudFrontWebDistribution.distributionId,
        forceUpdate: Date.now().toString(),
      },
    });

    // Ensure env.js is written AFTER BucketDeployment (which prunes unknown files)
    envFileResource.node.addDependency(websiteDeployment);

    addCfnGuardSuppressionForAutoCreatedLambdas(this, 'CreateEnvFileProvider');

    this.cloudFrontDomainName = cloudFrontToS3.cloudFrontWebDistribution.domainName;
    this.s3Bucket = cloudFrontToS3.s3Bucket as Bucket;

    new CfnOutput(this, 'Url', {
      value: 'https://' + this.cloudFrontDomainName,
    });
  }
}
