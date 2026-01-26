// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as lambda from 'aws-lambda';

declare module 'aws-lambda' {
  interface APIGatewayEventRequestContextWithAuthorizer {
    operationName: string;
  }
}
