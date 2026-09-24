// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { raceStatsDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  GetRaceStatsServerInput,
  GetRaceStatsServerOutput,
  getGetRaceStatsHandler,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

const EMPTY_DEFAULTS: GetRaceStatsServerOutput = {
  totalEvents: 0,
  totalRacers: 0,
  totalRaces: 0,
  totalLaps: 0,
  totalValidLaps: 0,
  averageLapTimeMilliseconds: 0,
  fastestLapsEver: [],
  totalCountries: 0,
  eventsByCountry: [],
  eventsByMonth: [],
  eventTypeBreakdown: [],
};

export const GetRaceStatsOperation: Operation<
  GetRaceStatsServerInput,
  GetRaceStatsServerOutput,
  HandlerContext
> = async (_input, context) => {
  const { profileId } = context;

  if (!(await isUserAdmin(profileId))) {
    throw new BadRequestError({ message: 'Only administrators can view race statistics' });
  }

  const stats = await raceStatsDao.getGlobal();

  // Return zeroed defaults when no stats have been computed yet — absence of data
  // is an expected initial state, not an exceptional condition.
  if (!stats) {
    return EMPTY_DEFAULTS;
  }

  const averageLapTimeMilliseconds =
    stats.totalValidLaps > 0 ? Math.round(stats.sumValidLapTimeMs / stats.totalValidLaps) : 0;

  return {
    totalEvents: stats.totalEvents,
    totalRacers: stats.totalRacers,
    totalRaces: stats.totalRaces,
    totalLaps: stats.totalLaps,
    totalValidLaps: stats.totalValidLaps,
    averageLapTimeMilliseconds,
    fastestLapsEver: (stats.fastestLapsEver ?? []).map(
      (lap: { participantName: string; lapTimeMilliseconds: number; eventId: string; eventName?: string }) => ({
        participantName: lap.participantName,
        lapTimeMilliseconds: lap.lapTimeMilliseconds,
        eventId: lap.eventId,
        eventName: lap.eventName,
      }),
    ),
    totalCountries: stats.totalCountries,
    eventsByCountry: (stats.eventsByCountry ?? []).map(
      (e: { countryCode: string; events: number; races: number; laps: number }) => ({
        countryCode: e.countryCode,
        events: e.events,
        races: e.races,
        laps: e.laps,
      }),
    ),
    eventsByMonth: (stats.eventsByMonth ?? []).map(
      (m: { month: string; events: number; races: number; laps: number }) => ({
        month: m.month,
        events: m.events,
        races: m.races,
        laps: m.laps,
      }),
    ),
    eventTypeBreakdown: (stats.eventTypeBreakdown ?? []).map((t: { typeOfEvent: string; count: number }) => ({
      typeOfEvent: t.typeOfEvent,
      count: t.count,
    })),
  } satisfies GetRaceStatsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getGetRaceStatsHandler(instrumentOperation(GetRaceStatsOperation)));
