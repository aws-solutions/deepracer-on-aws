// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { leaderboardDao } from '@deepracer-indy/database';
import { logger } from '@deepracer-indy/utils';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import type { LiveRaceContext } from '../types/liveRaceContext.js';

/**
 * Clears currentExecutionArn on the leaderboard when the SF exits.
 * Runs as the last step before SF succeeds or on error cleanup.
 */
const handler = async (context: LiveRaceContext): Promise<LiveRaceContext> => {
  logger.info('START ClearExecutionLock', { leaderboardId: context.leaderboardId });

  await leaderboardDao.clearExecutionLock(context.leaderboardId);

  logger.info('Execution lock cleared', { leaderboardId: context.leaderboardId });
  return context;
};

export const clearExecutionLock = { handler };
export const lambdaHandler = instrumentHandler(handler);
