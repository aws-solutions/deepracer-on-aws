// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Alarm, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { beforeEach, describe, expect, it } from 'vitest';

import { CompositeAlarmWrapper } from '../compositeAlarmWrapper.js';

describe('CompositeAlarmWrapper', () => {
  let app: App;
  let stack: Stack;
  let testAlarm: Alarm;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
    testAlarm = new Alarm(stack, 'TestAlarm', {
      metric: new Metric({ namespace: 'Test', metricName: 'TestMetric' }),
      threshold: 1,
      evaluationPeriods: 1,
    });
  });

  it('should create composite alarm without prefix', () => {
    new CompositeAlarmWrapper(stack, 'CompositeAlarm', {
      alarmRule: testAlarm,
    });

    const template = Template.fromStack(stack);
    expect(() => template.resourceCountIs('AWS::CloudWatch::CompositeAlarm', 1)).not.toThrow();
  });

  it('should create composite alarm with prefix', () => {
    new CompositeAlarmWrapper(stack, 'CompositeAlarm', {
      prefix: 'MyPrefix',
      alarmRule: testAlarm,
    });

    const template = Template.fromStack(stack);
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::CompositeAlarm', {
        AlarmName: Match.stringLikeRegexp('^MyPrefix-'),
      }),
    ).not.toThrow();
  });

  it('should generate unique alarm name', () => {
    const alarm1 = new CompositeAlarmWrapper(stack, 'Alarm1', {
      alarmRule: testAlarm,
    });
    const alarm2 = new CompositeAlarmWrapper(stack, 'Alarm2', {
      alarmRule: testAlarm,
    });

    expect(alarm1.alarmName).not.toBe(alarm2.alarmName);
  });

  it('should pass through composite alarm props', () => {
    new CompositeAlarmWrapper(stack, 'CompositeAlarm', {
      alarmRule: testAlarm,
      alarmDescription: 'Test description',
      actionsEnabled: false,
    });

    const template = Template.fromStack(stack);
    expect(() =>
      template.hasResourceProperties('AWS::CloudWatch::CompositeAlarm', {
        AlarmDescription: 'Test description',
        ActionsEnabled: false,
      }),
    ).not.toThrow();
  });
});
