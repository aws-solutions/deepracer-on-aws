// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TransactWriteItemsCommand, type TransactWriteItem } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { ConflictError, InternalFailureError, RunStatus } from '@deepracer-indy/typescript-server-client';
import { logger, logMethod } from '@deepracer-indy/utils';
import { CreateEntityItem } from 'electrodb';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { ELECTRO_DB_MAX_CONCURRENCY } from '../constants/electroDB.js';
import { DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { RankingsEntity, type RankingItem } from '../entities/RankingsEntity.js';
import { RunsEntity } from '../entities/RunsEntity.js';
import { SubmissionItem, SubmissionsEntity } from '../entities/SubmissionsEntity.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { electroDBEventLogger } from '../utils/electroDBEventLogger.js';

export class RankingDao extends BaseDao<RankingsEntity> {
  constructor(
    private readonly runsEntity: RunsEntity,
    private readonly submissionsEntity: SubmissionsEntity,
    rankingsEntity: RankingsEntity,
  ) {
    super(rankingsEntity);
  }

  @logMethod
  listByRank({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
    leaderboardId,
  }: {
    cursor?: string | null;
    maxResults?: number;
    leaderboardId: ResourceId;
  }) {
    return this.entity.query.sortedByRank({ leaderboardId }).go({ cursor, limit: maxResults, order: 'asc' });
  }

  @logMethod
  async getWithRank({ leaderboardId, profileId }: { leaderboardId: ResourceId; profileId: ResourceId }) {
    const rankingItem = await this._get({ leaderboardId, profileId });

    if (!rankingItem) {
      return null;
    }

    const { data: rankings } = await this.entity.query
      .sortedByRank({ leaderboardId })
      .lt({ rankingScore: rankingItem.rankingScore })
      .go({ order: 'asc', pages: 'all' });

    return {
      ...rankingItem,
      rank: rankings.length + 1,
    };
  }

  /**
   * Atomically advances a FINISHED Run to SUBMITTED, creates its Submission,
   * and conditionally writes the racer's best Ranking.
   *
   * When a new best score replaces an existing Ranking, the patch refreshes
   * stats and userProfile from the new best submission (mirroring the
   * virtual-race jobFinalizer path) so the leaderboard keeps showing the best
   * submission's data. submissionVideoS3Location is left untouched because
   * physical runs have no submission video. The patch uses
   * `patch().add({ version: 1 }).set()` following the application item-version
   * convention used by BaseDao._update. The ElectroDB entity-model version
   * remains the static schema value `'1'`.
   *
   * DynamoDB cancels every transaction item when any condition fails. A
   * Ranking-side condition failure therefore requires a fresh read and a new
   * transaction; it cannot be treated as a successful Run transition or
   * Submission create. This method retries once, then returns ConflictError
   * when Ranking contention persists.
   */
  @logMethod
  async recordSubmission({
    runId,
    submission,
    stats,
    userProfile,
  }: {
    runId: ResourceId;
    submission: CreateEntityItem<SubmissionsEntity>;
    stats: RankingItem['stats'];
    userProfile: RankingItem['userProfile'];
  }): Promise<SubmissionItem> {
    const { leaderboardId, profileId, rankingScore, modelId, modelName, submissionId, submissionNumber } = submission;

    // rankingScore/modelName/submissionNumber are optional on SubmissionsEntity's
    // CreateEntityItem type (rankingScore isn't required for virtual submissions;
    // modelName/submissionId are readOnly/defaulted there) but every caller of
    // recordSubmission (the physical-race SUBMITTED pipeline) always supplies
    // them, and RankingsEntity requires all three. Guard once, narrow once,
    // rather than scattering non-null assertions through the create/patch below.
    if (rankingScore == null || modelName == null || submissionId == null || submissionNumber == null) {
      throw new InternalFailureError({
        message: 'rankingScore, modelName, submissionId, and submissionNumber are required to record a submission.',
      });
    }
    const rankingFields = { rankingScore, modelName, submissionNumber };
    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const existingRanking = await this._get({ leaderboardId, profileId });
      const shouldUpdateRanking = existingRanking === null || rankingScore < existingRanking.rankingScore;
      const runUpdate = this.runsEntity
        .patch({ leaderboardId, runId })
        .set({
          [DynamoDBItemAttribute.RUN_STATUS]: RunStatus.SUBMITTED,
          [DynamoDBItemAttribute.SUBMISSION_ID]: submissionId,
        })
        .where((attr, { eq }) => eq(attr.runStatus, RunStatus.FINISHED as typeof attr.runStatus))
        .params();
      const submissionPut = this.submissionsEntity.create(submission).params();
      const rankingWrite = shouldUpdateRanking
        ? this._buildRankingWrite({
            existingRanking,
            leaderboardId,
            profileId,
            modelId,
            submissionId,
            rankingScore,
            rankingFields,
            stats,
            userProfile,
          })
        : null;
      const transactionItems: TransactWriteItem[] = [
        { Update: runUpdate as TransactWriteItem['Update'] },
        { Put: submissionPut as TransactWriteItem['Put'] },
        ...(rankingWrite ? [rankingWrite as TransactWriteItem] : []),
      ];

      try {
        await dynamoDBClient.send(
          new TransactWriteItemsCommand({
            TransactItems: transactionItems.map(marshallTransactWriteItem),
          }),
        );
      } catch (err) {
        if (isRetryableRankingConflict(err, attempt, maxAttempts)) {
          continue;
        }
        throw translateTransactionError(err, { leaderboardId, profileId, runId, submissionId, rankingScore });
      }

      return this.submissionsEntity.parse(submissionPut).data as SubmissionItem;
    }

    throw new ConflictError({ message: 'Ranking changed concurrently. Please retry.' });
  }

  /**
   * Builds the transaction item for the Ranking side of `recordSubmission`.
   * When a Ranking already exists, patches it in place (refreshing stats and
   * userProfile from the new best submission while preserving
   * submissionVideoS3Location) guarded by an optimistic rankingScore condition.
   * Otherwise creates a new Ranking with the submission's stats and profile.
   */
  private _buildRankingWrite({
    existingRanking,
    leaderboardId,
    profileId,
    modelId,
    submissionId,
    rankingScore,
    rankingFields,
    stats,
    userProfile,
  }: {
    existingRanking: Awaited<ReturnType<RankingDao['_get']>>;
    leaderboardId: ResourceId;
    profileId: ResourceId;
    modelId: ResourceId;
    submissionId: ResourceId;
    rankingScore: number;
    rankingFields: { rankingScore: number; modelName: string; submissionNumber: number };
    stats: RankingItem['stats'];
    userProfile: RankingItem['userProfile'];
  }) {
    if (existingRanking) {
      return {
        Update: this.entity
          .patch({ leaderboardId, profileId })
          .add({ [DynamoDBItemAttribute.VERSION]: 1 })
          .set({ ...rankingFields, modelId, submissionId, stats, userProfile })
          .where((attr, { gt }) => gt(attr.rankingScore, rankingScore))
          .params(),
      };
    }

    return {
      Put: this.entity
        .create({
          leaderboardId,
          profileId,
          modelId,
          submissionId,
          ...rankingFields,
          submissionVideoS3Location: '',
          stats,
          userProfile,
        })
        .params(),
    };
  }

  @logMethod
  async deleteByLeaderboardId(leaderboardId: ResourceId) {
    logger.info(`Deleting all rankings for leaderboardId: ${leaderboardId}`);

    const { data: rankings } = await this.entity.query.byLeaderboardId({ leaderboardId }).go({ pages: 'all' });

    if (rankings.length > 0) {
      const { unprocessed: unprocessedItems } = await this.entity
        .delete(rankings)
        .go({ concurrency: ELECTRO_DB_MAX_CONCURRENCY, logger: electroDBEventLogger });

      logger.info(
        `Deleted ${rankings.length - unprocessedItems.length} rankings with ${unprocessedItems.length} unprocessed.`,
        {
          leaderboardId,
          unprocessedItems,
        },
      );

      return unprocessedItems;
    }

    logger.info('No rankings found for leaderboard', { leaderboardId });
    return [];
  }
}

/**
 * ElectroDB Entity.params() returns native JavaScript values. The shared client
 * is a low-level DynamoDBClient, so each request value must be converted to an
 * AttributeValue map before use in TransactWriteItemsCommand.
 */
export function marshallTransactWriteItem(item: TransactWriteItem): TransactWriteItem {
  if (item.Put) {
    const rawPut = item.Put as unknown as { Item: Record<string, unknown> };
    const { Item, ...putRequest } = rawPut;
    return {
      Put: {
        ...putRequest,
        Item: marshall(Item, { removeUndefinedValues: true }),
      },
    } as TransactWriteItem;
  }

  if (item.Update) {
    const rawUpdate = item.Update as unknown as {
      ExpressionAttributeValues?: Record<string, unknown>;
      Key: Record<string, unknown>;
    };
    const { ExpressionAttributeValues, Key, ...updateRequest } = rawUpdate;
    return {
      Update: {
        ...updateRequest,
        Key: marshall(Key, { removeUndefinedValues: true }),
        ...(ExpressionAttributeValues && {
          ExpressionAttributeValues: marshall(ExpressionAttributeValues, { removeUndefinedValues: true }),
        }),
      },
    } as TransactWriteItem;
  }

  return item;
}

/**
 * Direct TransactWriteItems errors expose DynamoDB CancellationReasons in the
 * same order as TransactItems: Run transition at 0, Submission creation at 1,
 * and optional Ranking write at 2.
 */
const RUN_TRANSACT_ITEM_INDEX = 0;
const RANKING_TRANSACT_ITEM_INDEX = 2;

function isTransactionCanceled(err: unknown): boolean {
  return (err as { name?: string }).name === 'TransactionCanceledException';
}

function hasConditionalCheckFailureAt(err: unknown, itemIndex: number): boolean {
  const error = err as { CancellationReasons?: { Code?: string }[] };
  return isTransactionCanceled(err) && error.CancellationReasons?.[itemIndex]?.Code === 'ConditionalCheckFailed';
}

function isRunTransitionConditionFailure(err: unknown): boolean {
  return hasConditionalCheckFailureAt(err, RUN_TRANSACT_ITEM_INDEX);
}

function isRankingConditionFailure(err: unknown): boolean {
  return hasConditionalCheckFailureAt(err, RANKING_TRANSACT_ITEM_INDEX);
}

/**
 * A Ranking condition failure is retryable while attempts remain: the Ranking
 * changed concurrently, so `recordSubmission` re-reads it and retries.
 */
function isRetryableRankingConflict(err: unknown, attempt: number, maxAttempts: number): boolean {
  return isRankingConditionFailure(err) && attempt < maxAttempts - 1;
}

/**
 * Translates a failed TransactWriteItems error into the API-visible error. A
 * Ranking condition failure reaching this point exhausted its retries.
 */
function translateTransactionError(
  err: unknown,
  context: {
    leaderboardId: ResourceId;
    profileId: ResourceId;
    runId: ResourceId;
    submissionId: ResourceId;
    rankingScore: number;
  },
): never {
  if (isRankingConditionFailure(err)) {
    logger.warn('Ranking changed concurrently while recording submission.', context);
    throw new ConflictError({ message: 'Ranking changed concurrently. Please retry.' });
  }

  if (isRunTransitionConditionFailure(err)) {
    throw new ConflictError({ message: 'Concurrent transition detected; please retry.' });
  }

  if (isTransactionCanceled(err)) {
    logger.error('Unable to record submission.', { error: err });
    throw new InternalFailureError({ message: 'Unable to record submission.' });
  }

  throw err;
}

export const rankingDao = new RankingDao(RunsEntity, SubmissionsEntity, RankingsEntity);
