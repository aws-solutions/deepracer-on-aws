// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { leaderboardDao } from '@deepracer-indy/database';
import { LiveEventStatus } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';
import type { LiveRaceContext } from '../types/liveRaceContext.js';

/**
 * Reads autoLaunchEnabled and liveEventStatus from DynamoDB.
 * Returns continueLoop=false if autolaunch is OFF or race is COMPLETED.
 */
const handler = async (context: LiveRaceContext): Promise<LiveRaceContext> => {
  logger.info('START CheckAutolaunch', { context });

  const leaderboard = await leaderboardDao.load({ leaderboardId: context.leaderboardId });

  // Stop looping if race is completed
  if (leaderboard.liveEventStatus === LiveEventStatus.COMPLETED) {
    logger.info('Race is COMPLETED, stopping loop');
    return { ...context, continueLoop: false };
  }

  const continueLoop = leaderboard.autoLaunchEnabled === true;
  logger.info('CheckAutolaunch result', { autoLaunchEnabled: leaderboard.autoLaunchEnabled, continueLoop });

  return { ...context, continueLoop };
};

export const checkAutolaunch = { handler };
export const lambdaHandler = instrumentHandler(handler);
