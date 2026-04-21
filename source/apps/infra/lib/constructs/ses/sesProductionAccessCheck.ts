// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { CfnCondition, CfnResource, CustomResource, Duration } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct, IConstruct } from 'constructs';

import { addCfnGuardSuppressionForAutoCreatedLambdas } from '#constructs/common/cfnGuardHelper.js';

import { LogGroupCategory } from '../common/logGroupsHelper.js';
import { functionNamePrefix, NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

export interface SesProductionAccessCheckProps {
  namespace: string;
  emailDeliveryMethod: string;
  sesVerifiedEmail: string;
  isSesEnabled?: CfnCondition;
}

/**
 * Verifies the AWS account has SES production access before deployment proceeds.
 * When isSesEnabled is provided, all resources are conditioned so they are only
 * created when SES delivery is selected — avoiding unnecessary Lambdas, roles,
 * and custom resource invocations for Cognito-only deployments.
 */
export class SesProductionAccessCheck extends Construct {
  constructor(
    scope: Construct,
    id: string,
    { namespace, emailDeliveryMethod, sesVerifiedEmail, isSesEnabled }: SesProductionAccessCheckProps,
  ) {
    super(scope, id);

    // Calls ses:GetAccount, fails if production access not enabled
    const checkFunction = new NodeLambdaFunction(this, 'SesProductionAccessCheckFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/ses/handlers/sesProductionAccessCheck.ts'),
      functionName: `${functionNamePrefix}-SesProductionAccessCheck`,
      logGroupCategory: LogGroupCategory.SYSTEM_EVENTS,
      namespace,
      timeout: Duration.seconds(30),
    });

    // ses:GetAccount requires '*' resource
    checkFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['ses:GetAccount'],
        resources: ['*'],
      }),
    );

    const provider = new Provider(this, 'SesProductionAccessCheckProvider', {
      onEventHandler: checkFunction,
    });

    new CustomResource(this, 'SesProductionAccessCheckResource', {
      serviceToken: provider.serviceToken,
      properties: {
        emailDeliveryMethod,
        sesVerifiedEmail,
        // Timestamp forces re-check on every deployment
        forceUpdate: Date.now().toString(),
      },
    });

    addCfnGuardSuppressionForAutoCreatedLambdas(this, 'SesProductionAccessCheckProvider');

    // Apply the condition to every CloudFormation resource in this construct tree
    // so none of them are created when SES is not selected.
    if (isSesEnabled) {
      this.applyConditionToAllResources(isSesEnabled);
    }
  }

  private applyConditionToAllResources(condition: CfnCondition): void {
    const allResources: CfnResource[] = [];
    const collect = (current: IConstruct) => {
      if (current instanceof CfnResource) {
        allResources.push(current);
      }
      for (const child of current.node.children) {
        collect(child);
      }
    };
    collect(this);

    for (const resource of allResources) {
      resource.cfnOptions.condition = condition;
    }
  }
}
