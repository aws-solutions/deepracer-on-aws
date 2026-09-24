// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { StackKey } from '#constants/operationOwnership.js';

import { isDevMode } from './deploymentModeHelper.js';
import { DefaultLogRemovalPolicy } from './logGroupsHelper.js';
import { NodeLambdaFunction } from './nodeLambdaFunction.js';

/**
 * Root of the lambda source tree, relative to any CDK construct file located
 * directly under `apps/infra/lib/constructs/{epic-name}/`.
 *
 * Path breakdown from a construct file:
 *   ../  → constructs/
 *   ../  → lib/
 *   ../  → infra/
 *   ../  → apps/
 *   ../  → source/
 *   libs/lambda/src
 *
 * If you ever move a construct file to a different depth, adjust the
 * relative segment count here or pass a custom `relativeRoot` override.
 */
const LAMBDA_SRC_FROM_EPIC_CONSTRUCT = '../../../../../libs/lambda/src';

/**
 * Returns the absolute path to a Lambda handler entry file.
 *
 * @param constructDirname  `__dirname` of the calling epic CDK construct file.
 *                          All epic constructs live one level deep under
 *                          `constructs/{epic-name}/`, so the default relative
 *                          root is correct without any override.
 * @param handlerRelPath    Path relative to `libs/lambda/src`, without `.ts`
 *                          extension (e.g. `"api/handlers/createEvent"`).
 * @returns Absolute `.ts` entry path suitable for `NodeLambdaFunction.entry`.
 *
 * @example
 * lambdaEntryPath(__dirname, 'api/handlers/createEvent')
 * // → '/…/source/libs/lambda/src/api/handlers/createEvent.ts'
 */
export function lambdaEntryPath(constructDirname: string, handlerRelPath: string): string {
  return path.join(constructDirname, LAMBDA_SRC_FROM_EPIC_CONSTRUCT, `${handlerRelPath}.ts`);
}

/**
 * Constructs the standard Lambda function name used by the API stack.
 * Keeps naming consistent across the core Api construct and all epic stacks.
 *
 * @param operation  Smithy operation name (e.g. `"CreateEvent"`).
 * @returns Function name string (e.g. `"DeepRacerIndyApi-CreateEventFunction"`).
 */
export function epicLambdaFunctionName(operation: string): string {
  return `DeepRacerIndyApi-${operation}Function`;
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Props consumed by every epic Lambda construct.
 * Epic constructs declare their own `*Props` type and include these fields.
 *
 * NOTE: nothing API Gateway related belongs here. An epic stack that took the API's
 * execute ARN would depend on the gateway, while the gateway already depends on the
 * epic for its handler ARNs — a cycle. Epics needing queue access take the queue ARN
 * as an explicitly named `string` prop.
 */
export interface EpicFunctionProps {
  /** Deployment namespace — passed to `NodeLambdaFunction` for naming. */
  readonly namespace: string;
  /** The stackKey (core, eventManagement, etc) that each of these Functions belong to. */
  readonly stackKey: StackKey;
  /** Shared DynamoDB table — granted read/write on every function. */
  readonly dynamoDBTable: TableV2;
  /** Cognito user pool — grants `cognito-idp:ListUsers` and `cognito-idp:AdminListGroupsForUser` on every function. */
  readonly userPool: IUserPool;
  /**
   * Solution CMK for log group encryption.
   *
   * Passed explicitly rather than fetched via `KmsHelper.get()`: the singleton
   * creates the key in whichever stack calls it first, which would make an epic
   * stack's log encryption depend on construct creation order. Taking it as a prop
   * keeps the dependency visible and compiler-checked.
   */
  readonly encryptionKey: IKey;
  /**
   * Additional environment variables merged into the base set on every function.
   * The base set already includes `POWERTOOLS_METRICS_NAMESPACE` and `USER_POOL_ID`.
   */
  readonly extraEnv?: Record<string, string>;
  /**
   * CloudWatch Logs retention applied to the shared per-epic LogGroup used by
   * every function created by this call. Defaults to `RetentionDays.TEN_YEARS`
   * (matches the previous hard-coded behavior) so existing epics are unaffected.
   * Pass an explicit value to opt an epic into a shorter retention.
   */
  readonly logRetention?: RetentionDays;
}

/**
 * Result of {@link createEpicFunctions}.
 *
 * `logGroup` is returned explicitly because the shared API log group is created
 * directly with `new LogGroup` in the epic stack and must be surfaced to the epic
 * construct for root-level `LogInsights` wiring.
 */
export interface EpicFunctions<T extends string> {
  readonly functions: Record<T, NodeLambdaFunction>;
  readonly logGroup: LogGroup;
}

/**
 * Creates one `NodeLambdaFunction` per entry in `entryPoints` and wires the two
 * permissions every epic API-backed Lambda needs:
 *
 *   1. `dynamoDB.grantReadWriteData` — table read/write
 *   2. `cognito-idp:ListUsers` and `cognito-idp:AdminListGroupsForUser` on the user pool
 *      (profile lookups and role verification)
 *
 * It deliberately does NOT create an API Gateway invoke permission. `GatewayStack`
 * owns every `AWS::Lambda::Permission` for the API, which is what keeps the dependency
 * graph acyclic and lets each `sourceArn` be scoped to the actual REST API instead of a
 * wildcard over all of execute-api.
 *
 * Returns the populated function map plus the shared API log group. The calling
 * construct then adds any epic-specific permissions (AppConfig, S3, SageMaker,
 * SQS, etc.) on top.
 *
 * @param scope       CDK construct scope (pass `this` from the epic construct).
 * @param constructDirname  `__dirname` of the epic construct file — used by
 *                    `lambdaEntryPath` to resolve the absolute entry file path.
 * @param entryPoints Map of `OperationName → path relative to libs/lambda/src`
 *                    (without `.ts` extension).
 * @param props       {@link EpicFunctionProps} — universal platform resources.
 * @returns {@link EpicFunctions} — the function map and the shared API log group.
 *
 * @example
 * const { functions, logGroup } = createEpicFunctions(this, __dirname, ENTRY_POINTS, props);
 * // Then add epic-specific extras:
 * grantAppConfigAccess(this, functions.CreateEvent, props.globalSettings);
 */
export function createEpicFunctions<T extends string>(
  scope: Construct,
  constructDirname: string,
  entryPoints: Readonly<Record<T, string>>,
  props: EpicFunctionProps,
): EpicFunctions<T> {
  const { namespace, dynamoDBTable, userPool, extraEnv, stackKey, encryptionKey, logRetention } = props;

  const logGroup: LogGroup = new LogGroup(scope, `${stackKey}LogGroup`, {
    retention: logRetention ?? RetentionDays.TEN_YEARS,
    removalPolicy: isDevMode(scope) ? RemovalPolicy.DESTROY : DefaultLogRemovalPolicy,
    encryptionKey,
  });

  const functions = (Object.entries(entryPoints) as [T, string][]).reduce(
    (acc, [operation, entryRelPath]) => {
      acc[operation] = new NodeLambdaFunction(scope, `${operation}Function`, {
        entry: lambdaEntryPath(constructDirname, entryRelPath),
        functionName: epicLambdaFunctionName(operation),
        logGroup,
        namespace,
        environment: {
          POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndyApi',
          USER_POOL_ID: userPool.userPoolId,
          ...extraEnv,
        },
      });
      return acc;
    },
    {} as Record<T, NodeLambdaFunction>,
  );

  for (const fn of Object.values(functions) as NodeLambdaFunction[]) {
    dynamoDBTable.grantReadWriteData(fn);

    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:ListUsers', 'cognito-idp:AdminListGroupsForUser'],
        resources: [
          Stack.of(scope).formatArn({
            service: 'cognito-idp',
            resource: 'userpool',
            resourceName: userPool.userPoolId,
          }),
        ],
      }),
    );
  }

  return { functions, logGroup };
}
