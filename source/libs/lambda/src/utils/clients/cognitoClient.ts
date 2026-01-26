// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { logger, tracer } from '@deepracer-indy/utils';
import { getCustomUserAgent } from '@deepracer-indy/utils/src/customUserAgent';

export const cognitoClient = tracer.captureAWSv3Client(
  new CognitoIdentityProviderClient({ logger, customUserAgent: getCustomUserAgent() }),
);
