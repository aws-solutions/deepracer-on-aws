// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { CustomResource, Duration } from 'aws-cdk-lib';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

import { addCfnGuardSuppressionForAutoCreatedLambdas } from '#constructs/common/cfnGuardHelper.js';

import { LogGroupCategory } from '../common/logGroupsHelper.js';
import { functionNamePrefix, NodeLambdaFunction } from '../common/nodeLambdaFunction.js';

export interface EmailDeliveryMethodAuditProps {
  namespace: string;
  emailDeliveryMethod: string;
  sesVerifiedEmail: string;
}

/**
 * Logs email delivery method selection on every stack create or update for audit tracking.
 * Forces re-invocation on every deployment via a timestamp property.
 * Captures method changes by comparing current and previous resource properties.
 */
export class EmailDeliveryMethodAudit extends Construct {
  constructor(scope: Construct, id: string, props: EmailDeliveryMethodAuditProps) {
    super(scope, id);

    const auditFunction = new NodeLambdaFunction(this, 'EmailDeliveryMethodChangeFunction', {
      entry: path.join(__dirname, '../../../../../libs/lambda/src/ses/handlers/emailDeliveryMethodChangeHandler.ts'),
      functionName: `${functionNamePrefix}-EmailDeliveryMethodAudit`,
      logGroupCategory: LogGroupCategory.SYSTEM_EVENTS,
      namespace: props.namespace,
      timeout: Duration.seconds(10),
    });

    const provider = new Provider(this, 'EmailDeliveryMethodAuditProvider', {
      onEventHandler: auditFunction,
    });

    new CustomResource(this, 'EmailDeliveryMethodAuditResource', {
      serviceToken: provider.serviceToken,
      properties: {
        emailDeliveryMethod: props.emailDeliveryMethod,
        sesVerifiedEmail: props.sesVerifiedEmail,
        // Timestamp forces re-invocation on every deployment for audit tracking
        forceUpdate: Date.now().toString(),
      },
    });

    addCfnGuardSuppressionForAutoCreatedLambdas(this, 'EmailDeliveryMethodAuditProvider');
  }
}
