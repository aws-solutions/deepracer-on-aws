// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Alarm, CompositeAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { ILogGroup } from 'aws-cdk-lib/aws-logs';

import { OperationsOwnedBy, StackKey } from '#constants/operationOwnership.js';

/**
 * Output contract every epic nested stack must satisfy.
 *
 * This is an interface, deliberately — epic stacks `implements EpicStack<K>` while
 * still extending `NestedStack` directly. There is no abstract base class:
 *
 * - There is no shared *construction* behaviour to hoist. What repeats (log group,
 *   Lambda, DynamoDB grant, Cognito grant, invoke permission) already lives in the
 *   `createEpicFunctions` factory. A base class would be a second, competing reuse
 *   mechanism sitting next to it.
 * - A base class would have to know the union of every epic's prop needs, which
 *   defeats the point of declaring props as `Pick<PlatformProps, ...>`.
 *
 * What genuinely needs enforcing is the *output* contract, and `implements` gives a
 * compile error for a forgotten member at zero runtime cost.
 */
export interface EpicStack<K extends StackKey> {
  /**
   * Smithy operation → Lambda function ARN, for exactly the operations this stack
   * owns per `OPERATION_OWNER`. Consumed by the stack that owns the API Gateway.
   *
   * Plain strings, not construct references: string props do not create implicit
   * CDK cross-stack dependency edges.
   */
  readonly handlerArns: Readonly<Record<OperationsOwnedBy<K>, string>>;

  /**
   * Alarms root wires into `MonitoringDashboard`. An empty array is a legitimate
   * choice for a stack with nothing worth alarming on — but it must be an explicit
   * empty array, not an omission, so the decision is visible in code review.
   */
  readonly alarms: readonly (Alarm | CompositeAlarm)[];

  /**
   * Log groups root wires into `LogInsights` query definitions.
   *
   * Epic constructs expose their shared API log group here so root can include it in
   * `LogInsights`' additional log groups when needed. The factory creates that group
   * directly with `new LogGroup` using the epic's `stackKey`.
   */
  readonly logGroups: readonly ILogGroup[];
}
