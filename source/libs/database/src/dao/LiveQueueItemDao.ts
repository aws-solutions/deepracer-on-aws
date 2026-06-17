import { InternalFailureError, LiveQueueItemStatus, NotFoundError } from '@deepracer-indy/typescript-server-client';
import { logger, logMethod } from '@deepracer-indy/utils';
import { CreateEntityItem, Service } from 'electrodb';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

import { DynamoDBItemAttribute } from '#constants/itemAttributes.js';
import { REMOVABLE_LIVE_QUEUE_ITEM_STATUSES } from '#constants/removableLiveQueueItemStatuses.js';
import { LeaderboardsEntity } from '#entities/LeaderboardsEntity.js';
import { LiveQueueItem, LiveQueueItemEntity } from '#entities/LiveQueueItemEntity.js';
import { SubmissionsEntity } from '#entities/SubmissionsEntity.js';
import { ResourceId } from '#types/resource.js';
import { electroDBEventLogger } from '#utils/electroDBEventLogger.js';
import { generateResourceId } from '#utils/resourceUtils.js';

import { BaseDao } from './BaseDao.js';

export class LiveQueueItemDao extends BaseDao<LiveQueueItemEntity> {
  private readonly service: Service<{
    liveQueueItemEntity: LiveQueueItemEntity;
    submissionEntity: SubmissionsEntity;
    leaderboardsEntity: LeaderboardsEntity;
  }>;

  constructor(
    liveQueueItemEntity: LiveQueueItemEntity,
    submissionEntity: SubmissionsEntity,
    leaderboardsEntity: LeaderboardsEntity,
  ) {
    super(liveQueueItemEntity);
    this.service = new Service({
      liveQueueItemEntity,
      submissionEntity,
      leaderboardsEntity,
    });
  }
  @logMethod
  async getQueue({ leaderboardId }: { leaderboardId: ResourceId }) {
    const { data } = await this.entity.query.byLeaderboardId({ leaderboardId }).go({ pages: 'all' });
    return data.sort((a, b) => (a.queuePosition < b.queuePosition ? -1 : +(a.queuePosition > b.queuePosition)));
  }

  @logMethod
  async addToQueue(
    submission: CreateEntityItem<typeof SubmissionsEntity> &
      Pick<CreateEntityItem<LiveQueueItemEntity>, DynamoDBItemAttribute.PARTICIPANT_NAME>,
  ): Promise<LiveQueueItem> {
    const submissionId = generateResourceId();
    const queue = await this.getQueue({ leaderboardId: submission.leaderboardId });
    const lastPosition = queue.at(-1)?.queuePosition ?? null;
    const queuePosition = generateKeyBetween(lastPosition, null);
    const transaction = this.service.transaction.write(
      ({ liveQueueItemEntity, submissionEntity, leaderboardsEntity }) => [
        liveQueueItemEntity
          .create({
            leaderboardId: submission.leaderboardId,
            submissionId,
            queuePosition,
            profileId: submission.profileId,
            modelId: submission.modelId,
            modelName: submission.modelName,
            participantName: submission.participantName,
            resetCount: 0,
            status: LiveQueueItemStatus.PENDING,
            lastTriggeredAt: Date.now(),
            submittedAt: new Date().toISOString(),
          })
          .commit(),
        submissionEntity.create({ ...submission, submissionId }).commit(),
        leaderboardsEntity
          .patch({ leaderboardId: submission.leaderboardId })
          .add({ version: 1 })
          .add({ submittedProfiles: [submission.profileId] })
          .commit({ logger: electroDBEventLogger }),
      ],
    );
    const transactionResult = await transaction.go();

    if (transactionResult.canceled) {
      logger.error('Unable to create submission.', { transactionResult });
      throw new InternalFailureError({ message: 'Unable to create submission.' });
    }

    const returnedliveQueueItem = this.entity.parse(
      (transaction.params().TransactItems[0] as { Put: { [param: string]: unknown } }).Put,
    ).data as LiveQueueItem;

    return returnedliveQueueItem;
  }

  @logMethod
  async updateStatus({
    leaderboardId,
    submissionId,
    status,
    expectedStatus,
  }: {
    leaderboardId: ResourceId;
    submissionId: ResourceId;
    status: LiveQueueItemStatus;
    expectedStatus: LiveQueueItemStatus;
  }) {
    const { data } = await this.entity
      .patch({ leaderboardId, submissionId })
      .set({ status })
      .where((attr, { eq }) => eq(attr.status, expectedStatus))
      .go({ response: 'all_new' });

    return data;
  }

  @logMethod
  async reorder({
    leaderboardId,
    submissionId,
    afterSubmissionId,
    queue: preloadedQueue,
  }: {
    leaderboardId: ResourceId;
    submissionId: ResourceId;
    afterSubmissionId?: ResourceId | null;
    queue?: LiveQueueItem[];
  }) {
    const queue = preloadedQueue ?? (await this.getQueue({ leaderboardId }));

    if (!queue.some((item) => item.submissionId === submissionId)) {
      throw new NotFoundError({ message: `Submission ${submissionId} not found in queue.` });
    }

    if (afterSubmissionId != null && !queue.some((item) => item.submissionId === afterSubmissionId)) {
      throw new NotFoundError({ message: `Submission ${afterSubmissionId} to insert after not found in queue.` });
    }

    const afterIndex =
      afterSubmissionId == null ? -1 : queue.findIndex((item) => item.submissionId === afterSubmissionId);
    const afterPosition = afterIndex >= 0 ? queue[afterIndex].queuePosition : null;
    const nextIndex = afterIndex + 1;
    const beforePosition = nextIndex < queue.length ? queue[nextIndex].queuePosition : null;
    const queuePosition = generateKeyBetween(afterPosition, beforePosition);
    const data = await this.partialUpdate({ leaderboardId, submissionId }, { queuePosition });

    return data;
  }

  @logMethod
  async resetModel({ leaderboardId, submissionId }: { leaderboardId: ResourceId; submissionId: ResourceId }) {
    const queue = await this.getQueue({ leaderboardId });
    if (!queue.length) {
      throw new NotFoundError({ message: `Leaderboard ${leaderboardId} is empty.` });
    }
    const firstPosition = queue[0].queuePosition;
    const queuePosition = generateKeyBetween(null, firstPosition);
    const leaderboard = await this.service.entities.leaderboardsEntity.get({ leaderboardId }).go();
    const maxResets = leaderboard.data?.maxResets;

    const { data } = await this.entity
      .patch({ leaderboardId, submissionId })
      .set({ status: LiveQueueItemStatus.PENDING, queuePosition })
      .add({ resetCount: 1 })
      .where((attr, { eq, lt }) => {
        const RESETABLE_LIVE_QUEUE_ITEM_STATUS: LiveQueueItemStatus[] = [
          LiveQueueItemStatus.FAILED,
          LiveQueueItemStatus.IN_PROGRESS,
        ];
        const statusClause = `(${RESETABLE_LIVE_QUEUE_ITEM_STATUS.map((status) => eq(attr.status, status)).join(' OR ')})`;
        if (maxResets != null) {
          return `${statusClause} AND ${lt(attr.resetCount, maxResets)}`;
        }
        return statusClause;
      })
      .go({ response: 'all_new' });

    return data;
  }

  @logMethod
  async resetAll({ leaderboardId }: { leaderboardId: ResourceId }) {
    await this.service.entities.leaderboardsEntity.update({ leaderboardId }).set({ autoLaunchEnabled: false }).go();
    const { data: items } = await this.entity.query.byLeaderboardId({ leaderboardId }).go({ pages: 'all' });

    const sorted = items.toSorted(
      (a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.submissionId.localeCompare(b.submissionId),
    );

    const newPositions = generateNKeysBetween(null, null, sorted.length);
    const results = await Promise.allSettled(
      sorted.map((item, idx) =>
        this._update(
          { leaderboardId, submissionId: item.submissionId },
          { status: LiveQueueItemStatus.PENDING, resetCount: 0, queuePosition: newPositions[idx] },
        ),
      ),
    );

    const itemsFailed = results.filter((r) => r.status === 'rejected').length;
    results
      .filter((r) => r.status === 'rejected')
      .forEach((r) => logger.warn('Error resetting model', { error: r.reason }));

    return { itemsReset: results.length - itemsFailed, itemsFailed };
  }

  @logMethod
  async remove(primaryKey: { leaderboardId: ResourceId; submissionId: ResourceId }) {
    const { data } = await this.entity
      .delete(primaryKey)
      .where((attr, { eq }) => REMOVABLE_LIVE_QUEUE_ITEM_STATUSES.map((status) => eq(attr.status, status)).join(' OR '))
      .go();

    return data;
  }

  @logMethod
  async deleteByLeaderboardId(leaderboardId: ResourceId) {
    const { data: items } = await this.entity.query.byLeaderboardId({ leaderboardId }).go({ pages: 'all' });
    if (items.length === 0) return;
    await this._batchDelete(items.map(({ leaderboardId: lb, submissionId }) => ({ leaderboardId: lb, submissionId })));
  }

  @logMethod
  async touchItem({ leaderboardId, submissionId }: { leaderboardId: ResourceId; submissionId: ResourceId }) {
    return this._update({ leaderboardId, submissionId }, { lastTriggeredAt: Date.now() });
  }

  @logMethod
  async getNextPending({ leaderboardId }: { leaderboardId: ResourceId }) {
    const queue = await this.getQueue({ leaderboardId });
    return queue.find((item) => item.status === LiveQueueItemStatus.PENDING) ?? null;
  }
}

export const liveQueueItemDao = new LiveQueueItemDao(LiveQueueItemEntity, SubmissionsEntity, LeaderboardsEntity);
