// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SageMakerClient } from '@aws-sdk/client-sagemaker';
import { logger, tracer } from '@deepracer-indy/utils';
import { getCustomUserAgent } from '@deepracer-indy/utils/src/customUserAgent';

export const sageMakerClient = tracer.captureAWSv3Client(
  new SageMakerClient({ logger, customUserAgent: getCustomUserAgent() }),
);
