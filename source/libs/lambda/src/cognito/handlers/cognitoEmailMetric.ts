// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { logger } from '@deepracer-indy/utils';
import type { CustomMessageTriggerHandler } from 'aws-lambda';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

const cloudwatch = new CloudWatchClient({});

export const CognitoEmailMetricHandler: CustomMessageTriggerHandler = async (event) => {
  logger.info('CognitoEmailMetricHandler lambda start', { triggerSource: event.triggerSource });

  try {
    await cloudwatch.send(
      new PutMetricDataCommand({
        Namespace: 'DeepRacerOnAWS/Email',
        MetricData: [
          {
            MetricName: 'TransactionalEmailSent',
            Value: 1,
            Unit: 'Count',
            Dimensions: [
              {
                Name: 'Namespace',
                Value: process.env.NAMESPACE ?? 'default',
              },
            ],
          },
        ],
      }),
    );
  } catch (error) {
    logger.warn('Failed to publish email metric', { error });
  }

  return event;
};

export const lambdaHandler = instrumentHandler(CognitoEmailMetricHandler);
