// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { gunzipSync } from 'zlib';

import { logger, sendMetricsData, MetricsSubscriptionKeyValue } from '@deepracer-indy/utils';
import { metricsLogDataField } from '@deepracer-indy/utils/src/metrics/metricsLogger';
import { metricsLogSubscriptionKeyField, type MetricsLogData } from '@deepracer-indy/utils/src/metrics/metricsTypes';
import type { CloudWatchLogsEvent } from 'aws-lambda';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

/**
 * Validates if the metrics log data has the required structure and subscription key field
 */
const isValidMetricsLogData = (metricsLogData: unknown): metricsLogData is MetricsLogData => {
  return (
    metricsLogData !== null &&
    metricsLogData !== undefined &&
    typeof metricsLogData === 'object' &&
    metricsLogSubscriptionKeyField in metricsLogData
  );
};

/**
 * Validates if the subscription key is one of the allowed enum values
 */
const isValidSubscriptionKey = (subscriptionKey: unknown): subscriptionKey is MetricsSubscriptionKeyValue => {
  return Object.values(MetricsSubscriptionKeyValue).includes(subscriptionKey as MetricsSubscriptionKeyValue);
};

/**
 * Validates metrics log data and returns validation result
 */
const validateMetricsLogData = (metricsLogData: unknown) => {
  if (!isValidMetricsLogData(metricsLogData)) {
    return {
      isValid: false as const,
      errorMessage: 'No valid metricsLogData with subscription key found',
    };
  }

  const subscriptionKey = metricsLogData[metricsLogSubscriptionKeyField];

  if (!isValidSubscriptionKey(subscriptionKey)) {
    return {
      isValid: false as const,
      errorMessage: `metricsLogData with invalid subscription key: ${subscriptionKey}`,
    };
  }

  return {
    isValid: true as const,
  };
};

/**
 * Processes subscribed metrics logs from CloudWatch Logs
 * Decompresses log data and sends metrics to the analytics endpoint
 */
const processSubscribedMetricsLogs = async (event: CloudWatchLogsEvent): Promise<void> => {
  try {
    // Decode and decompress the log data
    const compressedPayload = Buffer.from(event.awslogs.data, 'base64');
    const uncompressedPayload = gunzipSync(compressedPayload);
    const logData = JSON.parse(uncompressedPayload.toString('utf8'));

    if (logData.logEvents && Array.isArray(logData.logEvents)) {
      await Promise.all(
        logData.logEvents.map(
          async (
            logEvent: {
              message: string;
            },
            index: number,
          ) => {
            try {
              const logEntry = JSON.parse(logEvent.message);
              const metricsLogData = logEntry[metricsLogDataField];

              const validation = validateMetricsLogData(metricsLogData);

              if (!validation.isValid) {
                logger.warn(`Skipping log event ${index + 1}: ${validation.errorMessage}`, { metricsLogData });
                return;
              }

              logger.info(`Log Event ${index + 1}: Sending metricsLogData`, {
                metricsLogData,
              });
              await sendMetricsData(metricsLogData);
            } catch (logEventError) {
              // Log individual log event processing errors but don't fail the entire batch
              logger.error(`Error processing log event ${index + 1}:`, { error: logEventError, logEvent });
            }
          },
        ),
      );
    }
  } catch (error) {
    logger.error('Error processing CloudWatch Logs event:', { error });
    throw error;
  }
};

export const lambdaHandler = instrumentHandler(processSubscribedMetricsLogs);
