// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import {
  getJoinLeaderboardHandler,
  JoinLeaderboardServerInput,
  JoinLeaderboardServerOutput,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

/** This is the implementation of business logic of the JoinLeaderboard operation. */
export const JoinLeaderboardOperation: Operation<
  JoinLeaderboardServerInput,
  JoinLeaderboardServerOutput,
  HandlerContext
> = async (_input, _context) => {
  return {};
};

export const lambdaHandler = getApiGatewayHandler(
  getJoinLeaderboardHandler(instrumentOperation(JoinLeaderboardOperation)),
);
