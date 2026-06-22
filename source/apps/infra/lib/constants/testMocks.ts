// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration, Stack, type CfnResource } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Architecture, Code, Function, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

import type { NodeLambdaFunctionProps } from '../constructs/common/nodeLambdaFunction.js';

/**
 * Creates a mock factory for KmsHelper that returns a proper IKey from CDK.
 * CDK 2.246+ validates encryptionKey implements IKey interface via prop-injectable.
 *
 * Usage in test files:
 * ```ts
 * vi.mock('../../common/kmsHelper.js', () => createKmsHelperMock());
 * ```
 */
export function createKmsHelperMock() {
  return {
    KmsHelper: {
      get: vi.fn((scope: Construct) => {
        return Key.fromKeyArn(
          Stack.of(scope),
          `MockKey-${Math.random().toString(36).slice(2)}`,
          'arn:aws:kms:us-east-1:123456789012:key/mock-key-id',
        );
      }),
    },
  };
}

/**
 * Creates a mock factory for LogGroupsHelper that returns stub log group objects.
 * Prevents static log group state from leaking between test stacks.
 *
 * Usage in test files:
 * ```ts
 * vi.mock('../../common/logGroupsHelper.js', () => createLogGroupsHelperMock());
 * ```
 */
export async function createLogGroupsHelperMock() {
  const actual = await vi.importActual<typeof import('../constructs/common/logGroupsHelper.js')>(
    '../constructs/common/logGroupsHelper.js',
  );
  return {
    ...actual,
    LogGroupsHelper: {
      ...actual.LogGroupsHelper,
      getAllLogGroups: () => [],
      getOrCreateLogGroup: vi.fn().mockImplementation((scope: Construct, id: string) => {
        return LogGroup.fromLogGroupArn(
          Stack.of(scope),
          `MockLogGroup-${id}-${Math.random().toString(36).slice(2)}`,
          `arn:aws:logs:us-east-1:123456789012:log-group:mocked-log-group-${id}`,
        );
      }),
    },
  };
}

/**
 * Creates a mock factory for NodeLambdaFunction that uses inline code instead of esbuild bundling.
 * This eliminates esbuild invocations per test case, cutting CDK construct test time from minutes to seconds.
 *
 * Note: This function uses dynamic imports because vi.mock factories are hoisted above
 * static imports by vitest's transform, so top-level imports are not available.
 */
export async function createNodeLambdaFunctionMock() {
  const actual = await vi.importActual<typeof import('../constructs/common/nodeLambdaFunction.js')>(
    '../constructs/common/nodeLambdaFunction.js',
  );

  class MockNodeLambdaFunction extends Function {
    constructor(scope: Construct, id: string, props: NodeLambdaFunctionProps) {
      const { functionName, namespace = 'test', logGroup, logGroupCategory, ...rest } = props;
      const parentStack = Stack.of(scope);
      super(scope, id, {
        ...rest,
        handler: rest.handler ?? 'index.lambdaHandler',
        runtime: rest.runtime ?? Runtime.NODEJS_22_X,
        architecture: rest.architecture ?? Architecture.ARM_64,
        code: Code.fromInline('exports.lambdaHandler = async () => {}'),
        functionName: `${namespace}-${functionName}`,
        tracing: rest.tracing ?? Tracing.ACTIVE,
        timeout: rest.timeout ?? Duration.seconds(30),
        logGroup: logGroup as LogGroup | undefined,
        environment: {
          ACCOUNT_ID: parentStack.account,
          REGION: parentStack.region,
          ...(props.environment as Record<string, string> | undefined),
        },
      });

      const cfnResource = this.node.defaultChild as CfnResource;
      if (cfnResource?.cfnOptions) {
        cfnResource.cfnOptions.metadata = {
          ...cfnResource.cfnOptions.metadata,
          guard: { SuppressedRules: ['LAMBDA_INSIDE_VPC', 'LAMBDA_CONCURRENCY_CHECK'] },
        };
      }
    }
  }

  return {
    ...actual,
    NodeLambdaFunction: MockNodeLambdaFunction,
  };
}
