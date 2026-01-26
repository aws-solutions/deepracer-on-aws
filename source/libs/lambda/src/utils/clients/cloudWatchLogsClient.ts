// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { logger, tracer } from '@deepracer-indy/utils';
import { getCustomUserAgent } from '@deepracer-indy/utils/src/customUserAgent';

export const cloudWatchLogsClient = tracer.captureAWSv3Client(
  new CloudWatchLogsClient({ logger, customUserAgent: getCustomUserAgent() }),
);
