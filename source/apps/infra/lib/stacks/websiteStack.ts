// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnCondition, CfnParameter, Fn, NestedStack, NestedStackProps, Token } from 'aws-cdk-lib';
import { SpecRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { ApiCorsUpdate } from '#constructs/website/ApiCorsUpdate.js';
import { StaticWebsite } from '#constructs/website/website.js';

export interface WebsiteStackProps extends NestedStackProps {
  api: SpecRestApi;
  identityPoolId: string;
  userPoolId: string;
  userPoolClientId: string;
  modelStorageBucket: Bucket;
  uploadBucket: Bucket;
  namespace: string;
  customDomainParam: CfnParameter;
}

export class WebsiteStack extends NestedStack {
  constructor(scope: Construct, id: string, props: WebsiteStackProps) {
    super(scope, id, props);

    const { api, identityPoolId, userPoolId, modelStorageBucket, userPoolClientId, uploadBucket, namespace } = props;

    const website = new StaticWebsite(this, 'Website', {
      apiEndpointUrl: api.url,
      userPoolId,
      userPoolClientId,
      modelStorageBucket: modelStorageBucket,
      identityPoolId,
      uploadBucket,
      namespace,
    });

    const hasCustomDomain = new CfnCondition(this, 'HasCustomDomain', {
      expression: Fn.conditionNot(Fn.conditionEquals(props.customDomainParam.valueAsString, '')),
    });

    const allowedOrigin = Fn.conditionIf(
      hasCustomDomain.logicalId,
      props.customDomainParam.valueAsString,
      `https://${website.cloudFrontDomainName}`,
    );
    new ApiCorsUpdate(this, 'UpdateApiCors', {
      apiId: props.api.restApiId,
      allowedOrigin: Token.asString(allowedOrigin),
      namespace: props.namespace,
    });
  }
}
