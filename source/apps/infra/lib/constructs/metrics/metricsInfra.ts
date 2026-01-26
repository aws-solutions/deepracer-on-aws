// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnCondition, CfnMapping, CfnResource, Fn, Aspects, IAspect } from 'aws-cdk-lib';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Construct, IConstruct } from 'constructs';

import { DailyHeartbeat } from './dailyHeartbeat';
import { MetricsReporter } from './metricsReporter';

class ConditionAspect implements IAspect {
  constructor(private condition: CfnCondition) {}

  visit(node: IConstruct): void {
    if (node instanceof CfnResource) {
      // eslint-disable-next-line no-param-reassign
      node.cfnOptions.condition = this.condition;
    }
  }
}

export interface MetricsInfraProps {
  solutionId: string;
  solutionVersion: string;
  dynamoDBTable: TableV2;
  sendAnonymizedData?: 'Yes' | 'No';
  namespace: string;
}

export class MetricsInfra extends Construct {
  constructor(scope: Construct, id: string, props: MetricsInfraProps) {
    super(scope, id);

    const { namespace, solutionId, solutionVersion, dynamoDBTable } = props;

    const metricsMapping = new CfnMapping(this, 'AnonymizedData', {
      mapping: {
        SendAnonymizedData: {
          Data: props.sendAnonymizedData ?? 'Yes',
        },
      },
    });

    const metricsCondition = new CfnCondition(this, 'SendAnonymizedData', {
      expression: Fn.conditionEquals(metricsMapping.findInMap('SendAnonymizedData', 'Data'), 'Yes'),
    });

    Aspects.of(this).add(new ConditionAspect(metricsCondition));

    new DailyHeartbeat(this, 'DailyHeartbeat', {
      dynamoDBTable,
      namespace,
    });

    new MetricsReporter(this, 'MetricsReporter', {
      solutionId,
      solutionVersion,
      namespace,
    });
  }
}
