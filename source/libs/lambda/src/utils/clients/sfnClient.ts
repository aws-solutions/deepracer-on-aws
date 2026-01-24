// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SFNClient } from '@aws-sdk/client-sfn';
import { logger, tracer } from '@deepracer-indy/utils';
import { getCustomUserAgent } from '@deepracer-indy/utils/src/customUserAgent';

export const sfnClient = tracer.captureAWSv3Client(new SFNClient({ logger, customUserAgent: getCustomUserAgent() }));
