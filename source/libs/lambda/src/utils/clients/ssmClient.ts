// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SSMClient } from '@aws-sdk/client-ssm';
import { logger, tracer } from '@deepracer-indy/utils';
import { getCustomUserAgent } from '@deepracer-indy/utils/src/customUserAgent';

export const ssmClient = tracer.captureAWSv3Client(new SSMClient({ logger, customUserAgent: getCustomUserAgent() }));
