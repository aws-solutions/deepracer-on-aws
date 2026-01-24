// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InternalFailureError, JobStatus } from '@deepracer-indy/typescript-server-client';
import { logger, logMethod } from '@deepracer-indy/utils';
import { CreateEntityItem, Service } from 'electrodb';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { ELECTRO_DB_MAX_CONCURRENCY } from '../constants/electroDB.js';
import { LeaderboardsEntity } from '../entities/LeaderboardsEntity.js';
import { SubmissionItem, SubmissionsEntity } from '../entities/SubmissionsEntity.js';
import type { ResourceId } from '../types/resource.js';
import { electroDBEventLogger } from '../utils/electroDBEventLogger.js';
import { generateResourceId } from '../utils/resourceUtils.js';

export class SubmissionDao extends BaseDao<SubmissionsEntity> {
  private service: Service<{ submissions: SubmissionsEntity; leaderboards: LeaderboardsEntity }>;

  constructor(leaderboardsEntity: LeaderboardsEntity, submissionsEntity: SubmissionsEntity) {
    super(submissionsEntity);
    this.service = new Service({
      submissions: submissionsEntity,
      leaderboards: leaderboardsEntity,
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

    logger.info(`Deleted ${processedCount} submissions with ${unprocessedItems.length} unprocessed.`, {
      leaderboardId,
      unprocessedItems,
    });
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

export const submissionDao = new SubmissionDao(LeaderboardsEntity, SubmissionsEntity);
