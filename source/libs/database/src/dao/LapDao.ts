// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ConflictError, InternalFailureError, RunStatus } from '@deepracer-indy/typescript-server-client';
import { logger, logMethod } from '@deepracer-indy/utils';
import { Service } from 'electrodb';

import { BaseDao } from './BaseDao.js';
import { DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { LapItem, LapsEntity } from '../entities/LapsEntity.js';
import { LapTokenEntity } from '../entities/LapTokenEntity.js';
import { RunsEntity } from '../entities/RunsEntity.js';
import type { ResourceId } from '../types/resource.js';

/**
 * How long a CreateLap idempotency-token guard item lives before DynamoDB TTL reclaims it.
 * Retries happen within seconds; 24h is a generous upper bound that comfortably covers any
 * in-flight retry while keeping token items from accumulating indefinitely. TTL is best-effort
 * and does not affect correctness — the conditional write is the dedup fence.
 */
const LAP_TOKEN_TTL_SECONDS = 24 * 60 * 60;

export class LapDao extends BaseDao<LapsEntity> {
  private readonly service: Service<{ runs: RunsEntity; laps: LapsEntity; lapTokens: LapTokenEntity }>;

  constructor(runsEntity: RunsEntity, lapsEntity: LapsEntity, lapTokenEntity: LapTokenEntity) {
    super(lapsEntity);
    this.service = new Service({
      runs: runsEntity,
      laps: lapsEntity,
      lapTokens: lapTokenEntity,
    });
  }

  @logMethod
  async listByRun({ leaderboardId, runId }: { leaderboardId: ResourceId; runId: ResourceId }) {
    const result = await this.entity.query.byRunId({ leaderboardId, runId }).go();
    return { ...result, data: result.data.slice().sort((a, b) => a.lapNumber - b.lapNumber) };
  }

  /** Lists all laps for a run, for callers that explicitly require full aggregation. */
  @logMethod
  async listAllLapsByRun({ leaderboardId, runId }: { leaderboardId: ResourceId; runId: ResourceId }) {
    const result = await this.entity.query.byRunId({ leaderboardId, runId }).go({ pages: 'all' });
    return { ...result, data: result.data.slice().sort((a, b) => a.lapNumber - b.lapNumber) };
  }

  /**
   * Atomically assigns the next sequential lap number and creates the Lap item, in a single
   * DynamoDB transaction combining the parent Run and the new Lap:
   *
   * - Increments the Run's `lapCount`, conditioned on it still equaling `expectedLapCount`
   *   (optimistic concurrency check against the caller's most recent read).
   * - Creates the Lap item with `lapNumber = expectedLapCount + 1`, conditioned on that SK not
   *   already existing (duplicate-lap prevention).
   * - When `clientToken` is supplied, also creates an idempotency-guard item (LapTokenEntity),
   *   conditioned on that token's SK not already existing. This turns a *retried* CreateLap
   *   (e.g. after a lost response) into a ConflictError instead of a duplicate lap: the
   *   lapCount/SK guards only stop concurrent races (a retry re-reads the advanced lapCount and
   *   would otherwise write the next sequential lap), whereas the token is stable across retries.
   *
   * All writes commit together or none do — this closes the gap where an independent
   * counter increment could succeed while the Lap creation fails (or vice versa), which would
   * either burn a lap number or create a Lap without a matching counter update.
   *
   * @throws ConflictError if any condition fails (the Run's lapCount has moved on since the
   *   caller's read, a Lap with the target number already exists, or the clientToken was already
   *   used). The caller should retry with a fresh read, or reconcile against the persisted lap.
   */
  @logMethod
  async createNextLap({
    leaderboardId,
    runId,
    expectedLapCount,
    lapTimeMs,
    resets,
    deviceId,
    clientToken,
  }: {
    leaderboardId: ResourceId;
    runId: ResourceId;
    expectedLapCount: number;
    lapTimeMs: number;
    resets: number;
    deviceId?: ResourceId;
    clientToken?: string;
  }) {
    const lapNumber = expectedLapCount + 1;

    const transaction = this.service.transaction.write(({ runs, laps, lapTokens }) => [
      runs
        .patch({ leaderboardId, runId })
        .add({ [DynamoDBItemAttribute.LAP_COUNT]: 1 })
        .where(
          (attr, { eq }) =>
            `${eq(attr[DynamoDBItemAttribute.LAP_COUNT], expectedLapCount)} AND ${eq(
              attr.runStatus,
              RunStatus.IN_PROGRESS as typeof attr.runStatus,
            )}`,
        )
        .commit(),
      laps
        .create({
          leaderboardId,
          runId,
          lapNumber,
          lapTimeMs,
          resets,
          ...(deviceId !== undefined && { deviceId }),
        })
        .commit(),
      // Idempotency guard (only when the caller supplied a token). ElectroDB `create` adds an
      // attribute_not_exists condition on the token SK, so a replayed request cancels the whole
      // transaction. Omitted entirely when no token is provided — behavior is then unchanged.
      ...(clientToken === undefined
        ? []
        : [
            lapTokens
              .create({
                leaderboardId,
                runId,
                clientToken,
                lapNumber,
                [DynamoDBItemAttribute.TTL]: Math.floor(Date.now() / 1000) + LAP_TOKEN_TTL_SECONDS,
              })
              .commit(),
          ]),
    ]);

    const transactionResult = await transaction.go();

    if (transactionResult.canceled) {
      logger.warn('Lap creation transaction canceled — lapCount changed, lap-number conflict, or replayed token.', {
        leaderboardId,
        runId,
        expectedLapCount,
        lapNumber,
        hasClientToken: clientToken !== undefined,
        transactionResult,
      });
      throw new ConflictError({ message: 'Lap number conflict. Please retry.' });
    }

    const lapPutParams = (transaction.params().TransactItems[1] as { Put: { [param: string]: unknown } }).Put;
    const lapItem = this.entity.parse(lapPutParams).data as LapItem;

    if (!lapItem) {
      logger.error('Unable to parse created lap from transaction params.', { leaderboardId, runId, lapNumber });
      throw new InternalFailureError({ message: 'Unable to create lap.' });
    }

    return lapItem;
  }
}

export const lapDao = new LapDao(RunsEntity, LapsEntity, LapTokenEntity);
