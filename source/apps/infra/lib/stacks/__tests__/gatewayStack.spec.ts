// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { operationsOwnedBy } from '../../constants/operationOwnership.js';
import { TEST_NAMESPACE } from '../../constants/testConstants.js';
import { GatewayStack, StackHandlerArns } from '../gatewayStack.js';

const ACCOUNT = '123456789012';
const REGION = 'us-east-1';

/**
 * Build a complete handlerArns map from the ownership map itself, so this fixture
 * cannot drift out of sync with OPERATION_OWNER. If an operation is added to a stack
 * key, it appears here automatically.
 */
function mockHandlerArns(): StackHandlerArns {
  const arnFor = (operation: string) => `arn:aws:lambda:${REGION}:${ACCOUNT}:function:mock-${operation}`;
  const mapFor = (
    key: 'core' | 'eventManagement' | 'modelManagement' | 'realTimeRoles' | 'deviceManagement' | 'carLogs',
  ) => Object.fromEntries(operationsOwnedBy(key).map((op) => [op, arnFor(op)]));
  return {
    core: mapFor('core'),
    eventManagement: mapFor('eventManagement'),
    modelManagement: mapFor('modelManagement'),
    realTimeRoles: mapFor('realTimeRoles'),
    deviceManagement: mapFor('deviceManagement'),
    carLogs: mapFor('carLogs'),
  } as StackHandlerArns;
}

const ALL_OPERATIONS = [
  ...operationsOwnedBy('core'),
  ...operationsOwnedBy('eventManagement'),
  ...operationsOwnedBy('modelManagement'),
  ...operationsOwnedBy('realTimeRoles'),
  ...operationsOwnedBy('deviceManagement'),
  ...operationsOwnedBy('carLogs'),
];

/**
 * A `SourceArn` is correctly scoped iff it names the REST API created in this stack.
 *
 * The defect this guards against is an account-wide
 * `arn:{partition}:execute-api:{region}:{account}:*`, which lets *any* API Gateway in
 * the account invoke the function. That shape was previously emitted by epic stacks
 * that could not reference the API without creating a CloudFormation cycle.
 *
 * Exported for the self-check below: a negative assertion is only worth having if it
 * demonstrably fails on the bad input.
 */
function isScopedToRestApi(sourceArn: unknown): boolean {
  if (typeof sourceArn !== 'object' || sourceArn === null) return false;
  const parts = (sourceArn as { 'Fn::Join'?: [string, unknown[]] })['Fn::Join']?.[1];
  if (!Array.isArray(parts)) return false;

  const namesRestApi = parts.some(
    (part) =>
      typeof part === 'object' && part !== null && /^Api[A-Z0-9]+$/.test(String((part as { Ref?: string }).Ref)),
  );
  const last = parts.at(-1);
  const endsWithBareWildcard = typeof last === 'string' && last.trim() === ':*';

  return namesRestApi && !endsWithBareWildcard;
}

function buildStack(): { stack: GatewayStack; template: Template } {
  const app = new App();
  const parent = new Stack(app, 'ParentStack', { env: { account: ACCOUNT, region: REGION } });
  const encryptionKey = Key.fromKeyArn(parent, 'TestKey', `arn:aws:kms:${REGION}:${ACCOUNT}:key/test-key-id`);
  const stack = new GatewayStack(parent, 'Gateway', {
    namespace: TEST_NAMESPACE,
    encryptionKey,
    handlerArns: mockHandlerArns(),
  });
  return { stack, template: Template.fromStack(stack) };
}

describe('GatewayStack', () => {
  let template: Template;

  beforeAll(() => {
    template = buildStack().template;
  });

  describe('isolated synthesis', () => {
    it('synthesizes with mock props and no root stack', () => {
      expect(template).toBeDefined();
      template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    });

    it('names the REST API from the namespace', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: `${TEST_NAMESPACE}-DeepRacerIndyApi`,
      });
      expect(template).toBeDefined();
    });
  });

  // ── The invariant that makes the framework acyclic ───────────────────────────
  describe('Lambda invoke permission ownership', () => {
    it('creates one permission per distinct handler ARN', () => {
      const arns = new Set(ALL_OPERATIONS.map((op) => `arn:aws:lambda:${REGION}:${ACCOUNT}:function:mock-${op}`));
      template.resourceCountIs('AWS::Lambda::Permission', arns.size);
      expect(arns.size).toBe(ALL_OPERATIONS.length);
    });

    it('creates Lambda::Permission resources for realTimeRoles operations (GetEventLeaderboard, RegisterUser)', () => {
      // Verifies the new realTimeRoles key is fully wired end-to-end — not just present in handlerArns props.
      const permissions = template.findResources('AWS::Lambda::Permission');
      const permissionFunctionNames = Object.values(permissions).map(
        (p) => (p as { Properties: { FunctionName: unknown } }).Properties.FunctionName,
      );
      const rendered = JSON.stringify(permissionFunctionNames);
      expect(rendered).toContain('GetEventLeaderboard');
      expect(rendered).toContain('RegisterUser');
    });

    it('scopes every SourceArn to this stack’s own REST API, never a wildcard', () => {
      const permissions = template.findResources('AWS::Lambda::Permission');
      expect(Object.keys(permissions).length).toBeGreaterThan(0);

      for (const [logicalId, permission] of Object.entries(permissions)) {
        const { SourceArn } = (permission as { Properties: { SourceArn: unknown } }).Properties;
        // Report the offending logical ID in the diff rather than via an expect message.
        expect({ logicalId, scoped: isScopedToRestApi(SourceArn) }).toEqual({ logicalId, scoped: true });
      }
    });

    it('the scoping guard rejects the historical account-wide wildcard', () => {
      // Self-check: proves the assertion above is not vacuous. This is the exact shape
      // epic stacks emitted before GatewayStack took ownership of permissions.
      const accountWideWildcard = {
        'Fn::Join': [
          '',
          [
            'arn:',
            { Ref: 'AWS::Partition' },
            ':execute-api:',
            { Ref: 'AWS::Region' },
            ':',
            { Ref: 'AWS::AccountId' },
            ':*',
          ],
        ],
      };
      expect(isScopedToRestApi(accountWideWildcard)).toBe(false);
      expect(isScopedToRestApi(undefined)).toBe(false);
    });

    it('grants invoke only to API Gateway', () => {
      const permissions = template.findResources('AWS::Lambda::Permission');
      for (const permission of Object.values(permissions)) {
        const props = (permission as { Properties: { Principal: string; Action: string } }).Properties;
        expect(props.Principal).toBe('apigateway.amazonaws.com');
        expect(props.Action).toBe('lambda:InvokeFunction');
      }
    });
  });

  describe('OpenAPI integration', () => {
    it('wires an integration URI for every operation in the spec', () => {
      const apis = template.findResources('AWS::ApiGateway::RestApi');
      const body = (Object.values(apis)[0] as { Properties: { Body: { paths: Record<string, object> } } }).Properties
        .Body;

      const wired: string[] = [];
      for (const methods of Object.values(body.paths)) {
        for (const [method, op] of Object.entries(methods as Record<string, Record<string, unknown>>)) {
          if (method === 'options') continue;
          expect(op['x-amazon-apigateway-integration']).toBeDefined();
          wired.push(op.operationId as string);
        }
      }
      // Every operation the ownership map knows about is wired, and nothing extra.
      expect(wired.sort()).toEqual([...ALL_OPERATIONS].sort());
    });
  });

  // ── Resources that moved here from the Api construct ────────────────────────
  describe('gateway configuration', () => {
    it('configures API Gateway error responses', () => {
      for (const responseType of ['BAD_REQUEST_BODY', 'BAD_REQUEST_PARAMETERS']) {
        template.hasResourceProperties('AWS::ApiGateway::GatewayResponse', {
          ResponseType: responseType,
          ResponseParameters: {
            'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
            'gatewayresponse.header.Access-Control-Allow-Headers': "'*'",
          },
          StatusCode: '400',
        });
      }
      expect(template).toBeDefined();
    });

    it('creates a WAF rate-based rule scoped to the /admin/ path', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'AdminRateLimit',
            Statement: {
              RateBasedStatement: Match.objectLike({ Limit: 100, AggregateKeyType: 'IP' }),
            },
          }),
        ]),
      });
      expect(template).toBeDefined();
    });

    it('changes SizeRestrictions_BODY to count without disabling the rest of CommonRuleSet', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'AWSManagedRulesCommonRuleSet',
            OverrideAction: { None: {} },
            Statement: {
              ManagedRuleGroupStatement: Match.objectLike({
                Name: 'AWSManagedRulesCommonRuleSet',
                RuleActionOverrides: [
                  {
                    Name: 'SizeRestrictions_BODY',
                    ActionToUse: { Count: {} },
                  },
                ],
              }),
            },
          }),
        ]),
      });
      expect(template).toBeDefined();
    });

    it('re-blocks oversized bodies everywhere except the reward function endpoints', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'ReenforceBodySizeExceptRewardFunctionEndpoints',
            Action: { Block: {} },
            Statement: {
              AndStatement: {
                Statements: Match.arrayWith([
                  Match.objectLike({
                    LabelMatchStatement: {
                      Scope: 'LABEL',
                      Key: 'awswaf:managed:aws:core-rule-set:SizeRestrictions_Body',
                    },
                  }),
                  Match.objectLike({
                    NotStatement: {
                      Statement: {
                        OrStatement: {
                          Statements: Match.arrayWith([
                            Match.objectLike({
                              ByteMatchStatement: Match.objectLike({
                                SearchString: '/models',
                                PositionalConstraint: 'ENDS_WITH',
                              }),
                            }),
                            Match.objectLike({
                              ByteMatchStatement: Match.objectLike({
                                SearchString: '/rewardFunction',
                                PositionalConstraint: 'ENDS_WITH',
                              }),
                            }),
                          ]),
                        },
                      },
                    },
                  }),
                ]),
              },
            },
          }),
        ]),
      });
      expect(template).toBeDefined();
    });

    it('creates an encrypted access log group for the stage', () => {
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        KmsKeyId: Match.anyValue(),
      });
      expect(template).toBeDefined();
    });
  });

  // ── Error paths in spec assembly (relocated from api.spec.ts) ───────────────
  describe('OpenAPI spec validation', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('throws when an operation has no x-amazon-apigateway-integration', () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          components: {},
          paths: { '/test': { get: { operationId: 'GetModel' } } },
        }),
      );

      expect(() => buildStack()).toThrow(/No x-amazon-apigateway-integration for GetModel/);
    });

    it('throws when an operation in the spec has no owner in OPERATION_OWNER', () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          components: {},
          paths: {
            '/test': {
              get: {
                operationId: 'AnUnownedOperation',
                'x-amazon-apigateway-integration': { type: 'aws_proxy' },
              },
            },
          },
        }),
      );

      expect(() => buildStack()).toThrow(/No handler ARN for operation AnUnownedOperation/);
    });
  });
});
