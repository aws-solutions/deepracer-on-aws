// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_NAMESPACE } from '@deepracer-indy/config/src/defaults/commonDefaults';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { isDevMode } from './deploymentModeHelper';
import { KmsHelper } from './kmsHelper';

interface CustomLogGroupProps {
  functionName?: string;
  logGroupCategory?: LogGroupCategory;
  namespace?: string;
  retention?: RetentionDays;
  useLegacyNamespaceName?: boolean;
}

export enum LogGroupCategory {
  API = 'DeepRacerApis',
  WORKFLOW = 'DeepRacerWorkflow',
  SCHEDULED = 'DeepRacerScheduled',
  DEFAULT = 'DeepRacerDefault',
  ECR_IMAGES = 'DeepRacerEcrImages',
  USER_IDENTITY = 'DeepRacerUserIdentity',
  METRICS = 'DeepRacerMetrics',
  SYSTEM_EVENTS = 'DeepRacerSystemEvents',
  LIVE_RACING = 'DeepRacerLiveRacing',
  TRAINING = 'DeepRacerTraining',
}

export const DefaultLogRetentionDays = RetentionDays.TWO_YEARS;
export const DefaultLogRemovalPolicy = RemovalPolicy.RETAIN;

export class LogGroupsHelper {
  /**
   * Gets an existing log group for the category or creates a new one
   * @param scope The construct scope
   * @param id The construct id for the log group
   * @param props The properties containing namespace, category, and functionName
   * @returns The existing or newly created LogGroup
   */
  static getOrCreateLogGroup(scope: Construct, id: string, props: CustomLogGroupProps): LogGroup {
    const category = props.logGroupCategory ?? LogGroupCategory.DEFAULT;

    const stack = Stack.of(scope);
    const cacheKey = `${category}:${props.useLegacyNamespaceName ? 'namespace' : 'stack'}`;
    let logGroupsByCategory = this.logGroupsByStack.get(stack);
    if (!logGroupsByCategory) {
      logGroupsByCategory = new Map();
      this.logGroupsByStack.set(stack, logGroupsByCategory);
    }
    const existingLogGroup = logGroupsByCategory.get(cacheKey);

    if (existingLogGroup) {
      return existingLogGroup;
    }

    const logGroupName = this.getLogGroupName(scope, props);

    if (!logGroupName) {
      throw new Error('Cannot create log group: log group name is undefined');
    }

    // For security-related log groups, apply a retention of 10 years as the default; otherwise,
    // keep the default retention of 2 years
    let defaultLogRetention = DefaultLogRetentionDays;
    const securityRelatedLogGroupCategories = [LogGroupCategory.API, LogGroupCategory.USER_IDENTITY];
    if (props.logGroupCategory && securityRelatedLogGroupCategories.includes(props.logGroupCategory)) {
      defaultLogRetention = RetentionDays.TEN_YEARS;
    }

    const newLogGroup = new LogGroup(Stack.of(scope), `${category}LogGroup`, {
      logGroupName: logGroupName,
      retention: props.retention ?? defaultLogRetention,
      removalPolicy: isDevMode(scope) ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      encryptionKey: KmsHelper.get(scope, props.namespace ?? DEFAULT_NAMESPACE),
    });

    logGroupsByCategory.set(cacheKey, newLogGroup);
    this.logGroups.push(newLogGroup);

    return newLogGroup;
  }

  /**
   * Gets all log groups created by this helper
   * @returns Array of all created log groups
   */
  static getAllLogGroups(): LogGroup[] {
    return [...this.logGroups];
  }

  private static logGroups: LogGroup[] = [];
  private static logGroupsByStack = new WeakMap<Stack, Map<string, LogGroup>>();

  /**
   * Gets the log group name for a Lambda function. Category-based names default to the
   * CDK stack name, but compatibility callers can preserve the namespace-based names
   * deployed by earlier solution versions.
   */
  private static getLogGroupName(scope: Construct, props: CustomLogGroupProps) {
    if (!props.logGroupCategory) {
      return props.functionName ? `/aws/lambda/${props.functionName}` : undefined;
    }
    const prefix = props.useLegacyNamespaceName ? (props.namespace ?? DEFAULT_NAMESPACE) : Stack.of(scope).stackName;
    const category = props.logGroupCategory ?? LogGroupCategory.DEFAULT;

    return `/aws/lambda/${prefix}-${category}`;
  }
}
