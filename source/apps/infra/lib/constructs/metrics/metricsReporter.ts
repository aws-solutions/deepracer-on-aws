// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'path';

import { Stack } from 'aws-cdk-lib';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CfnSubscriptionFilter, FilterPattern } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { LogGroupCategory, LogGroupsHelper } from '../common/logGroupsHelper.js';
import { functionNamePrefix, NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

// The following two values should match what's in source/libs/utils/src/metrics/metricsTypes.ts
// reusing the constants from and adding the dependency src/DeepRacerIndy/source/apps/infra/package.json resulted in
// a circular dependency infra:build --> website:build --> infra:build
const metricsLogSubscriptionKeyField = 'metricsLogSubscriptionKey';
enum MetricsSubscriptionKeyValue {
  DAILY_HEART_BEAT = 'DailyHeartbeat',
  USER_LOG_IN = 'UserLogIn',
  IMPORT_MODEL = 'ImportModel',
  DOWNLOAD_MODEL = 'DownloadModel',
  UNEXPECTED_ERROR = 'UnexpectedError', // not implemented yet
  CREATE_EVALUATION = 'CreateEvaluation',
  CREATE_LEADERBOARD = 'CreateLeaderboard',
  CREATE_MODEL = 'CreateModel',
  CREATE_SUBMISSION = 'CreateSubmission',
  DELETE_MODEL = 'DeleteModel',
  DELETE_PROFILE = 'DeleteProfile',
  DELETE_PROFILE_MODELS = 'DeleteProfileModels',
  CREATE_USER = 'CreateUser',
  DEEP_RACER_JOB = 'DeepRacerJob',
}

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
    const existingLogGroups = LogGroupsHelper.getAllLogGroups();
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
    existingLogGroups.forEach((logGroup) => {
      const subscriptionFilter = new CfnSubscriptionFilter(this, `MetricLogSubscription-${logGroup.node.id}`, {
        logGroupName: logGroup.logGroupName,
        destinationArn: logSubsriberLambda.functionArn,
        filterPattern: FilterPattern.any(
          ...Object.values(MetricsSubscriptionKeyValue).map((value) =>
            FilterPattern.stringValue(`$.${metricsLogSubscriptionKeyField}`, '=', value),
          ),
        ).logPatternString,
      });

      // Ensure the Lambda function (and its permissions) are created before the subscription filter
      subscriptionFilter.node.addDependency(logSubsriberLambda);
    });
  }
}
