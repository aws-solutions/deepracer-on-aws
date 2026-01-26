// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnResource, Stack } from 'aws-cdk-lib';
import type { Construct, IConstruct } from 'constructs';

export function addCfnGuardSuppression(construct: IConstruct, suppressions: string[]) {
  const cfnResource = construct.node.defaultChild as CfnResource;
  if (!cfnResource?.cfnOptions) {
    throw new Error(`Resource ${cfnResource?.logicalId} has no cfnOptions, unable to add cfn-guard suppression`);
  }
  const existingSuppressions: string[] = cfnResource.cfnOptions.metadata?.guard?.SuppressedRules;
  if (existingSuppressions) {
    existingSuppressions.push(...suppressions);
  } else {
    cfnResource.cfnOptions.metadata = {
      ...cfnResource.cfnOptions.metadata,
      guard: {
        SuppressedRules: [...suppressions],
      },
    };
  }
}

/**
 * Finds and suppresses CFN Guard rules for CDK auto-created IAM roles which
 * aren't as a public attribute and that node doesn't have a defaultChild as a CfnResource
 */
export function addCfnGuardSuppressionForAutoCreatedRoles(scope: Construct, pathId: string): void {
  // find the resource from the stack and by traversing the node tree as it is created on the stack level
  const cdkAutoCreatedRoles = Stack.of(scope)
    .node.findAll()
    .filter((node) => {
      return (node as CfnResource).cfnResourceType === 'AWS::IAM::Role' && node.node.path.includes(pathId);
    }) as CfnResource[];

  if (cdkAutoCreatedRoles.length >= 1) {
    // Apply suppression to all IAM roles found with the pathId
    cdkAutoCreatedRoles.forEach((role) => {
      role.addMetadata('guard', {
        SuppressedRules: ['IAM_NO_INLINE_POLICY_CHECK'],
      });
    });
  } else {
    console.error(
      `Can't find any IAM roles auto created by cdk, unable to add cfn-guard suppression with pathId = ${pathId}`,
    );
  }
}

/**
 * Finds and suppresses CFN Guard rules cdk auto created functions which
 * aren't as a public attribute and that node doesn't have a defaultChild as a CfnResource
 */
export function addCfnGuardSuppressionForAutoCreatedLambdas(scope: Construct, pathId: string): void {
  // find the resource from the stack and by traversing the node tree as it is created on the stack level
  const cdkAutoCreatedLambdas = Stack.of(scope)
    .node.findAll()
    .filter((node) => {
      return (node as CfnResource).cfnResourceType === 'AWS::Lambda::Function' && node.node.path.includes(pathId);
    }) as CfnResource[];

  if (cdkAutoCreatedLambdas.length >= 1) {
    cdkAutoCreatedLambdas.forEach((lambdaFunction) => {
      lambdaFunction.addMetadata('guard', {
        SuppressedRules: ['LAMBDA_INSIDE_VPC', 'LAMBDA_CONCURRENCY_CHECK'],
      });
    });
  } else {
    throw new Error(
      `Can't find the lambda function auto created by cdk, unable to add cfn-guard suppression with pathId = ${pathId}`,
    );
  }
}
