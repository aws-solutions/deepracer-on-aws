// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Logger } from '@aws-lambda-powertools/logger';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { metricsLogDataField, MetricsLogger } from '../metricsLogger.js';
import { MetricsSubscriptionKeyValue, metricsLogSubscriptionKeyField } from '../metricsTypes.js';

describe('MetricsLogger', () => {
  let logger: Logger;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let metricsLogger: MetricsLogger;

  beforeEach(() => {
    logger = new Logger();
    infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    metricsLogger = new MetricsLogger(logger);
  });

  it('logRunsCompleted logs the RUNS_COMPLETED subscription key', () => {
    metricsLogger.logRunsCompleted();

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(MetricsSubscriptionKeyValue.RUNS_COMPLETED),
      expect.objectContaining({
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.RUNS_COMPLETED,
      }),
    );
  });

  it('logLapsRecorded logs the LAPS_RECORDED subscription key with provided data', () => {
    metricsLogger.logLapsRecorded({ leaderboardId: 'lb-1', runId: 'run-1' });

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(MetricsSubscriptionKeyValue.LAPS_RECORDED),
      expect.objectContaining({
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.LAPS_RECORDED,
        [metricsLogDataField]: expect.objectContaining({ leaderboardId: 'lb-1', runId: 'run-1' }),
      }),
    );
  });

  it('logLapsRecorded works with no data provided', () => {
    metricsLogger.logLapsRecorded();

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(MetricsSubscriptionKeyValue.LAPS_RECORDED),
      expect.objectContaining({
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.LAPS_RECORDED,
      }),
    );
  });

  it('logLapValiditySet logs the LAP_VALIDITY_SET subscription key with provided data', () => {
    metricsLogger.logLapValiditySet({ leaderboardId: 'lb-1', runId: 'run-1', isValid: false });

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(MetricsSubscriptionKeyValue.LAP_VALIDITY_SET),
      expect.objectContaining({
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.LAP_VALIDITY_SET,
        [metricsLogDataField]: expect.objectContaining({ isValid: false }),
      }),
    );
  });

  it('logCombinedLeaderboardRecomputed logs the COMBINED_LEADERBOARD_RECOMPUTED subscription key', () => {
    metricsLogger.logCombinedLeaderboardRecomputed();

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(MetricsSubscriptionKeyValue.COMBINED_LEADERBOARD_RECOMPUTED),
      expect.objectContaining({
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.COMBINED_LEADERBOARD_RECOMPUTED,
      }),
    );
  });

  it('logCombinedLeaderboardRecomputeFailed logs the COMBINED_LEADERBOARD_RECOMPUTE_FAILED subscription key with provided data', () => {
    metricsLogger.logCombinedLeaderboardRecomputeFailed({ eventId: 'evt-1', reason: 'timeout' });

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(MetricsSubscriptionKeyValue.COMBINED_LEADERBOARD_RECOMPUTE_FAILED),
      expect.objectContaining({
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.COMBINED_LEADERBOARD_RECOMPUTE_FAILED,
        [metricsLogDataField]: expect.objectContaining({ eventId: 'evt-1', reason: 'timeout' }),
      }),
    );
  });

  it('accepts a custom message override', () => {
    metricsLogger.logRunsCompleted('custom message');

    expect(infoSpy).toHaveBeenCalledWith(
      'custom message',
      expect.objectContaining({
        [metricsLogSubscriptionKeyField]: MetricsSubscriptionKeyValue.RUNS_COMPLETED,
      }),
    );
  });
});
