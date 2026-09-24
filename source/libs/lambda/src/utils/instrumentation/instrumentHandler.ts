// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { tracer, metrics, logger } from '@deepracer-indy/utils';
import middy from '@middy/core';
import type { Handler } from 'aws-lambda';

/**
 * Wraps a lambda handler to add X-Ray tracing and metrics publishing.
 *
 * `logEvent` (default true) controls whether the incoming event is logged. Set it to false for
 * handlers whose event carries PII (e.g. the bulk-invite iteration, whose event contains an email
 * address) to avoid leaking that data into logs.
 */
export function instrumentHandler<Event, Result>(
  handler: Handler<Event, Result>,
  options: { logEvent?: boolean } = {},
) {
  return middy(handler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger, { logEvent: options.logEvent ?? true }))
    .use(logMetrics(metrics, { throwOnEmptyMetrics: false }));
}
