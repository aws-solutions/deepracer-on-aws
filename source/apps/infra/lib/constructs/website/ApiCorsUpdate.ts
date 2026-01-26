// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { CustomResource, Duration } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

import { addCfnGuardSuppressionForAutoCreatedLambdas } from '#constructs/common/cfnGuardHelper.js';

import { LogGroupCategory } from '../common/logGroupsHelper.js';
import { functionNamePrefix, NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

export interface ApiCorsUpdateProps {
  apiId: string;
  allowedOrigin: string;
  namespace: string;
}

export class ApiCorsUpdate extends Construct {
  constructor(scope: Construct, id: string, { apiId, allowedOrigin, namespace }: ApiCorsUpdateProps) {
    super(scope, id);

    const updateCorsFunction = new NodeLambdaFunction(this, 'UpdateCorsFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/api/cors/UpdateApiCors.ts'),
      functionName: `${functionNamePrefix}-UpdateApiCors`,
      logGroupCategory: LogGroupCategory.SYSTEM_EVENTS,
      namespace,
      timeout: Duration.minutes(5),
    });

    updateCorsFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['apigateway:GET', 'apigateway:PUT', 'apigateway:PATCH', 'apigateway:POST'],
        resources: [`arn:aws:apigateway:*::/restapis/${apiId}`, `arn:aws:apigateway:*::/restapis/${apiId}/*`],
      }),
    );

    const provider = new Provider(this, 'UpdateCorsProvider', {
      onEventHandler: updateCorsFunction,
    });

    new CustomResource(this, 'UpdateCorsResource', {
      serviceToken: provider.serviceToken,
      properties: {
        apiId,
        allowedOrigin,
        // forces an update of the CR whenever a new template is synthesized
        forceUpdate: Date.now().toString(),
      },
    });
    addCfnGuardSuppressionForAutoCreatedLambdas(this, 'UpdateCorsProvider');
  }
}
