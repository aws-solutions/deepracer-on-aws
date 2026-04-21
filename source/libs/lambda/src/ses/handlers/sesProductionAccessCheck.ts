// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetAccountCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { logger } from '@deepracer-indy/utils';
import type { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from 'aws-lambda';

import { instrumentHandler } from '#utils/instrumentation/instrumentHandler.js';

const sesv2Client = new SESv2Client({});

const SES_PRODUCTION_ACCESS_ERROR =
  'SES production access is not enabled for this account. ' +
  'Please request production access in the SES console before deploying with SES email delivery.';

/**
 * Calls ses:GetAccount and throws if ProductionAccessEnabled is false, causing CloudFormation to roll back.
 * Skips check when emailDeliveryMethod is not SES; delete requests always return SUCCESS.
 */
export const SesProductionAccessCheck = async (
  event: CloudFormationCustomResourceEvent,
): Promise<CloudFormationCustomResourceResponse> => {
  const physicalResourceId = 'ses-production-access-check';
  const { emailDeliveryMethod } = event.ResourceProperties;

  // No cleanup needed on stack deletion
  if (event.RequestType === 'Delete') {
    logger.info('Delete request, no action needed');
    return {
      Status: 'SUCCESS',
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
    };
  }

  // Skip check when SES is not selected
  if (emailDeliveryMethod !== 'SES') {
    logger.info('Email delivery method is not SES, skipping production access check');
    return {
      Status: 'SUCCESS',
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
    };
  }

  logger.info('Checking SES production access status');

  let response;
  try {
    response = await sesv2Client.send(new GetAccountCommand({}));
  } catch (error) {
    logger.error('Failed to call ses:GetAccount', { error });
    throw new Error(
      'Unable to verify SES production access. Ensure the Lambda execution role has ses:GetAccount permission and try again.',
    );
  }

  const productionAccessEnabled = response.ProductionAccessEnabled ?? false;
  logger.info('SES account status retrieved', { productionAccessEnabled });

  if (!productionAccessEnabled) {
    throw new Error(SES_PRODUCTION_ACCESS_ERROR);
  }

  return {
    Status: 'SUCCESS',
    PhysicalResourceId: physicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: {
      ProductionAccessEnabled: 'true',
    },
  };
};

export const lambdaHandler = instrumentHandler(SesProductionAccessCheck);
