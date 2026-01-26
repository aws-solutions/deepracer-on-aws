// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { Duration } from 'aws-cdk-lib';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnSchedule } from 'aws-cdk-lib/aws-scheduler';
import { Construct } from 'constructs';

import { LogGroupCategory } from '../common/logGroupsHelper.js';
import { functionNamePrefix, NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

export interface MonthlyQuotaResetProps {
  dynamoDBTable: TableV2;
  namespace: string;
}

export class MonthlyQuotaReset extends Construct {
  constructor(scope: Construct, id: string, { namespace, dynamoDBTable }: MonthlyQuotaResetProps) {
    super(scope, id);

    const monthlyQuotaResetFunction = new NodeLambdaFunction(this, 'MonthlyQuotaResetFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/scheduled/handlers/resetMonthlyQuota.ts'),
      functionName: `${functionNamePrefix}-MonthlyQuotaResetFn`,
      logGroupCategory: LogGroupCategory.SCHEDULED,
      namespace,
      timeout: Duration.minutes(15), // Set to max in case there are many profiles
      environment: {
        PROFILE_UPDATE_CONCURRENCY: '10',
        PROFILE_UPDATE_BATCH_SIZE: '100',
      },
    });

    dynamoDBTable.grantReadWriteData(monthlyQuotaResetFunction);

    const schedulerRole = new Role(this, 'MonthlyQuotaResetSchedulerRole', {
      assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
    });

    schedulerRole.addToPolicy(
      new PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [monthlyQuotaResetFunction.functionArn],
      }),
    );

    new CfnSchedule(this, 'MonthlyQuotaResetSchedule', {
      flexibleTimeWindow: {
        mode: 'FLEXIBLE',
        maximumWindowInMinutes: 240, // 4 hours = 240 minutes
      },
      scheduleExpression: 'cron(0 0 1 * ? *)', // 1st of every month at midnight UTC
      target: {
        arn: monthlyQuotaResetFunction.functionArn,
        roleArn: schedulerRole.roleArn,
        retryPolicy: {
          maximumRetryAttempts: 3,
        },
      },
      description: 'Triggers monthly quota reset function on the 1st of every month at midnight UTC',
      state: 'ENABLED',
    });
  }
}
