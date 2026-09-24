// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';
import path from 'node:path';

import { WafwebaclToApiGateway } from '@aws-solutions-constructs/aws-wafwebacl-apigateway';
import type { DeepRacerIndyServiceOperations } from '@deepracer-indy/typescript-server-client';
import { NestedStack, NestedStackProps, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  ApiDefinition,
  LogGroupLogDestination,
  MethodLoggingLevel,
  ResponseType,
  SpecRestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { CfnPermission } from 'aws-cdk-lib/aws-lambda';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

import { OperationsOwnedBy, StackKey } from '#constants/operationOwnership.js';
import { addCfnGuardSuppression } from '#constructs/common/cfnGuardHelper.js';
import { DefaultLogRemovalPolicy, DefaultLogRetentionDays } from '#constructs/common/logGroupsHelper.js';

import { PlatformProps } from './platformProps.js';

// ── Props ──────────────────────────────────────────────────────────────────────

/**
 * Handler ARNs for every stack that owns API-backed Lambda functions.
 *
 * Mapped over `StackKey` so coverage is verified by the compiler rather than checked
 * at runtime: a missing stack, a missing operation, or an operation that stack does
 * not own are all type errors. This is what replaced the previous
 * `registerHandlers()` + `Lazy` arrangement.
 */
export type StackHandlerArns = { [K in StackKey]: Readonly<Record<OperationsOwnedBy<K>, string>> };

export type GatewayStackProps = NestedStackProps &
  Pick<PlatformProps, 'namespace' | 'encryptionKey'> & {
    readonly handlerArns: StackHandlerArns;
  };

// ── Stack ──────────────────────────────────────────────────────────────────────

/**
 * GatewayStack — owns the API Gateway and everything attached to it.
 *
 * Created **last** by root, after every stack that owns API-backed Lambda functions,
 * because it consumes their handler ARNs. Nothing may depend on this stack except
 * root reading its outputs (the safe parent → child direction).
 *
 * Owns: the `SpecRestApi`, its deployment stage and access log group, gateway
 * responses, the WAF WebACL and its association, and — critically — **every**
 * `AWS::Lambda::Permission` granting API Gateway invoke rights.
 *
 * That last point is the rule that makes the whole framework acyclic. If an epic
 * stack created its own invoke permission it would need this stack's REST API ID,
 * while this stack needs that epic's function ARNs — a genuine CloudFormation cycle
 * between sibling nested stacks. Concentrating permission ownership here removes the
 * cycle and lets each `sourceArn` be scoped precisely to this API, rather than to a
 * wildcard over all of execute-api.
 */
export class GatewayStack extends NestedStack {
  public readonly api: SpecRestApi;

  constructor(scope: Construct, id: string, props: GatewayStackProps) {
    super(scope, id, props);

    const { namespace, encryptionKey, handlerArns } = props;

    // Flatten the per-stack maps into one operation → ARN lookup for the spec.
    const mergedHandlerArns = Object.assign({}, ...Object.values(handlerArns)) as Readonly<
      Record<DeepRacerIndyServiceOperations, string>
    >;

    // No Lazy: this stack is constructed last, so every handler ARN is already
    // available as a constructor prop.
    this.api = new SpecRestApi(this, 'Api', {
      apiDefinition: ApiDefinition.fromInline(this.getOpenApiDef(mergedHandlerArns)),
      deploy: true,
      restApiName: `${namespace}-DeepRacerIndyApi`,
      description: 'DeepRacerIndy API',
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(
          new LogGroup(this, 'AccessLogs', {
            encryptionKey,
            removalPolicy: DefaultLogRemovalPolicy,
            retention: DefaultLogRetentionDays,
          }),
        ),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        metricsEnabled: true,
        tracingEnabled: true,
      },
    });

    this.api.addGatewayResponse('BadRequestBodyResponse', {
      type: ResponseType.BAD_REQUEST_BODY,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
      statusCode: '400',
      templates: {
        'application/json': '{ "errorMessage": "$context.error.message: $context.error.validationErrorString" }',
      },
    });

    this.api.addGatewayResponse('BadRequestParametersResponse', {
      type: ResponseType.BAD_REQUEST_PARAMETERS,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
      statusCode: '400',
      templates: {
        'application/json': '{ "errorMessage": "$context.error.message: $context.error.validationErrorString" }',
      },
    });

    this.api.applyRemovalPolicy(RemovalPolicy.DESTROY); // TODO: link to config value

    // caching in CloudFront
    addCfnGuardSuppression(this.api.deploymentStage, ['API_GW_CACHE_ENABLED_AND_ENCRYPTED']);

    new WafwebaclToApiGateway(this, 'WafwebaclToApiGateway', {
      existingApiGatewayInterface: this.api,
      webaclProps: {
        rules: [
          // Re-include the 7 default managed rule groups that WafwebaclToApiGateway provides
          // when no webaclProps are specified. Providing webaclProps.rules replaces them entirely.
          ...[
            'AWSManagedRulesBotControlRuleSet',
            'AWSManagedRulesKnownBadInputsRuleSet',
            'AWSManagedRulesCommonRuleSet',
            'AWSManagedRulesAnonymousIpList',
            'AWSManagedRulesAmazonIpReputationList',
            'AWSManagedRulesSQLiRuleSet',
            'AWSManagedRulesWordPressRuleSet',
          ].map((name, priority): CfnWebACL.RuleProperty => ({
            name,
            priority,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name,
                // SizeRestrictions_BODY's 8KB body limit rejects legitimate reward function
                // payloads. Change action to count; a dedicated rule below re-blocks it
                // everywhere except the endpoints that need larger bodies.
                ...(name === 'AWSManagedRulesCommonRuleSet'
                  ? {
                      ruleActionOverrides: [
                        {
                          name: 'SizeRestrictions_BODY',
                          actionToUse: { count: {} },
                        } satisfies CfnWebACL.RuleActionOverrideProperty,
                      ],
                    }
                  : {}),
              },
            },
            visibilityConfig: {
              sampledRequestsEnabled: true,
              cloudWatchMetricsEnabled: true,
              metricName: name,
            },
          })),
          // AdminProtectionRuleSet would block our own /admin/* routes — count only
          {
            name: 'AWSManagedRulesAdminProtectionRuleSet',
            priority: 7,
            overrideAction: { count: {} },
            statement: {
              managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesAdminProtectionRuleSet' },
            },
            visibilityConfig: {
              sampledRequestsEnabled: true,
              cloudWatchMetricsEnabled: true,
              metricName: 'AWSManagedRulesAdminProtectionRuleSet',
            },
          } satisfies CfnWebACL.RuleProperty,
          // Re-block SizeRestrictions_BODY except on paths that legitimately need larger bodies.
          // Matches with ENDS_WITH (not EXACTLY) since WAF sees the stage prefix (e.g. /prod/models),
          // which also keeps /models/{modelId} sub-paths fully enforced.
          {
            name: 'ReenforceBodySizeExceptRewardFunctionEndpoints',
            priority: 8,
            action: { block: {} },
            statement: {
              andStatement: {
                statements: [
                  {
                    labelMatchStatement: {
                      scope: 'LABEL',
                      key: 'awswaf:managed:aws:core-rule-set:SizeRestrictions_Body',
                    },
                  },
                  {
                    notStatement: {
                      statement: {
                        orStatement: {
                          statements: ['/models', '/rewardFunction'].map((exemptPath): CfnWebACL.StatementProperty => ({
                            byteMatchStatement: {
                              searchString: exemptPath,
                              fieldToMatch: { uriPath: {} },
                              positionalConstraint: 'ENDS_WITH',
                              textTransformations: [{ priority: 0, type: 'NONE' }],
                            },
                          })),
                        },
                      },
                    },
                  },
                ],
              },
            },
            visibilityConfig: {
              sampledRequestsEnabled: true,
              cloudWatchMetricsEnabled: true,
              metricName: 'ReenforceBodySizeExceptRewardFunctionEndpoints',
            },
          } satisfies CfnWebACL.RuleProperty,
          {
            name: 'AdminRateLimit',
            priority: 10,
            action: { block: {} },
            statement: {
              rateBasedStatement: {
                limit: 100,
                aggregateKeyType: 'IP',
                scopeDownStatement: {
                  byteMatchStatement: {
                    searchString: '/admin/',
                    fieldToMatch: { uriPath: {} },
                    textTransformations: [{ priority: 0, type: 'NONE' }],
                    positionalConstraint: 'CONTAINS',
                  },
                },
              },
            },
            visibilityConfig: {
              sampledRequestsEnabled: true,
              cloudWatchMetricsEnabled: true,
              metricName: 'AdminRateLimit',
            },
          } satisfies CfnWebACL.RuleProperty,
        ],
      },
    });
    // ── Lambda invoke permissions ────────────────────────────────────────────
    // One AWS::Lambda::Permission per operation, created HERE rather than in the
    // stack that owns the function. CfnPermission is used directly rather than
    // Function.fromFunctionArn(...).addPermission(): for an imported function with a
    // token ARN, CDK computes canCreatePermissions = false and addPermission() emits
    // nothing but a warning, which would deploy cleanly and 500 at runtime.
    //
    // Operations may share a Lambda (several unimplemented operations point at the
    // same stub), so permissions are keyed by ARN, not by operation.
    const permissionIdsByArn = new Map<string, string>();
    for (const [operation, functionArn] of Object.entries(mergedHandlerArns)) {
      if (permissionIdsByArn.has(functionArn)) {
        continue;
      }
      permissionIdsByArn.set(functionArn, operation);
      new CfnPermission(this, `${operation}InvokePermission`, {
        action: 'lambda:InvokeFunction',
        principal: 'apigateway.amazonaws.com',
        functionName: functionArn,
        sourceArn: this.api.arnForExecuteApi('*'),
      });
    }
  }

  /**
   * Reads the Smithy-generated OpenAPI spec and rewrites each operation's integration
   * URI to point at the owning stack's Lambda ARN.
   *
   * @param handlerArns Merged operation → ARN map covering every operation in the spec.
   *                    Totality is enforced by the props type, so an unresolved
   *                    operation here means the spec and OPERATION_OWNER disagree.
   */
  private getOpenApiDef(handlerArns: Readonly<Record<DeepRacerIndyServiceOperations, string>>) {
    const openApiSpec = JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          '../../../../libs/model/build/smithyprojections/model/source/openapi/DeepRacerIndy.openapi.json',
        ),
        'utf-8',
      ),
    );

    // Add the IAM authorizer
    openApiSpec.components.securitySchemes = {
      'aws.iam': {
        type: 'apiKey',
        name: 'authorization',
        in: 'header',
        'x-amazon-apigateway-authtype': 'awsSigv4',
      },
    };

    for (const openApiPath in openApiSpec.paths) {
      for (const operation in openApiSpec.paths[openApiPath]) {
        const op = openApiSpec.paths[openApiPath][operation];
        const integration = op['x-amazon-apigateway-integration'];

        // Configure method integration
        if (!integration) {
          throw new Error(
            `No x-amazon-apigateway-integration for ${op.operationId}. Make sure API Gateway integration is configured.`,
          );
        }

        // Set the authorizer and CORS headers based on method type
        if (operation === 'options') {
          const accessControlAllowHeaders =
            integration.responses.default.responseParameters['method.response.header.Access-Control-Allow-Headers'];
          const updatedHeader = `'x-amz-security-token,x-amz-date,x-amz-content-sha256,${accessControlAllowHeaders.slice(1, -1)}'`;
          integration.responses.default.responseParameters['method.response.header.Access-Control-Allow-Headers'] =
            updatedHeader;
        } else {
          op.security = [{ 'aws.iam': [] }];
        }

        // Don't touch mock integrations
        if (integration?.type === 'mock') {
          continue;
        }

        const operationId = op.operationId as DeepRacerIndyServiceOperations;
        const functionArn = handlerArns[operationId];

        if (typeof functionArn !== 'string') {
          throw new Error(
            `No handler ARN for operation ${op.operationId}. Every operation in the Smithy model ` +
              'must be assigned to a stack in OPERATION_OWNER, and that stack must expose it in handlerArns.',
          );
        }

        // Set the operation integration uri to the corresponding lambda handler ARN
        integration.uri = `arn:${Stack.of(this).partition}:apigateway:${Stack.of(this).region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`;
      }
    }

    return openApiSpec;
  }
}
