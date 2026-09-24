// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ConflictError, InternalFailureError, JobStatus } from '@deepracer-indy/typescript-server-client';
import { logger, logMethod } from '@deepracer-indy/utils';
import { CreateEntityItem, Service } from 'electrodb';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { ELECTRO_DB_MAX_CONCURRENCY } from '../constants/electroDB.js';
import { LeaderboardsEntity } from '../entities/LeaderboardsEntity.js';
import { RankingsEntity } from '../entities/RankingsEntity.js';
import { SubmissionItem, SubmissionsEntity } from '../entities/SubmissionsEntity.js';
import type { ResourceId } from '../types/resource.js';
import { electroDBEventLogger } from '../utils/electroDBEventLogger.js';
import { generateResourceId } from '../utils/resourceUtils.js';

export class SubmissionDao extends BaseDao<SubmissionsEntity> {
  private readonly service: Service<{
    submissions: SubmissionsEntity;
    leaderboards: LeaderboardsEntity;
    rankings: RankingsEntity;
  }>;

  constructor(
    leaderboardsEntity: LeaderboardsEntity,
    submissionsEntity: SubmissionsEntity,
    rankingsEntity: RankingsEntity,
  ) {
    super(submissionsEntity);
    this.service = new Service({
      submissions: submissionsEntity,
      leaderboards: leaderboardsEntity,
      rankings: rankingsEntity,
    });
  }

  protected override async _create(item: CreateEntityItem<typeof this.entity>) {
    const submissionId = item.submissionId ?? generateResourceId();

    const transaction = this.service.transaction.write(({ leaderboards, submissions }) => [
      submissions.create({ ...item, submissionId }).commit(),
      leaderboards
        .patch({ leaderboardId: item.leaderboardId })
        .add({ version: 1 })
        .add({ submittedProfiles: [item.profileId] })
        .commit({ logger: electroDBEventLogger }),
    ]);

    const transactionResult = await transaction.go();

    if (transactionResult.canceled) {
      logger.error('Unable to create submission.', { transactionResult });
      throw new InternalFailureError({ message: 'Unable to create submission.' });
    }

    const submissionItem = this.entity.parse(
      (transaction.params().TransactItems[0] as { Put: { [param: string]: unknown } }).Put,
    ).data as SubmissionItem;

    return submissionItem;
  }

  /**
   * Atomically updates a Submission's `rankingScore`, and — only when the Ranking needs to change
   * as a result — the corresponding Ranking too. Used by the lap edit / validity
   * cascade to keep both records in sync.
   *
   * The Ranking is a single record per `{leaderboardId, profileId}` representing the racer's
   * *best* submission across ALL of their submissions on this leaderboard — not just the one
   * being updated. This does NOT simply mirror the SUBMITTED-transition ranking logic (a new
   * submission's score there can only ever *improve* the ranking, so comparing the new score
   * against the current Ranking once is sufficient); a lap edit/validity change can *worsen* the
   * score of the submission the Ranking currently points at. When that happens, some other
   * submission belonging to this racer on this leaderboard may now be the true best, so this
   * looks across all of the racer's submissions (with the submission being updated's score
   * substituted for its stale on-disk value) to determine the actual best submission/score,
   * rather than assuming the submission just edited is still the best just because it used to be.
   */
  @logMethod
  async updateScoreWithRanking({
    leaderboardId,
    profileId,
    submissionId,
    rankingScore,
  }: {
    leaderboardId: ResourceId;
    profileId: ResourceId;
    submissionId: ResourceId;
    rankingScore: number;
  }) {
    const [{ data: currentRanking }, { data: profileSubmissions }] = await Promise.all([
      this.service.entities.rankings.get({ leaderboardId, profileId }).go(),
      this.service.entities.submissions.query.byProfileId({ leaderboardId, profileId }).go({ pages: 'all' }),
    ]);

    // Substitute the freshly recomputed score for the submission being updated — the on-disk
    // copy in profileSubmissions is stale until the transaction below commits. Submissions with
    // no rankingScore yet (not yet scored) aren't ranking candidates, so they're filtered out —
    // this also avoids comparing against an undefined score below.
    const editedSubmission = profileSubmissions.find((submission) => submission.submissionId === submissionId);
    const editedCandidate = { submissionId, submissionNumber: editedSubmission?.submissionNumber, rankingScore };
    const otherCandidates = profileSubmissions
      .filter((submission) => submission.submissionId !== submissionId && submission.rankingScore !== undefined)
      .map((submission) => ({
        submissionId: submission.submissionId,
        submissionNumber: submission.submissionNumber,
        rankingScore: submission.rankingScore as number,
      }));

    const trueBest = otherCandidates.reduce(
      (best, candidate) => (candidate.rankingScore < best.rankingScore ? candidate : best),
      editedCandidate,
    );

    // A Ranking is created for a racer's first submission on a leaderboard at SUBMITTED time
    // (runLifecycleFunction) — this cascade only ever patches an existing Ranking, never creates
    // one, so `currentRanking === null` here is a defensive no-op rather than the normal path.
    const isCurrentBestSubmission = currentRanking?.submissionId === submissionId;
    const isTrueBestDifferentFromRanking = trueBest.submissionId !== currentRanking?.submissionId;
    const shouldUpdateRanking = currentRanking !== null && (isCurrentBestSubmission || isTrueBestDifferentFromRanking);

    // Narrowed once here (rather than inline in the transaction below) so TypeScript can prove
    // `currentRanking` is non-null wherever `previousRankingScore` is used, without a `!` assertion.
    const previousRankingScore = currentRanking === null ? undefined : currentRanking.rankingScore;

    const transaction = this.service.transaction.write(({ submissions, rankings }) => [
      submissions
        .patch({ profileId, leaderboardId, submissionId })
        .set({ rankingScore })
        .commit({ logger: electroDBEventLogger }),
      ...(shouldUpdateRanking && previousRankingScore !== undefined
        ? [
            rankings
              .patch({ leaderboardId, profileId })
              .set({
                rankingScore: trueBest.rankingScore,
                submissionId: trueBest.submissionId,
                submissionNumber: trueBest.submissionNumber,
              })
              // previousRankingScore is guaranteed defined here — shouldUpdateRanking is only
              // ever true when currentRanking (and therefore previousRankingScore) is non-null.
              .where((attr, { eq }) => eq(attr.rankingScore, previousRankingScore))
              .commit({ logger: electroDBEventLogger }),
          ]
        : []),
    ]);

    const transactionResult = await transaction.go();

    if (transactionResult.canceled) {
      logger.warn('Score update transaction canceled — Ranking changed since it was read.', {
        leaderboardId,
        profileId,
        submissionId,
        transactionResult,
      });
      throw new ConflictError({ message: 'Ranking changed concurrently. Please retry.' });
    }

    if (!shouldUpdateRanking) {
      logger.info('Skipped ranking update: recomputed score is not the racer’s best submission.', {
        leaderboardId,
        profileId,
        submissionId,
        rankingScore,
        currentRankingSubmissionId: currentRanking?.submissionId,
        currentRankingScore: currentRanking?.rankingScore,
      });
    }
  }

  @logMethod
  listByCreatedAt({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
    profileId,
    leaderboardId,
  }: {
    cursor?: string | null;
    maxResults?: number;
    profileId: ResourceId;
    leaderboardId: ResourceId;
  }) {
    return this.entity.query
      .sortedByCreatedAt({ leaderboardId, profileId })
      .go({ cursor, limit: maxResults, order: 'desc' });
  }

  /**
   * Deletes all submissions for the given leaderboardId.
   *
   * @param leaderboardId The ID of the leaderboard
   */
  @logMethod
  async deleteByLeaderboardId(leaderboardId: ResourceId) {
    logger.info(`Deleting all submissions for leaderboardId: ${leaderboardId}`);

    const { data: leaderboardItem } = await this.service.entities.leaderboards.get({ leaderboardId }).go();

    const submittedProfiles = (leaderboardItem?.submittedProfiles ?? []) as ResourceId[];

    let processedCount = 0;
    const unprocessedItems: Awaited<ReturnType<ReturnType<(typeof this.entity)['delete']>['go']>>['unprocessed'] = [];

    for (const profileId of submittedProfiles) {
      const { data: submissions } = await this.service.entities.submissions.query
        .byProfileId({ leaderboardId, profileId })
        .go({ pages: 'all' });

      if (submissions.length > 0) {
        const { unprocessed } = await this.service.entities.submissions
          .delete(submissions)
          .go({ concurrency: ELECTRO_DB_MAX_CONCURRENCY, logger: electroDBEventLogger });

        processedCount += submissions.length - unprocessed.length;
        unprocessedItems.push(...unprocessed);

        logger.info(
          `Deleted ${submissions.length - unprocessed.length} submissions with ${unprocessed.length} unprocessed.`,
          {
            submissionProfileId: profileId,
            leaderboardId,
            unprocessedItems: unprocessed,
          },
        );
      }
    }

    logger.info(`Deleted ${processedCount} submissions with ${unprocessedItems.length} unprocessed.`, {
      leaderboardId,
      unprocessedItems,
    });

    return unprocessedItems;
  }

  /**
   * Attempts to retrieve a stoppable submission.
   * Submissions are only stoppable when QUEUED.
   *
   * @param modelId The model ID used in the query
   * @param profileId The profile ID used in the query
   * @returns A submission in a stoppable status, or null if none is found
   */
  @logMethod
  async getStoppableSubmission(modelId: ResourceId, profileId: ResourceId) {
    const { data: submissionItems } = await this.entity.query
      .byProfileId({ profileId })
      .where((attr, { eq }) => eq(attr.modelId, modelId))
      .where((attr, { eq }) => eq(attr.status, JobStatus.QUEUED as JobStatus))
      .go({ pages: 'all' });

    return submissionItems.length ? submissionItems[0] : null;
  }
}

export const submissionDao = new SubmissionDao(LeaderboardsEntity, SubmissionsEntity, RankingsEntity);
