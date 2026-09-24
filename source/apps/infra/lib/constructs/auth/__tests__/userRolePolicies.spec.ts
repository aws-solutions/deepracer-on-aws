// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ApiDefinition, SpecRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { describe, it, expect } from 'vitest';

import { UserRoles } from '../userIdentity';
import { UserRolePolicies } from '../userRolePolicies';

describe('UserRolePolicies', () => {
  it('should match snapshot', () => {
    const stack = new Stack(undefined, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });

    const api = new SpecRestApi(stack, 'TestApi', {
      apiDefinition: ApiDefinition.fromInline({
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }),
    });

    const adminRole = new Role(stack, 'AdminRole', {
      assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
    });

    const raceFacilitatorRole = new Role(stack, 'RaceFacilitatorRole', {
      assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
    });

    const racerRole = new Role(stack, 'RacerRole', {
      assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
    });

    const commentatorRole = new Role(stack, 'CommentatorRole', {
      assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
    });

    const registrationManagerRole = new Role(stack, 'RegistrationManagerRole', {
      assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
    });

    const userRoles: UserRoles = {
      adminRole,
      raceFacilitatorRole,
      racerRole,
      commentatorRole,
      registrationManagerRole,
    };

    new UserRolePolicies(stack, 'TestUserRolePolicies', {
      api,
      userRoles,
      uploadBucketArn: 'arn:aws:s3:::test-bucket',
      namespace: 'test-namespace',
    });

    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });

  describe('countdown topic publish permission (FR-26, NFR-12)', () => {
    const buildStack = () => {
      const stack = new Stack(undefined, 'TestStack', {
        env: { account: '123456789012', region: 'us-east-1' },
      });

      const api = new SpecRestApi(stack, 'TestApi', {
        apiDefinition: ApiDefinition.fromInline({
          swagger: '2.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {},
        }),
      });

      const adminRole = new Role(stack, 'AdminRole', {
        assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
      });
      const raceFacilitatorRole = new Role(stack, 'RaceFacilitatorRole', {
        assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
      });
      const racerRole = new Role(stack, 'RacerRole', {
        assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
      });
      const commentatorRole = new Role(stack, 'CommentatorRole', {
        assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
      });
      const registrationManagerRole = new Role(stack, 'RegistrationManagerRole', {
        assumedBy: new ServicePrincipal('cognito-identity.amazonaws.com'),
      });

      const userRoles: UserRoles = {
        adminRole,
        raceFacilitatorRole,
        racerRole,
        commentatorRole,
        registrationManagerRole,
      };

      new UserRolePolicies(stack, 'TestUserRolePolicies', {
        api,
        userRoles,
        uploadBucketArn: 'arn:aws:s3:::test-bucket',
        namespace: 'test-namespace',
      });

      return { stack, userRoles };
    };

    type SynthesizedPolicy = {
      Properties: {
        Roles?: unknown[];
        PolicyDocument?: { Statement?: SynthesizedStatement[] };
      };
    };
    type SynthesizedStatement = { Action?: unknown; Resource?: unknown };

    // CDK moves oversized inline policies into managed overflow policies.
    const findRolePolicyStatements = (template: Template, roleLogicalId: string): SynthesizedStatement[] => {
      const resources = [
        ...Object.values(template.findResources('AWS::IAM::Policy')),
        ...Object.values(template.findResources('AWS::IAM::ManagedPolicy')),
      ] as SynthesizedPolicy[];

      return resources
        .filter((policy) => JSON.stringify(policy.Properties.Roles ?? '').includes(roleLogicalId))
        .flatMap((policy) => policy.Properties.PolicyDocument?.Statement ?? []);
    };

    it('should grant iot:Publish on the countdown topic to the Admin role', () => {
      const { stack, userRoles } = buildStack();
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          Roles: [{ Ref: stack.getLogicalId(userRoles.adminRole.node.defaultChild as never) }],
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Effect: 'Allow',
                Action: 'iot:Publish',
                Resource: {
                  'Fn::Join': [
                    '',
                    Match.arrayWith([Match.stringLikeRegexp('topic/deepracer/.*/leaderboard/\\*/countdown$')]),
                  ],
                },
              }),
            ]),
          },
        }),
      ).not.toThrow();
    });

    it('should grant iot:Publish on the countdown topic to the RaceFacilitator role', () => {
      const { stack, userRoles } = buildStack();
      const template = Template.fromStack(stack);
      const roleLogicalId = stack.getLogicalId(userRoles.raceFacilitatorRole.node.defaultChild as never);
      const statements = findRolePolicyStatements(template, roleLogicalId);

      const countdownGrant = statements.find(
        (statement) =>
          statement.Action === 'iot:Publish' && JSON.stringify(statement.Resource).includes('leaderboard/*/countdown'),
      );
      expect(countdownGrant).toBeDefined();
    });

    it('should NOT grant iot:Publish to the Racer role', () => {
      const { stack, userRoles } = buildStack();
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          Roles: [{ Ref: stack.getLogicalId(userRoles.racerRole.node.defaultChild as never) }],
          PolicyDocument: {
            Statement: Match.arrayWith([Match.objectLike({ Action: 'iot:Publish' })]),
          },
        }),
      ).toThrow();
    });

    it('should NOT grant iot:Publish to the Commentator role', () => {
      const { stack, userRoles } = buildStack();
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          Roles: [{ Ref: stack.getLogicalId(userRoles.commentatorRole.node.defaultChild as never) }],
          PolicyDocument: {
            Statement: Match.arrayWith([Match.objectLike({ Action: 'iot:Publish' })]),
          },
        }),
      ).toThrow();
    });

    it('should grant the Commentator role GET/OPTIONS on the event tracks route', () => {
      // CommentatorView's track dropdown (useListEventTracksQuery -> GET /events/{eventId}/tracks)
      // needs this grant, or the request 403s and the dropdown never populates for a pure
      // Commentator — a real functionality break, not just an access-control hygiene gap.
      const { stack, userRoles } = buildStack();
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          Roles: [{ Ref: stack.getLogicalId(userRoles.commentatorRole.node.defaultChild as never) }],
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Effect: 'Allow',
                Action: 'execute-api:Invoke',
                Resource: Match.arrayWith([
                  Match.objectLike({
                    'Fn::Join': ['', Match.arrayWith([Match.stringLikeRegexp('/GET/events/\\*/tracks$')])],
                  }),
                  Match.objectLike({
                    'Fn::Join': ['', Match.arrayWith([Match.stringLikeRegexp('/OPTIONS/events/\\*/tracks$')])],
                  }),
                ]),
              }),
            ]),
          },
        }),
      ).not.toThrow();
    });

    it('should grant the Commentator role GET/OPTIONS on the profile route', () => {
      // TopNavigation calls GetProfile to display the signed-in user's alias. Without this grant
      // the call 403s and the top bar falls back to a "Sign in" button, which is misleading for an
      // authenticated Commentator who is simply not authorized for the profile endpoint.
      const { stack, userRoles } = buildStack();
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          Roles: [{ Ref: stack.getLogicalId(userRoles.commentatorRole.node.defaultChild as never) }],
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Effect: 'Allow',
                Action: 'execute-api:Invoke',
                Resource: Match.arrayWith([
                  Match.objectLike({
                    'Fn::Join': ['', Match.arrayWith([Match.stringLikeRegexp('/GET/profile$')])],
                  }),
                  Match.objectLike({
                    'Fn::Join': ['', Match.arrayWith([Match.stringLikeRegexp('/OPTIONS/profile$')])],
                  }),
                ]),
              }),
            ]),
          },
        }),
      ).not.toThrow();
    });

    it('should grant the Registration Manager role GET/OPTIONS on the profile route', () => {
      // Same rationale as the Commentator case above: TopNavigation needs GetProfile to show the
      // signed-in alias instead of a misleading "Sign in" button.
      const { stack, userRoles } = buildStack();
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          Roles: [{ Ref: stack.getLogicalId(userRoles.registrationManagerRole.node.defaultChild as never) }],
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Effect: 'Allow',
                Action: 'execute-api:Invoke',
                Resource: Match.arrayWith([
                  Match.objectLike({
                    'Fn::Join': ['', Match.arrayWith([Match.stringLikeRegexp('/GET/profile$')])],
                  }),
                  Match.objectLike({
                    'Fn::Join': ['', Match.arrayWith([Match.stringLikeRegexp('/OPTIONS/profile$')])],
                  }),
                ]),
              }),
            ]),
          },
        }),
      ).not.toThrow();
    });

    it('should grant the Commentator role PATCH on the profile route', () => {
      // The Racer Profile page's alias/avatar edit form calls UpdateProfile (PATCH /profile).
      // Without this grant, a Commentator can view their profile (GetProfile) but any edit 403s.
      const { stack, userRoles } = buildStack();
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          Roles: [{ Ref: stack.getLogicalId(userRoles.commentatorRole.node.defaultChild as never) }],
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Effect: 'Allow',
                Action: 'execute-api:Invoke',
                Resource: Match.arrayWith([
                  Match.objectLike({
                    'Fn::Join': ['', Match.arrayWith([Match.stringLikeRegexp('/PATCH/profile$')])],
                  }),
                ]),
              }),
            ]),
          },
        }),
      ).not.toThrow();
    });

    it('should not grant CreateProfile to non-admin roles', () => {
      const { stack, userRoles } = buildStack();
      const template = Template.fromStack(stack);

      [
        userRoles.raceFacilitatorRole,
        userRoles.racerRole,
        userRoles.commentatorRole,
        userRoles.registrationManagerRole,
      ].forEach((role) => {
        expect(() =>
          template.hasResourceProperties('AWS::IAM::Policy', {
            Roles: [{ Ref: stack.getLogicalId(role.node.defaultChild as never) }],
            PolicyDocument: {
              Statement: Match.arrayWith([
                Match.objectLike({
                  Effect: 'Allow',
                  Action: 'execute-api:Invoke',
                  Resource: Match.arrayWith([
                    Match.objectLike({
                      'Fn::Join': ['', Match.arrayWith([Match.stringLikeRegexp('/POST/profile$')])],
                    }),
                  ]),
                }),
              ]),
            },
          }),
        ).toThrow();
      });
    });

    it('should grant the Registration Manager role PATCH on the profile route', () => {
      // Same rationale as the Commentator case above.
      const { stack, userRoles } = buildStack();
      const template = Template.fromStack(stack);

      expect(() =>
        template.hasResourceProperties('AWS::IAM::Policy', {
          Roles: [{ Ref: stack.getLogicalId(userRoles.registrationManagerRole.node.defaultChild as never) }],
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Effect: 'Allow',
                Action: 'execute-api:Invoke',
                Resource: Match.arrayWith([
                  Match.objectLike({
                    'Fn::Join': ['', Match.arrayWith([Match.stringLikeRegexp('/PATCH/profile$')])],
                  }),
                ]),
              }),
            ]),
          },
        }),
      ).not.toThrow();
    });

    it('should grant the Race Facilitator role POST/OPTIONS on the race-management/users route', () => {
      const { stack, userRoles } = buildStack();
      const template = Template.fromStack(stack);
      const roleLogicalId = stack.getLogicalId(userRoles.raceFacilitatorRole.node.defaultChild as never);
      const statements = findRolePolicyStatements(template, roleLogicalId);
      const apiStatements = statements.filter((statement) => statement.Action === 'execute-api:Invoke');
      const resources = JSON.stringify(apiStatements);

      expect(resources).toContain('/POST/race-management/users');
      expect(resources).toContain('/OPTIONS/race-management/users');
    });
  });
});
