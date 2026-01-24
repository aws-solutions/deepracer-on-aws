// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SQSClient } from '@aws-sdk/client-sqs';
import { logger, tracer } from '@deepracer-indy/utils';
import { getCustomUserAgent } from '@deepracer-indy/utils/src/customUserAgent';

export const sqsClient = tracer.captureAWSv3Client(new SQSClient({ logger, customUserAgent: getCustomUserAgent() }));
