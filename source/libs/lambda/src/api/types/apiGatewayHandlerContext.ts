// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ResourceId } from '@deepracer-indy/database';
import type { APIGatewayProxyEventBase, APIGatewayProxyResult, Handler } from 'aws-lambda';

/**
 * Defines anything the operation handler needs that is not modeled
 * in the operation's Smithy model but comes from other context.
 */
export interface HandlerContext {
  profileId: ResourceId;
  operationName: string;
}

export interface APIGatewayProxyCognitoUserPoolAuthorizerContext {
  // All claims are coerced into strings.
  claims: {
    sub: string; // "24887448-80e1-7060-bb3a-8017c48ac0bb",
    email_verified: string; // "true",
    iss: string; // "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_mYuxoakIP",
    'cognito:username': ResourceId; // "testuser",
    origin_jti: string; // "dc4dd2bc-6bab-476d-a67b-2f21e421023b",
    aud: string; // "15q4ac1ff75shrh629uqip2opk",
    event_id: string; // "5dc51ef7-28d5-4415-bf70-7bfb90c04d39",
    token_use: string; // "id",
    auth_time: string; // "1722646652",
    exp: string; // "Sat Aug 03 01:57:32 UTC 2024",
    iat: string; // "Sat Aug 03 00:57:32 UTC 2024",
    jti: string; // "12da4e96-36d4-4fd6-8608-592072eb06ac",
    email: string; // "testuser@company.com"
  };
}

export type APIGatewayProxyWithCognitoUserPoolAuthorizerHandler = Handler<
  APIGatewayProxyEventBase<APIGatewayProxyCognitoUserPoolAuthorizerContext>,
  APIGatewayProxyResult
>;
