// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import {
  TestRewardFunctionServerInput,
  TestRewardFunctionServerOutput,
  getTestRewardFunctionHandler,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { rewardFunctionValidator } from '../utils/RewardFunctionValidator.js';

/** This is the implementation of business logic for the TestRewardFunction operation. */
export const TestRewardFunctionOperation: Operation<
  TestRewardFunctionServerInput,
  TestRewardFunctionServerOutput,
  HandlerContext
> = async (input, _context) => {
  const response = await rewardFunctionValidator.validateRewardFunction(input, false);

  return response satisfies TestRewardFunctionServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getTestRewardFunctionHandler(instrumentOperation(TestRewardFunctionOperation)),
);
