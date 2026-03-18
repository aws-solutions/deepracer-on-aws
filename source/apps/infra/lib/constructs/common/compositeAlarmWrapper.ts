// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CompositeAlarm, CompositeAlarmProps } from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

import { generateUniqueConstructId } from '#stacks/utils/helpers.js';

export interface CompositeAlarmWrapperProps extends CompositeAlarmProps {
  prefix?: string;
}

export class CompositeAlarmWrapper extends CompositeAlarm {
  constructor(scope: Construct, id: string, props: CompositeAlarmWrapperProps) {
    const prefix = props.prefix ? `${props.prefix}-` : '';
    const alarmName = generateUniqueConstructId(scope, prefix, id);
    super(scope, id, {
      ...props,
      compositeAlarmName: alarmName,
    });
  }
}
