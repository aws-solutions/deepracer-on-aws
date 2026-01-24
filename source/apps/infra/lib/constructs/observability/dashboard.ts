// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration, Stack } from 'aws-cdk-lib';
import { SpecRestApi } from 'aws-cdk-lib/aws-apigateway';
import {
  Alarm,
  AlarmStatusWidget,
  CompositeAlarm,
  Dashboard,
  GraphWidget,
  Metric,
  Row,
  TextWidget,
} from 'aws-cdk-lib/aws-cloudwatch';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface MonitoringDashboardProps {
  /**
   * Namespace for the dashboard name
   */
  namespace: string;

  /**
   * API Gateway REST API to monitor
   */
  api: SpecRestApi;

  /**
   * DynamoDB table to monitor
   */
  dynamoDBTable: ITable;

  /**
   * Optional: List of alarms to display on the dashboard
   */
  alarms?: (Alarm | CompositeAlarm)[];

  /**
   * Optional: SQS queues to monitor
   */
  queues?: IQueue[];
}

/**
 * Creates a CloudWatch dashboard for monitoring DeepRacer system health
 */
export class MonitoringDashboard extends Construct {
  public readonly dashboard: Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringDashboardProps) {
    super(scope, id);

    const region = Stack.of(this).region;

    this.dashboard = new Dashboard(this, 'Dashboard', {
      dashboardName: `${props.namespace}-deepracer-monitoring-${region}`,
    });

    // Add title
    this.dashboard.addWidgets(
      new TextWidget({
        markdown: `# DeepRacer Monitoring Dashboard\nNamespace: **${props.namespace}**`,
        width: 24,
        height: 2,
      }),
    );

    // Add alarm status widget
    if (props.alarms && props.alarms.length > 0) {
      this.dashboard.addWidgets(
        new Row(
          new TextWidget({
            markdown: '## System Alarms',
            width: 24,
            height: 1,
          }),
        ),
        new Row(
          new AlarmStatusWidget({
            title: 'Alarm Status',
            alarms: props.alarms,
            width: 24,
          }),
        ),
      );
    }

    // Add SageMaker instance usage metrics
    this.dashboard.addWidgets(
      new Row(
        new TextWidget({
          markdown:
            '## Training Instance Usage\n\n' +
            'Current ml.c5.4xlarge training job usage. ' +
            '[View quota limits and utilization →](https://console.aws.amazon.com/servicequotas/home/services/sagemaker/quotas/L-E7898792)',
          width: 24,
          height: 2,
        }),
      ),
      new Row(
        new GraphWidget({
          title: 'ml.c5.4xlarge Training Jobs In Use',
          left: [
            new Metric({
              namespace: 'AWS/Usage',
              metricName: 'ResourceCount',
              dimensionsMap: {
                Type: 'Resource',
                Resource: 'training-job/ml.c5.4xlarge',
                Service: 'SageMaker',
                Class: 'None',
              },
              statistic: 'Maximum',
              period: Duration.minutes(5),
              label: 'Active Instances',
            }),
          ],
          width: 24,
        }),
      ),
    );

    // Add workflow job outcome metrics
    this.dashboard.addWidgets(
      new Row(
        new TextWidget({
          markdown: '## Training & Evaluation Jobs',
          width: 24,
          height: 1,
        }),
      ),
      new Row(
        new GraphWidget({
          title: 'Training Job Outcomes',
          left: [
            new Metric({
              namespace: 'DeepRacerIndyWorkflow',
              metricName: 'JobOutcome',
              dimensionsMap: {
                service: 'DeepRacerIndy',
                JobType: 'training',
                JobStatus: 'COMPLETED',
              },
              statistic: 'Sum',
              period: Duration.hours(1),
              label: 'Completed',
            }),
            new Metric({
              namespace: 'DeepRacerIndyWorkflow',
              metricName: 'JobOutcome',
              dimensionsMap: {
                service: 'DeepRacerIndy',
                JobType: 'training',
                JobStatus: 'FAILED',
              },
              statistic: 'Sum',
              period: Duration.hours(1),
              label: 'Failed',
            }),
          ],
          width: 12,
        }),
        new GraphWidget({
          title: 'Evaluation Job Outcomes',
          left: [
            new Metric({
              namespace: 'DeepRacerIndyWorkflow',
              metricName: 'JobOutcome',
              dimensionsMap: {
                service: 'DeepRacerIndy',
                JobType: 'evaluation',
                JobStatus: 'COMPLETED',
              },
              statistic: 'Sum',
              period: Duration.hours(1),
              label: 'Completed',
            }),
            new Metric({
              namespace: 'DeepRacerIndyWorkflow',
              metricName: 'JobOutcome',
              dimensionsMap: {
                service: 'DeepRacerIndy',
                JobType: 'evaluation',
                JobStatus: 'FAILED',
              },
              statistic: 'Sum',
              period: Duration.hours(1),
              label: 'Failed',
            }),
          ],
          width: 12,
        }),
      ),
    );

    // Add SQS metrics for workflow job queue
    if (props.queues && props.queues.length > 0) {
      const queue = props.queues[0];
      this.dashboard.addWidgets(
        new Row(
          new TextWidget({
            markdown: '## Queue Metrics',
            width: 24,
            height: 1,
          }),
        ),
        new Row(
          new GraphWidget({
            title: `Queue: ${queue.queueName} - Messages`,
            left: [
              queue.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5), label: 'Visible' }),
              queue.metricApproximateNumberOfMessagesNotVisible({
                period: Duration.minutes(5),
                label: 'In Flight',
              }),
            ],
            width: 12,
          }),
        ),
      );
    }

    // Add API Gateway metrics
    this.dashboard.addWidgets(
      new Row(
        new TextWidget({
          markdown: '## API Performance',
          width: 24,
          height: 1,
        }),
      ),
      new Row(
        new GraphWidget({
          title: 'API Request Count',
          left: [props.api.metricCount({ period: Duration.minutes(5) })],
          width: 12,
        }),
        new GraphWidget({
          title: 'API Latency',
          left: [props.api.metricLatency({ period: Duration.minutes(5) })],
          width: 12,
        }),
      ),
      new Row(
        new GraphWidget({
          title: 'API 4XX Errors',
          left: [props.api.metricClientError({ period: Duration.minutes(5) })],
          width: 12,
        }),
        new GraphWidget({
          title: 'API 5XX Errors',
          left: [props.api.metricServerError({ period: Duration.minutes(5) })],
          width: 12,
        }),
      ),
    );

    // Add DynamoDB metrics
    this.dashboard.addWidgets(
      new Row(
        new TextWidget({
          markdown: '## Database Performance',
          width: 24,
          height: 1,
        }),
      ),
      new Row(
        new GraphWidget({
          title: 'DynamoDB Read Capacity',
          left: [props.dynamoDBTable.metricConsumedReadCapacityUnits({ period: Duration.minutes(5) })],
          width: 12,
        }),
        new GraphWidget({
          title: 'DynamoDB Write Capacity',
          left: [props.dynamoDBTable.metricConsumedWriteCapacityUnits({ period: Duration.minutes(5) })],
          width: 12,
        }),
      ),
      new Row(
        new GraphWidget({
          title: 'DynamoDB User Errors',
          left: [props.dynamoDBTable.metricUserErrors({ period: Duration.minutes(5) })],
          width: 12,
        }),
        new GraphWidget({
          title: 'DynamoDB System Errors',
          left: [props.dynamoDBTable.metricSystemErrorsForOperations({ period: Duration.minutes(5) })],
          width: 12,
        }),
      ),
    );
  }
}
