// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { APIGatewayProxyEvent, CloudFormationCustomResourceEvent } from 'aws-lambda';

// Type guard to check if event is a CloudFormation custom resource event
export function isCustomResourceEvent(event: unknown): event is CloudFormationCustomResourceEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'RequestType' in event &&
    'ResourceType' in event &&
    'LogicalResourceId' in event
  );
}

// Type guard to check if event is an API Gateway event
export function isAPIGatewayEvent(event: unknown): event is APIGatewayProxyEvent {
  return typeof event === 'object' && event !== null && 'httpMethod' in event && 'headers' in event;
}
