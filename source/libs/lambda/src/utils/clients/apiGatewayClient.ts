// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { APIGatewayClient } from '@aws-sdk/client-api-gateway';
import { logger, tracer } from '@deepracer-indy/utils';
import { getCustomUserAgent } from '@deepracer-indy/utils/src/customUserAgent';

export const apiGatewayClient = tracer.captureAWSv3Client(
  new APIGatewayClient({ logger, customUserAgent: getCustomUserAgent() }),
);
