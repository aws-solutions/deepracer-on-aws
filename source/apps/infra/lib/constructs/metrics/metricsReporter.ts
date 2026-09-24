// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'path';

import { Stack } from 'aws-cdk-lib';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CfnSubscriptionFilter, FilterPattern } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { LogGroupCategory, LogGroupsHelper } from '../common/logGroupsHelper.js';
import { functionNamePrefix, NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

// This field name should match metricsLogSubscriptionKeyField in
// source/libs/utils/src/metrics/metricsTypes.ts (not imported directly: adding that dependency to
// apps/infra/package.json created a circular dependency infra:build --> website:build --> infra:build).
// The set of valid values (MetricsSubscriptionKeyValue in that same file) is validated by the
// downstream Lambda (processSubscribedMetricsLogs.ts), not by this filter — see the comment on
// the subscription filter below for why.
const metricsLogSubscriptionKeyField = 'metricsLogSubscriptionKey';

const getRootStack = (stack: Stack): Stack => {
  let rootStack = stack;
  while (rootStack.nestedStackParent) {
    rootStack = rootStack.nestedStackParent;
  }

  return rootStack;
};

interface MetricsReporterProps {
  solutionId: string;
  solutionVersion: string;
  namespace: string;
}

/**
 * Creates log subscription filters for all existing Lambda function log groups created using {@link LogGroupsHelper}.
 *
 * This construct must be instantiated AFTER all other Lambda functions
 * have been created in the stack
 *
 */
export class MetricsReporter extends Construct {
  constructor(scope: Construct, id: string, props: MetricsReporterProps) {
    super(scope, id);

    const stack = Stack.of(scope);

    // take a snapshot of all log groups before the lambda and its log group are created to avoid circular dependecy
    const existingLogGroups = LogGroupsHelper.getAllLogGroups().filter(
      (logGroup) => getRootStack(Stack.of(logGroup)) === getRootStack(stack),
    );
    const logSubsriberLambda = new NodeLambdaFunction(this, 'MetricLogSubscriberLambda', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/metrics/handlers/processSubscribedMetricsLogs.ts'),
      functionName: `${functionNamePrefix}-ProcessSubscribedMetricsLogsFn`,
      namespace: props.namespace,
      logGroupCategory: LogGroupCategory.METRICS,
      environment: {
        STACK_ARN: stack.stackId,
        SOLUTION_ID: props.solutionId,
        SOLUTION_VERSION: props.solutionVersion,
        ACCOUNT_ID: stack.account,
        REGION: stack.region,
        METRICS_ENDPOINT: 'https://metrics.awssolutionsbuilder.com/generic',
      },
    });

    // Add a single wildcard permission for all log groups
    logSubsriberLambda.addPermission('LogsInvokePermission', {
      principal: new ServicePrincipal('logs.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:log-group:/aws/lambda/*:*`,
    });

    // Use CfnSubscriptionFilter to avoid automatic permission creation per filter
    // because the will result in a policy size bigger than the limit (20480) as we have one log group per lambda
    //
    // The filter only checks that the subscription-key field is present — it does NOT enumerate
    // MetricsSubscriptionKeyValue. Enumerating every value as `FilterPattern.any(...stringValue(...))`
    // grows linearly with the enum and exceeds CloudWatch's 1024-character filterPattern limit once
    // enough values accumulate (hit at 22 values / ~1140 chars). The Lambda handler
    // (processSubscribedMetricsLogs.ts) already validates the key against the enum via
    // `isValidSubscriptionKey` and safely skips any log event with an unrecognized value, so this
    // filter's only job is cheaply excluding log lines that aren't metrics events at all.
    const subscribedLogGroupIds = new Set<string>();
    existingLogGroups.forEach((logGroup) => {
      const logGroupId = logGroup.node.id;
      if (subscribedLogGroupIds.has(logGroupId)) return;

      subscribedLogGroupIds.add(logGroupId);
      const subscriptionFilter = new CfnSubscriptionFilter(this, `MetricLogSubscription-${logGroupId}`, {
        logGroupName: logGroup.logGroupName,
        destinationArn: logSubsriberLambda.functionArn,
        filterPattern: FilterPattern.exists(`$.${metricsLogSubscriptionKeyField}`).logPatternString,
      });

      // Ensure the Lambda function (and its permissions) are created before the subscription filter
      subscriptionFilter.node.addDependency(logSubsriberLambda);
    });
  }
}
