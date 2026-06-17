// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AttachPolicyCommand, IoTClient } from '@aws-sdk/client-iot';
import { logger } from '@deepracer-indy/utils';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { instrumentHandler } from '../utils/instrumentation/instrumentHandler.js';

const { IOT_POLICY_NAME } = process.env;
if (!IOT_POLICY_NAME) {
  throw new Error('Missing required environment variable: IOT_POLICY_NAME');
}

const iotClient = new IoTClient({});

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const identityId = event.requestContext?.identity?.cognitoIdentityId;

  if (!identityId) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ message: 'Missing identity' }) };
  }

  try {
    await iotClient.send(new AttachPolicyCommand({ policyName: IOT_POLICY_NAME, target: identityId }));

    logger.info('IoT policy attached', { identityId });
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  } catch (err) {
    logger.error('AttachPolicy failed', { error: err });
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ message: 'Internal server error' }) };
  }
};

export const lambdaHandler = instrumentHandler(handler);
