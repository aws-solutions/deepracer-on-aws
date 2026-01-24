// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'path';

import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CfnSchedule } from 'aws-cdk-lib/aws-scheduler';
import { Construct } from 'constructs';

import { LogGroupCategory } from '../common/logGroupsHelper.js';
import { functionNamePrefix, NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

export interface DailyHeartbeatProps {
  dynamoDBTable: TableV2;
  namespace: string;
}

export class DailyHeartbeat extends Construct {
  constructor(scope: Construct, id: string, props: DailyHeartbeatProps) {
    super(scope, id);
    const collectHeartbeatFn = new NodeLambdaFunction(this, 'CollectHeartbeatLambda', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/metrics/handlers/collectDailyHeartbeat.ts'),
      functionName: `${functionNamePrefix}-CollectHeartbeatFn`,
      logGroupCategory: LogGroupCategory.METRICS,
      namespace: props.namespace,
      environment: {
        DB_READ_CONCURRENCY: '10',
      },
    });

    props.dynamoDBTable.grantReadData(collectHeartbeatFn);

    const schedulerRole = new Role(this, 'CollectHeartbeatSchedulerRole', {
      assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
    });

    schedulerRole.addToPolicy(
      new PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [collectHeartbeatFn.functionArn],
      }),
    );

    new CfnSchedule(this, 'CollectHeartbeatSchedule', {
      flexibleTimeWindow: {
        mode: 'FLEXIBLE',
        maximumWindowInMinutes: 120,
      },
      scheduleExpression: 'cron(10 0 * * ? *)', // Every day at 12:10 AM UTC
      target: {
        arn: collectHeartbeatFn.functionArn,
        roleArn: schedulerRole.roleArn,
        retryPolicy: {
          maximumRetryAttempts: 3,
        },
      },
      description: 'Triggers daily heartbeat function at 12:10 AM every day',
      state: 'ENABLED',
    });
  }
}
