// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnCondition, Duration, Fn, IResolveContext, Lazy, Stack } from 'aws-cdk-lib';
import { SpecRestApi } from 'aws-cdk-lib/aws-apigateway';
import {
  Alarm,
  AlarmStatusWidget,
  CfnAlarm,
  CfnDashboard,
  CompositeAlarm,
  Dashboard,
  GraphWidget,
  Metric,
  Row,
  SingleValueWidget,
  TextWidget,
} from 'aws-cdk-lib/aws-cloudwatch';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

interface MonitoringDashboardAlarms {
  systemAlarms: (Alarm | CompositeAlarm)[];
  emailAlarms: CfnAlarm[];
}

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
  alarms?: MonitoringDashboardAlarms;

  /**
   * Optional: SQS queues to monitor
   */
  queues?: IQueue[];

  /**
   * Optional: CfnCondition that controls whether SES email alarms are created
   */
  isSesEnabled?: CfnCondition;
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

    // System alarms status widget
    if (props.alarms?.systemAlarms && props.alarms.systemAlarms.length > 0) {
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
            alarms: props.alarms.systemAlarms,
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
            'Current ml.c7i.4xlarge training job usage. ' +
            '[View quota limits and utilization](https://console.aws.amazon.com/servicequotas/home/services/sagemaker/quotas/L-1EC4D7FD)',
          width: 24,
          height: 2,
        }),
      ),
      new Row(
        new GraphWidget({
          title: 'ml.c7i.4xlarge Training Jobs In Use',
          left: [
            new Metric({
              namespace: 'AWS/Usage',
              metricName: 'ResourceCount',
              dimensionsMap: {
                Type: 'Resource',
                Resource: 'training-job/ml.c7i.4xlarge',
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

    // Email section — header and daily email count are always shown.
    // SES alarm status widget is conditionally injected via Fn::If escape hatch.
    const emailSentMetric = new Metric({
      namespace: 'DeepRacerOnAWS/Email',
      metricName: 'TransactionalEmailSent',
      dimensionsMap: {
        Namespace: props.namespace,
      },
      period: Duration.days(1),
      statistic: 'Sum',
      label: 'Number of authentication emails sent today.',
    });

    this.dashboard.addWidgets(
      new Row(
        new TextWidget({
          markdown: '## Email',
          width: 24,
          height: 1,
        }),
      ),
      new Row(
        new SingleValueWidget({
          title: 'Daily authentication email count',
          metrics: [emailSentMetric],
          width: 8,
          setPeriodToTimeRange: true,
        }),
      ),
    );

    // Append conditional SES alarm widget at the end of the dashboard body.
    const emailAlarms = props.alarms?.emailAlarms ?? [];
    if (emailAlarms.length > 0 && props.isSesEnabled) {
      this.appendConditionalSesAlarmWidget(emailAlarms, props.isSesEnabled);
    }
  }

  /**
   * Appends a conditional SES alarm status widget to the end of the dashboard body
   * using a CfnDashboard escape hatch. The widget is only rendered when SES is enabled.
   *
   * Since the email section is the last section added to the dashboard, this appends
   * the conditional widget JSON right before the closing "]}" of the dashboard body.
   */
  private appendConditionalSesAlarmWidget(alarms: CfnAlarm[], condition: CfnCondition): void {
    const alarmArnsJson = Fn.join(
      '","',
      alarms.map((a) => a.attrArn),
    );

    const sesAlarmWidgetJson = Fn.join('', [
      ',{"type":"alarm","width":24,"height":3,"properties":{"title":"SES Alarm Status","alarms":["',
      alarmArnsJson,
      '"]}}',
    ]);

    const conditionalFragment = Fn.conditionIf(condition.logicalId, sesAlarmWidgetJson, '').toString();

    const cfnDashboard = this.dashboard.node.defaultChild as CfnDashboard;
    const originalBody = cfnDashboard.dashboardBody;

    cfnDashboard.dashboardBody = Lazy.uncachedString({
      produce: (context: IResolveContext) => {
        const resolved = context.resolve(originalBody);
        const joinArray: unknown[] = resolved['Fn::Join'][1];

        // The last element ends with "]}" closing the widgets array and dashboard object.
        // Insert the conditional fragment just before it.
        const lastIndex = joinArray.length - 1;
        const lastElement = joinArray[lastIndex] as string;
        if (typeof lastElement === 'string' && lastElement.endsWith(']}')) {
          joinArray[lastIndex] = lastElement.slice(0, -2);
          joinArray.push(context.resolve(conditionalFragment));
          joinArray.push(']}');
        }

        return resolved;
      },
    });
  }
}
