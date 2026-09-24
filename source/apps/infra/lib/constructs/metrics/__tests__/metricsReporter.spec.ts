// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_NAMESPACE } from '../../../constants/testConstants.js';
import { createKmsHelperMock, createNodeLambdaFunctionMock } from '../../../constants/testMocks.js';
import { LogGroupCategory, LogGroupsHelper } from '../../common/logGroupsHelper.js';
import { MetricsReporter } from '../metricsReporter.js';

vi.mock('../../common/kmsHelper.js', () => createKmsHelperMock());
vi.mock('../../common/nodeLambdaFunction.js', () => createNodeLambdaFunctionMock());

afterEach(() => {
  // @ts-expect-error - reset helper state between isolated construct tests
  LogGroupsHelper.logGroups = [];
  // @ts-expect-error - reset helper state between isolated construct tests
  LogGroupsHelper.logGroupsByStack = new WeakMap();
});

describe('MetricsReporter', () => {
  it('ignores log groups from other root stacks', () => {
    const app = new App();
    const firstSourceStack = new Stack(app, 'FirstSourceStack');
    const secondSourceStack = new Stack(app, 'SecondSourceStack');
    const reporterStack = new Stack(app, 'ReporterStack');
    const firstLogGroup = LogGroupsHelper.getOrCreateLogGroup(firstSourceStack, 'FirstSource', {
      logGroupCategory: LogGroupCategory.SYSTEM_EVENTS,
      namespace: TEST_NAMESPACE,
    });
    const secondLogGroup = LogGroupsHelper.getOrCreateLogGroup(secondSourceStack, 'SecondSource', {
      logGroupCategory: LogGroupCategory.SYSTEM_EVENTS,
      namespace: TEST_NAMESPACE,
    });

    expect(firstLogGroup.node.id).toBe(secondLogGroup.node.id);
    expect(firstLogGroup.node.addr).not.toBe(secondLogGroup.node.addr);
    expect(
      () =>
        new MetricsReporter(reporterStack, 'MetricsReporter', {
          namespace: TEST_NAMESPACE,
          solutionId: 'test-solution-id',
          solutionVersion: 'v1.0.0',
        }),
    ).not.toThrow();

    Template.fromStack(reporterStack).resourceCountIs('AWS::Logs::SubscriptionFilter', 0);
  });

  it('creates one subscription for same-name log groups', () => {
    const app = new App();
    const stack = new Stack(app, 'ReporterStack');
    const firstLogGroup = LogGroup.fromLogGroupName(
      new Construct(stack, 'FirstSource'),
      'DeepRacerSystemEventsLogGroup',
      '/aws/lambda/default-DeepRacerSystemEvents',
    ) as LogGroup;
    const secondLogGroup = LogGroup.fromLogGroupName(
      new Construct(stack, 'SecondSource'),
      'DeepRacerSystemEventsLogGroup',
      '/aws/lambda/default-DeepRacerSystemEvents',
    ) as LogGroup;

    // @ts-expect-error - seed the helper snapshot with same-name groups from separate construct scopes
    LogGroupsHelper.logGroups = [firstLogGroup, secondLogGroup];
    expect(firstLogGroup.node.addr).not.toBe(secondLogGroup.node.addr);
    new MetricsReporter(stack, 'MetricsReporter', {
      namespace: TEST_NAMESPACE,
      solutionId: 'test-solution-id',
      solutionVersion: 'v1.0.0',
    });

    Template.fromStack(stack).resourceCountIs('AWS::Logs::SubscriptionFilter', 1);
  });
});
