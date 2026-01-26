// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logger } from '#index.js';

import type { MetricsLogData, SolutionMetricData } from './metricsTypes.js';

const UNKNOWN = 'UNKNOWN';

const metricsEndpoint = process.env.METRICS_ENDPOINT || 'https://metrics.awssolutionsbuilder.com/generic';
const solutionId = process.env.SOLUTION_ID || UNKNOWN;
const solutionVersion = process.env.SOLUTION_VERSION || UNKNOWN;
const account = process.env.ACCOUNT_ID || UNKNOWN;
const region = process.env.REGION || UNKNOWN;

function getDeploymentUuid(): string {
  const stackArn = process.env.STACK_ARN || '';
  if (!stackArn) {
    return UNKNOWN;
  }
  // ARN format: arn:aws:cloudformation:region:account:stack/stack-name/uuid
  const cloudFormationArnPattern = /^arn:aws:cloudformation:[^:]+:[^:]+:stack\/[^/]+\/(.+)$/;
  const match = stackArn.match(cloudFormationArnPattern);

  if (match?.[1]) {
    return match[1];
  }
  return UNKNOWN;
}

/**
 * Sends anonymized metrics data to the AWS Solutions Builder metrics endpoint.
 *
 * This function extracts the subscription key from the metrics data and enriches it
 * with solution metadata before sending it to the configured metrics endpoint.
 *
 * @param data - The metrics log data containing the subscription key and metric payload
 *
 * @throws {Error} When network request fails
 *
 * @example
 * ```typescript
 * await sendMetricsData({
 *   metricsLogSubscriptionKey: MetricsSubscriptionKeyValue.DAILY_HEART_BEAT,
 *   userCount: 10,
 *   modelCount: 50
 * });
 * ```
 *
 * @remarks
 * Uses the following environment variables (with fallback defaults):
 * - `METRICS_ENDPOINT` - The metrics collection endpoint URL (defaults to AWS Solutions Builder endpoint)
 * - `SOLUTION_ID` - Unique identifier for the solution (defaults to 'UNKNOWN')
 * - `SOLUTION_VERSION` - Version of the deployed solution (defaults to 'UNKNOWN')
 * - `DEPLOYMENT_UUID` - Unique identifier for this deployment (defaults to 'UNKNOWN')
 * - `ACCOUNT_ID` - AWS account ID for the deployment (defaults to 'UNKNOWN')
 * - `REGION` - AWS region for the deployment (defaults to 'UNKNOWN')
 */
export async function sendMetricsData(data: MetricsLogData) {
  const { metricsLogSubscriptionKey, ...actualMetricData } = data;

  const enrichedData: SolutionMetricData = {
    timestamp: new Date().toISOString(),
    solution: solutionId,
    version: solutionVersion,
    uuid: getDeploymentUuid(),
    event_name: metricsLogSubscriptionKey,
    context_version: 1,
    context: {
      ...actualMetricData,
      account,
      region,
    },
  };
  logger.debug('sendMetricsData', enrichedData);

  await fetch(metricsEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(enrichedData),
  });
}
