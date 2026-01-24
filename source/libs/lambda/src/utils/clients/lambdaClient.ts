// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LambdaClient } from '@aws-sdk/client-lambda';
import { logger, tracer } from '@deepracer-indy/utils';
import { getCustomUserAgent } from '@deepracer-indy/utils/src/customUserAgent';

export const lambdaClient = tracer.captureAWSv3Client(
  new LambdaClient({ logger, customUserAgent: getCustomUserAgent() }),
);
