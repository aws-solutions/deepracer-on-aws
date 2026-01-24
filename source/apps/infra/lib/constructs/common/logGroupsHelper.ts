// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_NAMESPACE } from '@deepracer-indy/config/src/defaults/commonDefaults';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { KmsHelper } from './kmsHelper';

interface CustomLogGroupProps {
  functionName?: string;
  logGroupCategory?: LogGroupCategory;
  namespace?: string;
  retention?: RetentionDays;
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

    const existingLogGroup = this.logGroupsByCategory.get(category);

    if (existingLogGroup) {
      return existingLogGroup;
    }

    const logGroupName = this.getLogGroupName(props);

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
      removalPolicy: DefaultLogRemovalPolicy,
      encryptionKey: KmsHelper.get(scope, props.namespace ?? DEFAULT_NAMESPACE),
    });

    this.logGroupsByCategory.set(category, newLogGroup);
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
  private static logGroupsByCategory: Map<LogGroupCategory, LogGroup> = new Map();

  /**
   * Gets the log group name for a Lambda function
   * @param props The properties containing namespace, category, and functionName
   * @returns The log group name with default function name if none provided
   */
  private static getLogGroupName(props: CustomLogGroupProps) {
    if (!props.logGroupCategory) {
      return props.functionName ? `/aws/lambda/${props.functionName}` : undefined;
    }
    const namespace = props.namespace ?? DEFAULT_NAMESPACE;
    const category = props.logGroupCategory ?? LogGroupCategory.DEFAULT;

    return `/aws/lambda/${namespace}-${category}`;
  }
}
