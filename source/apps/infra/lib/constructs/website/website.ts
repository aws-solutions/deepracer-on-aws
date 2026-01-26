// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { CloudFrontToS3 } from '@aws-solutions-constructs/aws-cloudfront-s3';
import { CfnOutput, CustomResource, Duration, Stack } from 'aws-cdk-lib';
import { DistributionProps, HeadersFrameOption, HeadersReferrerPolicy } from 'aws-cdk-lib/aws-cloudfront';
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
}

export class StaticWebsite extends Construct {
  public readonly cloudFrontDomainName: string;

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
    } = props;

    const region = Stack.of(this).region;

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
      } satisfies Partial<DistributionProps>,
      insertHttpSecurityHeaders: false,
      responseHeadersPolicyProps: {
        responseHeadersPolicyName: `${namespace}SecurityHeadersPolicy-${region}`,
        securityHeadersBehavior: {
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
              `connect-src 'self' blob: ${apiEndpointUrl} https://cognito-idp.${region}.amazonaws.com https://cognito-identity.${region}.amazonaws.com https://*.kinesisvideo.${region}.amazonaws.com https://${uploadBucket.bucketRegionalDomainName} https://${modelStorageBucket.bucketRegionalDomainName} https://www.gstatic.com/draco/versioned/decoders/`,
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
        },
        customHeadersBehavior: {
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
        },
      },
    });

    const websiteDistPath = path.join(__dirname, '../../../../website/dist');

    new BucketDeployment(this, 'DeployWebsite', {
      destinationBucket: cloudFrontToS3.s3Bucket as Bucket,
      distribution: cloudFrontToS3.cloudFrontWebDistribution,
      memoryLimit: 2048, // increased due to timeouts occurring at 512
      sources: [Source.asset(websiteDistPath)],
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
    };

    const envConfigContents = `window.EnvironmentConfig = ${JSON.stringify(environmentConfig)};`;

    new CustomResource(this, 'CreateEnvFileResource', {
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

    addCfnGuardSuppressionForAutoCreatedLambdas(this, 'CreateEnvFileProvider');

    this.cloudFrontDomainName = cloudFrontToS3.cloudFrontWebDistribution.domainName;

    new CfnOutput(this, 'Url', {
      value: 'https://' + this.cloudFrontDomainName,
    });
  }
}
