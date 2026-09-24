// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Stack } from 'aws-cdk-lib';
import { Rule } from 'aws-cdk-lib/aws-events';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

import { addCfnGuardSuppression } from '../common/cfnGuardHelper.js';

/**
 * Every DeepRacer-onboarded managed instance is tagged `deepracer:managed = true` at
 * activation.
 */
const DEEPRACER_MANAGED_TAG_CONDITION = {
  StringEquals: { 'ssm:resourceTag/deepracer:managed': 'true' },
};

export interface DeviceManagementInfraProps {
  namespace: string;
}

/**
 * Device management infrastructure.
 */
export class DeviceManagementInfra extends Construct {
  /** Role 1: assumed by the SSM agent on physical devices after hybrid activation. */
  readonly ssmHybridActivationRole: Role;
  /** Role 2: Activation Lambda — device onboarding/deregistration. */
  readonly activationLambdaRole: Role;
  /** Role 3: Restart Command Lambda. */
  readonly restartCommandLambdaRole: Role;
  /** Role 4: Stop Command Lambda (single-path SSM RunCommand). */
  readonly stopCommandLambdaRole: Role;
  /** Role 5: Color Command Lambda. */
  readonly colorCommandLambdaRole: Role;
  /** Role 6: Pruning Lambda, triggered by the DDB Stream. */
  readonly pruningLambdaRole: Role;
  /** Disabled/untargeted scaffold for the future SSM State Change Handler (Task 5). */
  readonly ssmDeviceStateChangeRule: Rule;

  constructor(scope: Construct, id: string, props: DeviceManagementInfraProps) {
    super(scope, id);

    const { namespace } = props;
    const { region, account, partition } = Stack.of(this);

    const ssmManagedInstance = `arn:${partition}:ssm:${region}:${account}:managed-instance/*`;
    const ssmRunShellScriptDoc = `arn:${partition}:ssm:${region}::document/AWS-RunShellScript`;

    // --- Role 1: DeviceManagement-SSMHybridActivationRole ---
    this.ssmHybridActivationRole = new Role(this, 'SSMHybridActivationRole', {
      assumedBy: new ServicePrincipal('ssm.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });
    this.ssmHybridActivationRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:AddTagsToResource'],
        resources: [ssmManagedInstance],
        conditions: {
          ...DEEPRACER_MANAGED_TAG_CONDITION,
          'ForAllValues:StringEquals': { 'aws:TagKeys': ['CarType'] },
        },
      }),
    );
    addCfnGuardSuppression(this.ssmHybridActivationRole, ['IAM_NO_INLINE_POLICY_CHECK']);

    // --- Role 2: DeviceManagement-ActivationLambdaRole ---
    this.activationLambdaRole = new Role(this, 'ActivationLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    this.activationLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:CreateActivation', 'ssm:DeleteActivation'],
        resources: ['*'],
      }),
    );
    this.activationLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:AddTagsToResource'],
        resources: ['*'],
      }),
    );
    // Deregister only instances this solution onboarded (tagged deepracer:managed=true).
    this.activationLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:DeregisterManagedInstance'],
        resources: [ssmManagedInstance],
        conditions: DEEPRACER_MANAGED_TAG_CONDITION,
      }),
    );
    addCfnGuardSuppression(this.activationLambdaRole, ['IAM_NO_INLINE_POLICY_CHECK']);

    this.ssmHybridActivationRole.grantPassRole(this.activationLambdaRole);

    // --- Role 3: DeviceManagement-RestartCommandLambdaRole ---
    this.restartCommandLambdaRole = new Role(this, 'RestartCommandLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    this.restartCommandLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:SendCommand'],
        resources: [ssmRunShellScriptDoc],
      }),
    );
    this.restartCommandLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:SendCommand'],
        resources: [ssmManagedInstance],
        conditions: DEEPRACER_MANAGED_TAG_CONDITION,
      }),
    );
    this.restartCommandLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:GetCommandInvocation'],
        resources: ['*'],
      }),
    );
    addCfnGuardSuppression(this.restartCommandLambdaRole, ['IAM_NO_INLINE_POLICY_CHECK']);

    // --- Role 4: DeviceManagement-StopCommandLambdaRole ---
    this.stopCommandLambdaRole = new Role(this, 'StopCommandLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    this.stopCommandLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:SendCommand'],
        resources: [ssmRunShellScriptDoc],
      }),
    );
    this.stopCommandLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:SendCommand'],
        resources: [ssmManagedInstance],
        conditions: DEEPRACER_MANAGED_TAG_CONDITION,
      }),
    );
    this.stopCommandLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:GetCommandInvocation'],
        resources: ['*'],
      }),
    );
    addCfnGuardSuppression(this.stopCommandLambdaRole, ['IAM_NO_INLINE_POLICY_CHECK']);

    // --- Role 5: DeviceManagement-ColorCommandLambdaRole ---
    this.colorCommandLambdaRole = new Role(this, 'ColorCommandLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    this.colorCommandLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:SendCommand'],
        resources: [ssmRunShellScriptDoc],
      }),
    );
    this.colorCommandLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:SendCommand'],
        resources: [ssmManagedInstance],
        conditions: DEEPRACER_MANAGED_TAG_CONDITION,
      }),
    );
    this.colorCommandLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:GetCommandInvocation'],
        resources: ['*'],
      }),
    );
    addCfnGuardSuppression(this.colorCommandLambdaRole, ['IAM_NO_INLINE_POLICY_CHECK']);

    // --- Role 6: DeviceManagement-PruningLambdaRole ---
    this.pruningLambdaRole = new Role(this, 'PruningLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    this.pruningLambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:DeregisterManagedInstance'],
        resources: [ssmManagedInstance],
        conditions: DEEPRACER_MANAGED_TAG_CONDITION,
      }),
    );
    addCfnGuardSuppression(this.pruningLambdaRole, ['IAM_NO_INLINE_POLICY_CHECK']);

    this.ssmDeviceStateChangeRule = new Rule(this, 'SSMDeviceStateChangeRule', {
      ruleName: `${namespace}-DeviceManagement-SSMDeviceStateChangeRule`,
      eventPattern: {
        source: ['aws.ssm'],
        detailType: [
          'EC2 Instance-Associated Configuration Change',
          'EC2 Command Invocation Status-change Notification',
        ],
      },
      enabled: false,
    });
  }
}
