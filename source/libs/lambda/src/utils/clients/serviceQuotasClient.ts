// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ServiceQuotasClient } from '@aws-sdk/client-service-quotas';
import { logger, tracer } from '@deepracer-indy/utils';
import { getCustomUserAgent } from '@deepracer-indy/utils/src/customUserAgent';

export const serviceQuotasClient = tracer.captureAWSv3Client(
  new ServiceQuotasClient({ logger, customUserAgent: getCustomUserAgent() }),
);
