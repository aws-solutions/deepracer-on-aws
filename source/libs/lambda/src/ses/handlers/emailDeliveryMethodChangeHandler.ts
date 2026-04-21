// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logger } from '@deepracer-indy/utils';
import type { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from 'aws-lambda';

import { instrumentHandler } from '#utils/instrumentation/instrumentHandler.js';

/**
 * Logs email delivery method selection on stack create and update for audit purposes.
 * Delete requests return SUCCESS without logging.
 */
export const EmailDeliveryMethodChangeHandler = async (
  event: CloudFormationCustomResourceEvent,
): Promise<CloudFormationCustomResourceResponse> => {
  const physicalResourceId = 'email-delivery-method-audit';
  const { emailDeliveryMethod, sesVerifiedEmail } = event.ResourceProperties;

  if (event.RequestType === 'Delete') {
    return {
      Status: 'SUCCESS',
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
    };
  }

  const previousMethod = event.RequestType === 'Update' ? event.OldResourceProperties?.emailDeliveryMethod : undefined;

  logger.info('Email delivery method configuration', {
    requestType: event.RequestType,
    emailDeliveryMethod,
    sesVerifiedEmail: sesVerifiedEmail ?? 'N/A',
    previousMethod: previousMethod ?? 'N/A',
    changed: previousMethod !== undefined && previousMethod !== emailDeliveryMethod,
    timestamp: new Date().toISOString(),
  });

  return {
    Status: 'SUCCESS',
    PhysicalResourceId: physicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: {
      emailDeliveryMethod,
    },
  };
};

export const lambdaHandler = instrumentHandler(EmailDeliveryMethodChangeHandler);
