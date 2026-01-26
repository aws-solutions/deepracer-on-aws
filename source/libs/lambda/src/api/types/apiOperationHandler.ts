// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';

import type { HandlerContext } from './apiGatewayHandlerContext.js';

export interface ApiOperationHandler<Input, Output> {
  handler: Operation<Input, Output, HandlerContext>;
}
