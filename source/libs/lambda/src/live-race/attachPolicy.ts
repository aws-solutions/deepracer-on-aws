// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AttachPolicyCommand, DetachPolicyCommand, IoTClient } from '@aws-sdk/client-iot';
import { logger, metrics } from '@deepracer-indy/utils';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { getCognitoUserId, isUserAdminOrFacilitator } from '../api/utils/apiGateway.js';
import { instrumentHandler } from '../utils/instrumentation/instrumentHandler.js';

// Endpoint auth: the connect route is protected by IAM authorization on the API Gateway method;
// only authenticated Cognito identities in the authenticated roles can invoke it. Unauthenticated
// identities have no execute-api permission on this route.

// Base (subscribe-only) policy attached to every authenticated identity.
const { IOT_POLICY_NAME } = process.env;
// Publish-capable policy attached only to admins / race facilitators.
const { IOT_PUBLISH_POLICY_NAME } = process.env;
if (!IOT_POLICY_NAME) {
  throw new Error('Missing required environment variable: IOT_POLICY_NAME');
}
if (!IOT_PUBLISH_POLICY_NAME) {
  throw new Error('Missing required environment variable: IOT_PUBLISH_POLICY_NAME');
}
// Consumed by isUserAdminOrFacilitator (via getUserGroups). Guarded here so a missing value fails
// fast at init rather than silently downgrading every admin/facilitator to the base policy.
if (!process.env.USER_POOL_ID) {
  throw new Error('Missing required environment variable: USER_POOL_ID');
}

const iotClient = new IoTClient({});

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };

/**
 * Resolves the caller's group server-side to choose the publish-capable vs base policy. The connect
 * endpoint uses IAM auth, so Cognito `claims["cognito:groups"]` are unavailable — we parse the sub
 * from `cognitoAuthenticationProvider` and call `AdminListGroupsForUser`. Fails closed to the base
 * policy on any error, and emits a `GroupResolutionFailure` metric so a sustained upstream issue
 * (throttling, IAM misconfig, parse errors) is alarmable rather than silent.
 */
const callerIsAdminOrFacilitator = async (event: APIGatewayProxyEvent): Promise<boolean> => {
  const cognitoAuthProvider = event.requestContext?.identity?.cognitoAuthenticationProvider;
  if (!cognitoAuthProvider) {
    return false;
  }
  try {
    const profileId = await getCognitoUserId(cognitoAuthProvider);
    return await isUserAdminOrFacilitator(profileId);
  } catch (err) {
    logger.warn('Could not resolve caller group; defaulting to base IoT policy', { error: err });
    metrics.addMetric('GroupResolutionFailure', 'Count', 1);
    return false;
  }
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const identityId = event.requestContext?.identity?.cognitoIdentityId;

  if (!identityId) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ message: 'Missing identity' }) };
  }

  const privileged = await callerIsAdminOrFacilitator(event);
  const selectedPolicy = privileged ? IOT_PUBLISH_POLICY_NAME : IOT_POLICY_NAME;
  const otherPolicy = privileged ? IOT_POLICY_NAME : IOT_PUBLISH_POLICY_NAME;

  // Attach the correct policy first (additive & idempotent), then detach the stale one. Order
  // matters: detaching first and then failing the attach would leave the caller with no policy.
  try {
    await iotClient.send(new AttachPolicyCommand({ policyName: selectedPolicy, target: identityId }));
  } catch (err) {
    logger.error('AttachPolicy failed', { error: err });
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ message: 'Internal server error' }) };
  }

  // Best-effort detach so a role change (e.g. a demoted facilitator) is revoked on the next
  // connect. Non-fatal: the caller already has the correct policy.
  try {
    await iotClient.send(new DetachPolicyCommand({ policyName: otherPolicy, target: identityId }));
  } catch (err) {
    logger.warn('Detach of non-selected IoT policy failed (ignored)', { error: err, policyName: otherPolicy });
  }

  logger.info('IoT policy attached', { identityId, policyName: selectedPolicy });
  return { statusCode: 200, headers: CORS_HEADERS, body: '' };
};

export const lambdaHandler = instrumentHandler(handler);
