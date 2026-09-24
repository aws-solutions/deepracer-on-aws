// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { DeviceManagementInfra } from '../deviceManagementInfra.js';

describe('DeviceManagementInfra', () => {
  const app = new App();
  const stack = new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'us-east-1' } });

  new DeviceManagementInfra(stack, 'DeviceManagementInfra', {
    namespace: TEST_NAMESPACE,
  });

  const template = Template.fromStack(stack);

  describe('IAM roles', () => {
    it('creates exactly 6 IAM roles', () => {
      const roles = template.findResources('AWS::IAM::Role');
      expect(Object.keys(roles)).toHaveLength(6);
    });

    it('creates the SSMHybridActivationRole trusted by ssm.amazonaws.com with the managed instance core policy', () => {
      expect(() =>
        template.hasResourceProperties('AWS::IAM::Role', {
          AssumeRolePolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({ Effect: 'Allow', Principal: { Service: 'ssm.amazonaws.com' } }),
            ]),
          },
          ManagedPolicyArns: Match.arrayWith([
            Match.objectLike({
              'Fn::Join': Match.arrayWith([
                Match.arrayWith([Match.stringLikeRegexp('.*AmazonSSMManagedInstanceCore.*')]),
              ]),
            }),
          ]),
        }),
      ).not.toThrow();
    });

    it('creates the ActivationLambdaRole with CreateActivation/DeleteActivation/DeregisterManagedInstance', () => {
      expect(() =>
        template.hasResourceProperties('AWS::IAM::Role', {
          AssumeRolePolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' } }),
            ]),
          },
        }),
      ).not.toThrow();

      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Effect: 'Allow',
                Action: ['ssm:CreateActivation', 'ssm:DeleteActivation'],
              }),
            ]),
          },
        }),
      ).not.toThrow();
    });

    it('grants iam:PassRole on SSMHybridActivationRole to the ActivationLambdaRole', () => {
      // ssm:CreateActivation takes IamRole=<hybridActivationRole.roleName>; without
      // iam:PassRole on that role, CreateActivation fails at runtime with
      // AccessDeniedException. Regression guard for AutoSDE finding f-b09935bb.
      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Effect: 'Allow',
                Action: 'iam:PassRole',
                Resource: Match.objectLike({
                  'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('.*SSMHybridActivationRole.*')]),
                }),
              }),
            ]),
          },
        }),
      ).not.toThrow();
    });

    it('creates the RestartCommandLambdaRole with SendCommand/GetCommandInvocation', () => {
      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({ Effect: 'Allow', Action: 'ssm:SendCommand' }),
              Match.objectLike({ Effect: 'Allow', Action: 'ssm:GetCommandInvocation' }),
            ]),
          },
        }),
      ).not.toThrow();
    });

    it('creates the StopCommandLambdaRole with single-path SSM SendCommand + GetCommandInvocation (no IoT publish)', () => {
      const policies = template.findResources('AWS::IAM::Policy');
      const allStopStatements = Object.values(policies).flatMap(
        (p) => p.Properties.PolicyDocument.Statement as Array<{ Effect: string; Action: unknown; Resource: unknown }>,
      );

      // SSM SendCommand present (dispatch mechanism)
      const sendCommand = allStopStatements.find(
        (s) => s.Action === 'ssm:SendCommand' || (Array.isArray(s.Action) && s.Action.includes('ssm:SendCommand')),
      );
      expect(sendCommand).toBeDefined();

      // SSM GetCommandInvocation present (result fetch by State Change Handler)
      const getInvocation = allStopStatements.find((s) => s.Action === 'ssm:GetCommandInvocation');
      expect(getInvocation).toBeDefined();

      // Regression guard: iot:Publish must NOT appear anywhere in the template's IAM policies
      const iotPublish = allStopStatements.find(
        (s) => s.Action === 'iot:Publish' || (Array.isArray(s.Action) && s.Action.includes('iot:Publish')),
      );
      expect(iotPublish).toBeUndefined();
    });

    it('creates the ColorCommandLambdaRole with SendCommand/GetCommandInvocation', () => {
      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({ Effect: 'Allow', Action: 'ssm:SendCommand' }),
              Match.objectLike({ Effect: 'Allow', Action: 'ssm:GetCommandInvocation' }),
            ]),
          },
        }),
      ).not.toThrow();
    });

    it('creates the PruningLambdaRole with DeregisterManagedInstance only', () => {
      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyDocument: {
            Statement: [Match.objectLike({ Effect: 'Allow', Action: 'ssm:DeregisterManagedInstance' })],
          },
        }),
      ).not.toThrow();
    });

    it('does not create a 7th role or any log-fetch related grants', () => {
      const roles = template.findResources('AWS::IAM::Role');
      expect(Object.keys(roles)).toHaveLength(6);

      const policies = template.findResources('AWS::IAM::Policy');
      const allStatements = Object.values(policies).flatMap(
        (p) => p.Properties.PolicyDocument.Statement as Array<{ Action: unknown }>,
      );
      const allActions = allStatements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
      expect(allActions.some((a) => typeof a === 'string' && a.startsWith('s3:'))).toBe(false);
    });

    it('grants no iot:* permission on any device-management role (SSM-only device architecture)', () => {
      // Devices never connect to IoT Core. This regression
      // guard catches any re-introduction of iot:Connect/Subscribe/Receive on the hybrid
      // activation role or iot:Publish on any command Lambda role.
      const policies = template.findResources('AWS::IAM::Policy');
      const allStatements = Object.values(policies).flatMap(
        (p) => p.Properties.PolicyDocument.Statement as Array<{ Action: unknown }>,
      );
      const allActions = allStatements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
      const iotActions = allActions.filter((a) => typeof a === 'string' && a.startsWith('iot:'));
      expect({ iotActions }).toEqual({ iotActions: [] });
    });

    it('adds ssm:AddTagsToResource to the ActivationLambdaRole for CreateActivation tagging', () => {
      // CreateActivation carries the deepracer:managed=true tag; passing tags requires ssm:AddTagsToResource.
      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          PolicyDocument: {
            Statement: Match.arrayWith([Match.objectLike({ Effect: 'Allow', Action: 'ssm:AddTagsToResource' })]),
          },
        }),
      ).not.toThrow();
    });

    it('grants the SSMHybridActivationRole scoped ssm:AddTagsToResource so a device can self-tag its CarType', () => {
      // The device (assuming the hybrid activation role) tags its own managed instance with a
      // CarType tag after registration; the poller reads it into the device row. Scoped to
      // managed-instance/* + deepracer:managed=true so a device can only ever tag itself.
      const policies = template.findResources('AWS::IAM::Policy');
      const statements = Object.values(policies).flatMap(
        (p) =>
          p.Properties.PolicyDocument.Statement as Array<{ Action: unknown; Resource: unknown; Condition?: unknown }>,
      );
      const scopedAddTags = statements.filter(
        (s) =>
          (s.Action === 'ssm:AddTagsToResource' ||
            (Array.isArray(s.Action) && s.Action.includes('ssm:AddTagsToResource'))) &&
          JSON.stringify(s.Resource).includes('managed-instance/*'),
      );
      // Exactly one: the hybrid-activation role's self-tag grant (the ActivationLambdaRole's
      // AddTagsToResource is resource '*' for CreateActivation and is not counted here).
      expect(scopedAddTags).toHaveLength(1);
      // Scoped to onboarded instances AND restricted to the CarType key only, so a device
      // cannot overwrite the Type/Name/fleetId tags the poller trusts.
      expect(scopedAddTags[0].Condition).toEqual({
        StringEquals: { 'ssm:resourceTag/deepracer:managed': 'true' },
        'ForAllValues:StringEquals': { 'aws:TagKeys': ['CarType'] },
      });
    });

    it('gates every mutating managed-instance action with the deepracer:managed tag condition (Finding 6)', () => {
      // Hard GA requirement (Epic 1 PE Finding 6): the device-management roles must not be
      // able to SendCommand to / deregister arbitrary managed instances — only those this
      // solution onboarded (tagged deepracer:managed=true). This guard fails if any future
      // change reintroduces a blanket managed-instance/* grant on these actions.
      const tagCondition = { StringEquals: { 'ssm:resourceTag/deepracer:managed': 'true' } };
      const policies = template.findResources('AWS::IAM::Policy');
      const statements = Object.values(policies).flatMap(
        (p) =>
          p.Properties.PolicyDocument.Statement as Array<{ Action: unknown; Resource: unknown; Condition?: unknown }>,
      );

      const targetsManagedInstance = (s: { Resource: unknown }) =>
        JSON.stringify(s.Resource).includes('managed-instance/*');
      const hasAction = (s: { Action: unknown }, action: string) =>
        s.Action === action || (Array.isArray(s.Action) && s.Action.includes(action));

      const mutatingInstanceStatements = statements.filter(
        (s) =>
          targetsManagedInstance(s) &&
          (hasAction(s, 'ssm:SendCommand') || hasAction(s, 'ssm:DeregisterManagedInstance')),
      );

      // Roles 3/4/5 (SendCommand) + Roles 2/6 (DeregisterManagedInstance) = 5 gated statements.
      expect(mutatingInstanceStatements).toHaveLength(5);
      for (const statement of mutatingInstanceStatements) {
        expect(statement.Condition).toEqual(tagCondition);
      }
    });

    it('keeps the SendCommand-on-document statements unconditioned (would otherwise deny all sends)', () => {
      // The tag lives on the instance, not the AWS-RunShellScript document; conditioning the
      // document statement on it would deny every SendCommand. Split-statement pattern
      // (AWS Run Command tag-restriction guidance).
      const policies = template.findResources('AWS::IAM::Policy');
      const statements = Object.values(policies).flatMap(
        (p) =>
          p.Properties.PolicyDocument.Statement as Array<{ Action: unknown; Resource: unknown; Condition?: unknown }>,
      );
      const documentSendStatements = statements.filter(
        (s) =>
          (s.Action === 'ssm:SendCommand' || (Array.isArray(s.Action) && s.Action.includes('ssm:SendCommand'))) &&
          JSON.stringify(s.Resource).includes('document/AWS-RunShellScript'),
      );
      // One per command role (restart, stop, color).
      expect(documentSendStatements).toHaveLength(3);
      for (const statement of documentSendStatements) {
        expect(statement.Condition).toBeUndefined();
      }
    });
  });

  describe('No device-side IoT resources (design v4 §4.11.3, §4.11.5)', () => {
    it('creates no AWS::IoT::Policy — devices do not connect to IoT Core', () => {
      const iotPolicies = template.findResources('AWS::IoT::Policy');
      expect(Object.keys(iotPolicies)).toHaveLength(0);
    });
  });

  describe('EventBridge scaffold (Task 5 placeholder)', () => {
    it('creates the SSMDeviceStateChangeRule disabled with no targets', () => {
      expect(() =>
        template.hasResourceProperties('AWS::Events::Rule', {
          Name: `${TEST_NAMESPACE}-DeviceManagement-SSMDeviceStateChangeRule`,
          State: 'DISABLED',
          EventPattern: {
            source: ['aws.ssm'],
            'detail-type': [
              'EC2 Instance-Associated Configuration Change',
              'EC2 Command Invocation Status-change Notification',
            ],
          },
        }),
      ).not.toThrow();

      const rules = template.findResources('AWS::Events::Rule');
      const rule = Object.values(rules)[0];
      expect(rule.Properties.Targets).toBeUndefined();
    });
  });
});
