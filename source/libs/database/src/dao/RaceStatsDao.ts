// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { RaceStatsEntity, RaceStatsItem } from '../entities/RaceStatsEntity.js';

export class RaceStatsDao extends BaseDao<RaceStatsEntity> {
  /**
   * Reads the global aggregate stats item (SK = 'GLOBAL').
   * Returns null if no stats have been computed yet.
   */
  @logMethod
  async getGlobal(): Promise<RaceStatsItem | null> {
    const response = await this.entity.get({}).go();
    return response.data ?? null;
  }

  /**
   * Overwrites the global aggregate stats item with the provided values.
   * Full replace — no incremental read-modify-write.
   */
  @logMethod
  async putGlobal(stats: {
    totalEvents: number;
    totalRacers: number;
    totalLaps: number;
    totalValidLaps: number;
    totalRaces: number;
    sumValidLapTimeMs: number;
    fastestLapsEver: Array<{
      participantName: string;
      lapTimeMilliseconds: number;
      eventId: string;
      eventName?: string;
    }>;
    totalCountries: number;
    eventsByCountry: Array<{ countryCode: string; events: number; races: number; laps: number }>;
    eventsByMonth: Array<{ month: string; events: number; races: number; laps: number }>;
    eventTypeBreakdown: Array<{ typeOfEvent: string; count: number }>;
  }): Promise<void> {
    await this.entity
      .put({
        totalEvents: stats.totalEvents,
        totalRacers: stats.totalRacers,
        totalLaps: stats.totalLaps,
        totalValidLaps: stats.totalValidLaps,
        totalRaces: stats.totalRaces,
        sumValidLapTimeMs: stats.sumValidLapTimeMs,
        fastestLapsEver: stats.fastestLapsEver,
        totalCountries: stats.totalCountries,
        eventsByCountry: stats.eventsByCountry,
        eventsByMonth: stats.eventsByMonth,
        eventTypeBreakdown: stats.eventTypeBreakdown,
      })
      .go();
  }
}

export const raceStatsDao = new RaceStatsDao(RaceStatsEntity);
