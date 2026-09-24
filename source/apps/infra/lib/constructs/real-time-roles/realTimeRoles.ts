// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration } from 'aws-cdk-lib';
import { Alarm, AlarmRule, ComparisonOperator, CompositeAlarm, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { OperationsOwnedBy } from '#constants/operationOwnership.js';
import { CompositeAlarmWrapper } from '#constructs/common/compositeAlarmWrapper.js';
import { createEpicFunctions, EpicFunctionProps } from '#constructs/common/epicConstructHelpers.js';

/** Operations this construct owns, derived from OPERATION_OWNER. */
type RealTimeRolesOperation = OperationsOwnedBy<'realTimeRoles'>;

/**
 * Lambda entry point paths relative to libs/lambda/src.
 *
 * Typed against `Record<RealTimeRolesOperation, string>` — a missing operation
 * is a compile error rather than a runtime 500.
 */
const ENTRY_POINTS = {
  GetEventLeaderboard: 'api/handlers/getEventLeaderboard',
  RegisterUser: 'race-management/registerUser',
} as const satisfies Record<RealTimeRolesOperation, string>;

export interface RealTimeRolesProps {
  readonly namespace: string;
  readonly dynamoDBTable: TableV2;
  readonly userPool: IUserPool;
  readonly encryptionKey: IKey;
}

/**
 * CDK construct for Real-Time Roles Lambda functions — race management API handlers.
 *
 * Owns: the race management API handlers, their IAM execution roles, log groups,
 * DynamoDB permissions, and error alarms.
 *
 * Does NOT own: DynamoDB table, Cognito user pool, API Gateway, or the
 * `Lambda::Permission` resources for API Gateway invoke — those belong to the
 * stack that owns the RestApi.
 */
export class RealTimeRoles extends Construct {
  /** Smithy operation name → Lambda function ARN. Surfaced by the parent stack. */
  public readonly handlerArns: Readonly<Record<RealTimeRolesOperation, string>>;

  /** Single composite alarm covering error rates across all handlers. */
  public readonly alarms: readonly (Alarm | CompositeAlarm)[];

  /** Shared API log group, for LogInsights wiring by root. */
  public readonly logGroups: readonly LogGroup[];

  constructor(scope: Construct, id: string, props: RealTimeRolesProps) {
    super(scope, id);

    const { namespace, dynamoDBTable, userPool, encryptionKey } = props;

    const epicProps: EpicFunctionProps = {
      namespace,
      stackKey: 'realTimeRoles',
      dynamoDBTable,
      userPool,
      encryptionKey,
      extraEnv: {
        USER_POOL_ID: userPool.userPoolId,
      },
    };

    // createEpicFunctions wires DynamoDB and Cognito ListUsers on every function.
    // Additional IAM grants are added below.
    const { functions, logGroup } = createEpicFunctions(this, __dirname, ENTRY_POINTS, epicProps);

    // RegisterUser needs Cognito admin permissions to create and manage users
    functions.RegisterUser.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminDeleteUser'],
        resources: [userPool.userPoolArn],
      }),
    );

    this.logGroups = [logGroup];

    this.handlerArns = Object.fromEntries(
      Object.entries(functions).map(([operation, fn]) => [operation, fn.functionArn]),
    ) as Record<RealTimeRolesOperation, string>;

    const errorAlarms = Object.entries(functions).map(
      ([operation, fn]) =>
        new Alarm(this, `${operation}ErrorsAlarm`, {
          metric: fn.metricErrors({ period: Duration.minutes(5) }),
          threshold: 1,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          treatMissingData: TreatMissingData.NOT_BREACHING,
          alarmDescription: `Real-Time Roles ${operation} handler reported errors`,
        }),
    );

    this.alarms = [
      new CompositeAlarmWrapper(this, 'RealTimeRolesLambdaErrorsAlarm', {
        prefix: namespace,
        alarmRule: AlarmRule.anyOf(...errorAlarms),
        alarmDescription: 'One or more Real-Time Roles Lambda handlers are reporting errors',
      }),
    ];
  }
}
