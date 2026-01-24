// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { convertEvent, convertVersion1Response } from '@aws-smithy/server-apigateway';
import type { ServiceHandler } from '@aws-smithy/server-common';
import { ResourceId } from '@deepracer-indy/database';
import { BadRequestError, InternalFailureError, UserGroups } from '@deepracer-indy/typescript-server-client';
import { logger, metrics } from '@deepracer-indy/utils';
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';

import { cognitoClient } from '#utils/clients/cognitoClient.js';

import { cognitoHelper } from '../../utils/CognitoHelper.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';

/**
 * Given a ServiceHandler, returns an APIGatewayProxyHandler that knows how to:
 * 1. Convert the APIGateway request (APIGatewayProxyEvent) into inputs for the ServiceHandler
 * 2. Invoke the ServiceHandler
 * 3. Convert the output of ServiceHandler into the result (APIGatewayProxyResult) expected by APIGateway
 */
export function getApiGatewayHandler(handler: ServiceHandler<HandlerContext>): APIGatewayProxyHandler {
  return instrumentHandler(async (event: APIGatewayProxyEvent, _lambdaContext) => {
    const cognitoAuthProvider = event.requestContext.identity.cognitoAuthenticationProvider;
    if (!cognitoAuthProvider) {
      throw new Error('Missing authentication provider');
    }
    const profileId: ResourceId = await getCognitoUserId(cognitoAuthProvider);

    const operationName = event.requestContext.operationName;

    // Add operation as default dimension to all metrics
    metrics.setDefaultDimensions({ Operation: operationName });

    // Append these values to all logs
    logger.appendKeys({
      profileId,
      operationName,
      apiGatewayExtendedRequestId: event.requestContext.extendedRequestId,
      sourceIpAddress: event.requestContext.identity.sourceIp,
    });

    // Extract anything from the APIGateway requestContext needed in the operation handler
    const handlerContext: HandlerContext = {
      profileId,
      operationName,
    };

    const httpRequest = convertEvent(event);
    const httpResponse = await handler.handle(httpRequest, handlerContext);

    httpResponse.headers['Access-Control-Allow-Origin'] = '*';
    httpResponse.headers['Access-Control-Expose-Headers'] = [
      'x-amzn-RequestId',
      'x-amzn-ErrorType',
      'x-amzn-ErrorMessage',
      'Date',
    ].join(',');

    return convertVersion1Response(httpResponse);
  });
}

/**
 * Returns the user name associated with a requestor's identity. Takes a Cognito authentication
 * provider string, parses the user pool id and user sub, and performs a filtered query on the
 * user pool to get the user name.
 * @param cognitoAuthProvider string containing various user details, including user pool id and sub.
 * @returns user name as shown in Cognito user pool, for use with database operations.
 */
export async function getCognitoUserId(cognitoAuthProvider: string) {
  // Get the user info from the request context
  if (!cognitoAuthProvider) {
    throw new Error('User is not authenticated');
  }

  // Extract the user pool ID from the first part of the string
  if (!cognitoAuthProvider.includes(',')) {
    throw new Error('Could not parse authentication provider');
  }

  // Extract the user sub from the second part
  if (!cognitoAuthProvider.includes('/')) {
    throw new Error('Could not parse authentication provider');
  }

  const userPoolId = cognitoAuthProvider.split(',')[0].split('/').pop();
  const sub = cognitoAuthProvider.split(',')[1].split(':').pop();

  if (!sub) {
    throw new Error('Could not parse sub');
  }

  if (!userPoolId) {
    throw new Error('Could not parse userPoolId');
  }

  const profileId = await cognitoHelper.getUsernameFromSub(userPoolId, sub);

  return profileId;
}

export async function isUserAdmin(profileId: ResourceId): Promise<boolean> {
  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) {
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }

  try {
    const response = await cognitoClient.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: userPoolId,
        Username: profileId,
      }),
    );

    return response.Groups?.some((group) => group.GroupName === UserGroups.ADMIN) ?? false;
  } catch (error) {
    logger.error('Failed to verify user permissions.');
    throw new BadRequestError({ message: 'Failed to verify user permissions.' });
  }
}
