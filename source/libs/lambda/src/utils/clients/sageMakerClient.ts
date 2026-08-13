// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SageMakerClient } from '@aws-sdk/client-sagemaker';
import { logger, tracer } from '@deepracer-indy/utils';
import { getCustomUserAgent } from '@deepracer-indy/utils/src/customUserAgent';

export const sageMakerClient = tracer.captureAWSv3Client(
  new SageMakerClient({
    logger,
    customUserAgent: getCustomUserAgent(),
    // The account-level quota for ListTrainingJobs is 2 requests/second and is not
    // adjustable. Bursts of calls therefore throttle easily, and the SDK default
    // (standard mode, 3 attempts) is not enough to absorb them: a ThrottlingException
    // fails the JobDispatcher invocation, which returns the message to the FIFO queue
    // and blocks every job behind it.
    // Adaptive mode adds client-side rate limiting on top of exponential backoff, so
    // the client slows itself down instead of adding to the congestion.
    retryMode: 'adaptive',
    maxAttempts: 10,
  }),
);
