// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  JobStatus,
  LiveQueueItemStatus,
  NotFoundError,
  RaceType,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';

import { TEST_LEADERBOARD_ITEM } from '#constants/testConstants.js';
import { LeaderboardsEntity } from '#entities/LeaderboardsEntity.js';
import { ResourceId } from '#types/resource.js';
import { dynamoDBClient } from '#utils/dynamoDBClient.js';
import * as resourceUtils from '#utils/resourceUtils.js';
import { generateString } from '#utils/testUtils.js';

import { LiveQueueItemDao, liveQueueItemDao } from '../LiveQueueItemDao.js';

// txGoMock allows tests to override the return value of transaction.go().
const txGoMock = vi.hoisted(() => vi.fn());

// dynalite does not support TransactWriteItems. Mock the
// ElectroDB Service constructor so that transaction.write().go() performs
// individual PutItem calls instead, while preserving all other behavior.
vi.mock('electrodb', async () => {
  const electrodb = await vi.importActual<typeof import('electrodb')>('electrodb');
  return {
    ...electrodb,
    Service: vi.fn(function (...args: ConstructorParameters<typeof electrodb.Service>) {
      const service = new electrodb.Service(...args);
      const originalWrite = service.transaction.write.bind(service.transaction);
      service.transaction.write = vi.fn<typeof service.transaction.write>((...writeArgs) => {
        const tx = originalWrite(...writeArgs);
        tx.go = vi.fn(async () => {
          if (txGoMock.getMockImplementation()) {
            return txGoMock();
          }
          const { TransactItems } = tx.params();
          for (const item of TransactItems) {
            const put = (item as { Put?: { Item: Record<string, unknown>; TableName: string } }).Put;
            if (put) {
              await dynamoDBClient.send(new PutCommand(put));
            }
          }
          return { canceled: false, data: [] as [] };
        });
        return tx;
      }) as typeof service.transaction.write;
      return service;
    }),
  };
});

type addToQueueSubmissionType = Parameters<LiveQueueItemDao['addToQueue']>[0];

const buildSubmission = (leaderboardId?: ResourceId | null, overrides?: Partial<addToQueueSubmissionType>) => {
  const lbId = leaderboardId ?? resourceUtils.generateResourceId();

  const submission = {
    leaderboardId: lbId,
    modelId: resourceUtils.generateResourceId(),
    modelName: generateString(),
    profileId: resourceUtils.generateResourceId(),
    participantName: generateString(),
    raceType: RaceType.OBJECT_AVOIDANCE,
    resettingBehaviorConfig: {
      continuousLap: true,
    },
    status: JobStatus.QUEUED,
    submissionNumber: 0,
    terminationConditions: {
      maxLaps: 10,
      maxTimeInMinutes: 10,
    },
    trackConfig: {
      trackId: TrackId.AMERICAN_HILLS_SPEEDWAY,
      trackDirection: TrackDirection.CLOCKWISE,
    },
    ...overrides,
  } satisfies addToQueueSubmissionType;
  return { leaderboardId: lbId, submission };
};

describe('LiveQueueItemDao', () => {
  describe('addToQueue', () => {
    it('should append second item after the first in the queue', async () => {
      const { leaderboardId, submission: submission1 } = buildSubmission();
      const { submission: submission2 } = buildSubmission(leaderboardId);

      const items: Awaited<ReturnType<LiveQueueItemDao['addToQueue']>>[] = [];
      items.push(await liveQueueItemDao.addToQueue({ ...submission1 }));
      items.push(await liveQueueItemDao.addToQueue({ ...submission2 }));

      expect(items[1].queuePosition > items[0].queuePosition).toBe(true);

      const results = await liveQueueItemDao.getQueue({ leaderboardId });
      expect(results).toBeDefined();
      expect(results).toHaveLength(items.length);
      results.forEach((r, i) => {
        expect(r.submissionId).toBe(items[i].submissionId);
      });
    });
  });

  it('should throw when tx is canceled', async () => {
    txGoMock.mockImplementationOnce(() => ({ canceled: true, data: [] as [] }));
    const { leaderboardId, submission } = buildSubmission();

    await expect(liveQueueItemDao.addToQueue({ ...submission })).rejects.toThrow('Unable to create submission');

    const results = await liveQueueItemDao.getQueue({ leaderboardId });
    expect(results).toBeDefined();
    expect(results).toHaveLength(0);
  });

  describe('updateStatus', () => {
    it('should update status when expectedStatus matches', async () => {
      const { leaderboardId, submission } = buildSubmission();

      const item = await liveQueueItemDao.addToQueue({
        ...submission,
      });

      const result = await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: item.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });

      expect(result.status).toBe(LiveQueueItemStatus.IN_PROGRESS);
    });

    it('should fail when expectedStatus does not match current status', async () => {
      const { leaderboardId, submission } = buildSubmission();

      const item = await liveQueueItemDao.addToQueue({
        ...submission,
      });

      await expect(
        liveQueueItemDao.updateStatus({
          leaderboardId,
          submissionId: item.submissionId,
          status: LiveQueueItemStatus.COMPLETED,
          expectedStatus: LiveQueueItemStatus.IN_PROGRESS,
        }),
      ).rejects.toThrow();
    });
  });

  describe('reorder', () => {
    it('should move an item to a new queue position', async () => {
      const { leaderboardId, submission: firstSubmission } = buildSubmission();
      const { submission: secondSubmission } = buildSubmission(leaderboardId);
      const { submission: thirdSubmission } = buildSubmission(leaderboardId);

      const first = await liveQueueItemDao.addToQueue({ ...firstSubmission });

      const second = await liveQueueItemDao.addToQueue({ ...secondSubmission });

      const third = await liveQueueItemDao.addToQueue({ ...thirdSubmission });

      // Move third item before second, after first
      const updated = await liveQueueItemDao.reorder({
        leaderboardId,
        submissionId: third.submissionId,
        afterSubmissionId: first.submissionId,
      });

      expect(updated.queuePosition > first.queuePosition).toBe(true);
      expect(updated.queuePosition < second.queuePosition).toBe(true);

      const results = await liveQueueItemDao.getQueue({ leaderboardId });
      expect(results).toBeDefined();
      expect(results).toHaveLength(3);
      expect(results[0].submissionId).toBe(first.submissionId);
      expect(results[1].submissionId).toBe(third.submissionId);
      expect(results[2].submissionId).toBe(second.submissionId);
    });

    it('should move an item to the first position', async () => {
      const leaderboardId = resourceUtils.generateResourceId();
      const iterations = 10;
      const items: Awaited<ReturnType<LiveQueueItemDao['addToQueue']>>[] = [];

      for (let i = 0; i < iterations; i++) {
        const { submission } = buildSubmission(leaderboardId);
        const item = await liveQueueItemDao.addToQueue({ ...submission });
        items.push(item);

        const queueAfterAdd = await liveQueueItemDao.getQueue({ leaderboardId });
        expect(queueAfterAdd[queueAfterAdd.length - 1].submissionId).toBe(item.submissionId);

        await liveQueueItemDao.reorder({
          leaderboardId,
          submissionId: item.submissionId,
          afterSubmissionId: null,
        });

        const queueAfterReorder = await liveQueueItemDao.getQueue({ leaderboardId });
        expect(queueAfterReorder[0].submissionId).toBe(item.submissionId);
      }

      const results = await liveQueueItemDao.getQueue({ leaderboardId });
      expect(results.length).toBe(iterations);
      expect(items[0].submissionId).toEqual(results[iterations - 1].submissionId);
      expect(items[iterations - 1].submissionId).toEqual(results[0].submissionId);
    });

    it('should throw an error if submission is not found', async () => {
      const { leaderboardId } = buildSubmission();
      await expect(
        liveQueueItemDao.reorder({
          leaderboardId,
          submissionId: resourceUtils.generateResourceId(),
          afterSubmissionId: null,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw an error if afterSubmission is not found', async () => {
      const { leaderboardId, submission } = buildSubmission();

      const item = await liveQueueItemDao.addToQueue({ ...submission });

      await expect(
        liveQueueItemDao.reorder({
          leaderboardId,
          submissionId: item.submissionId,
          afterSubmissionId: resourceUtils.generateResourceId(),
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should move an item to the last position', async () => {
      const { leaderboardId, submission: firstSubmission } = buildSubmission();
      const { submission: secondSubmission } = buildSubmission(leaderboardId);

      const first = await liveQueueItemDao.addToQueue({ ...firstSubmission });
      const second = await liveQueueItemDao.addToQueue({ ...secondSubmission });

      // Move first item after second (to the end)
      await liveQueueItemDao.reorder({
        leaderboardId,
        submissionId: first.submissionId,
        afterSubmissionId: second.submissionId,
      });

      const results = await liveQueueItemDao.getQueue({ leaderboardId });
      expect(results[0].submissionId).toBe(second.submissionId);
      expect(results[1].submissionId).toBe(first.submissionId);
    });
  });

  describe('resetModel', () => {
    it('should reset an IN_PROGRESS item to PENDING at front of queue with incremented resetCount', async () => {
      const { leaderboardId, submission: firstSubmission } = buildSubmission();
      const { submission: secondSubmission } = buildSubmission(leaderboardId);

      const first = await liveQueueItemDao.addToQueue({ ...firstSubmission });

      const second = await liveQueueItemDao.addToQueue({ ...secondSubmission });

      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: first.submissionId,
        status: LiveQueueItemStatus.COMPLETED,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: second.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });
      const result = await liveQueueItemDao.resetModel({
        leaderboardId,
        submissionId: second.submissionId,
      });

      expect(result.status).toBe(LiveQueueItemStatus.PENDING);
      expect(result.resetCount).toBe(1);

      const queue = await liveQueueItemDao.getQueue({ leaderboardId });
      expect(queue[0].submissionId).toBe(second.submissionId);
      expect(queue[1].submissionId).toBe(first.submissionId);
    });

    it('should reset a FAILED item to PENDING at front of queue', async () => {
      const { leaderboardId, submission } = buildSubmission();

      const item = await liveQueueItemDao.addToQueue({
        ...submission,
      });

      // Transition to IN_PROGRESS then FAILED
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: item.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: item.submissionId,
        status: LiveQueueItemStatus.FAILED,
        expectedStatus: LiveQueueItemStatus.IN_PROGRESS,
      });

      const result = await liveQueueItemDao.resetModel({
        leaderboardId,
        submissionId: item.submissionId,
      });

      expect(result.status).toBe(LiveQueueItemStatus.PENDING);
      expect(result.resetCount).toBe(1);
    });

    it('should fail to reset a PENDING item', async () => {
      const { leaderboardId, submission } = buildSubmission();

      const item = await liveQueueItemDao.addToQueue({
        ...submission,
      });

      await expect(
        liveQueueItemDao.resetModel({
          leaderboardId,
          submissionId: item.submissionId,
        }),
      ).rejects.toThrow();
    });

    it('should throw NotFoundError when queue is empty', async () => {
      const leaderboardId = resourceUtils.generateResourceId();

      await expect(
        liveQueueItemDao.resetModel({
          leaderboardId,
          submissionId: resourceUtils.generateResourceId(),
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should reset the only item in the queue to front position', async () => {
      const { leaderboardId, submission } = buildSubmission();

      const item = await liveQueueItemDao.addToQueue({ ...submission });

      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: item.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });

      const result = await liveQueueItemDao.resetModel({
        leaderboardId,
        submissionId: item.submissionId,
      });

      expect(result.status).toBe(LiveQueueItemStatus.PENDING);
      expect(result.resetCount).toBe(1);
    });

    it('should fail to reset when resetCount exceeds maxResets', async () => {
      const { leaderboardId, submission } = buildSubmission();

      const item = await liveQueueItemDao.addToQueue({
        ...submission,
      });

      // Transition to IN_PROGRESS then FAILED
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: item.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: item.submissionId,
        status: LiveQueueItemStatus.FAILED,
        expectedStatus: LiveQueueItemStatus.IN_PROGRESS,
      });

      // Mock leaderboard with maxResets = 2
      const maxResetsLeaderboard = {
        ...TEST_LEADERBOARD_ITEM,
        maxResets: 2,
      };

      vi.spyOn(LeaderboardsEntity, 'get').mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: maxResetsLeaderboard }),
        params: vi.fn(),
      });
      // Reset twice to reach the limit
      await liveQueueItemDao.resetModel({
        leaderboardId,
        submissionId: item.submissionId,
      });
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: item.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });
      await liveQueueItemDao.resetModel({
        leaderboardId,
        submissionId: item.submissionId,
      });
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: item.submissionId,
        status: LiveQueueItemStatus.FAILED,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });

      // Third reset should fail on third reset
      await expect(
        liveQueueItemDao.resetModel({
          leaderboardId,
          submissionId: item.submissionId,
        }),
      ).rejects.toThrow();
    });
  });

  describe('resetAll', () => {
    it('should reset all items to PENDING with resetCount 0 sorted by submittedAt', async () => {
      const { leaderboardId, submission: submission1 } = buildSubmission();
      const { submission: submission2 } = buildSubmission(leaderboardId);

      const later = await liveQueueItemDao.addToQueue({ ...submission1 });

      //  Add a submission with a date in the past two simulate a queue that has
      //  out of chronological order ordering
      const fakedDate = Date.now() - 30 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(fakedDate);
      const earlier = await liveQueueItemDao.addToQueue({ ...submission2 });
      vi.useRealTimers();

      // Transition later to IN_PROGRESS so we verify status reset too
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: later.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });

      const { itemsReset, itemsFailed } = await liveQueueItemDao.resetAll({ leaderboardId });
      expect(itemsReset).toBe(2);
      expect(itemsFailed).toBe(0);

      const queue = await liveQueueItemDao.getQueue({ leaderboardId });
      expect(queue).toHaveLength(2);
      // Order should be by submittedAt, not original queue order
      expect(queue[0].submissionId).toBe(earlier.submissionId);
      expect(queue[1].submissionId).toBe(later.submissionId);
      queue.forEach((item) => {
        expect(item.status).toBe(LiveQueueItemStatus.PENDING);
        expect(item.resetCount).toBe(0);
      });
    });

    it('should use submissionId as tiebreaker when submittedAt is equal', async () => {
      vi.useFakeTimers({ now: new Date('2024-01-01T00:00:00Z'), toFake: ['Date'] });

      const leaderboardId = resourceUtils.generateResourceId();

      const { submission: submissionA } = buildSubmission(leaderboardId);
      const { submission: submissionB } = buildSubmission(leaderboardId);

      //  Manually set the submissionId to known out-of-order values to verify that
      //  when two submissions have the same submittedAt date, that items are sorted
      //  by submissionId
      vi.spyOn(resourceUtils, 'generateResourceId').mockReturnValueOnce('bbbbbbbbbb' as ResourceId);
      const itemA = await liveQueueItemDao.addToQueue({ ...submissionA });
      vi.spyOn(resourceUtils, 'generateResourceId').mockReturnValueOnce('aaaaaaaaaa' as ResourceId);
      const itemB = await liveQueueItemDao.addToQueue({ ...submissionB });

      vi.useRealTimers();

      await liveQueueItemDao.resetAll({ leaderboardId });

      const queue = await liveQueueItemDao.getQueue({ leaderboardId });
      expect(queue).toHaveLength(2);

      expect(queue[0].submissionId).toBe(itemB.submissionId);
      expect(queue[1].submissionId).toBe(itemA.submissionId);
    });

    it('should report itemsFailed when an update rejects', async () => {
      const { leaderboardId, submission: submission1 } = buildSubmission();
      const { submission: submission2 } = buildSubmission(leaderboardId);

      await liveQueueItemDao.addToQueue({ ...submission1 });
      await liveQueueItemDao.addToQueue({ ...submission2 });

      // @ts-expect-error - spying on protected method for testing
      const updateSpy = vi.spyOn(liveQueueItemDao, '_update');
      updateSpy.mockRejectedValueOnce(new Error('DDB error'));

      const { itemsReset, itemsFailed } = await liveQueueItemDao.resetAll({ leaderboardId });
      expect(itemsReset).toBe(1);
      expect(itemsFailed).toBe(1);
    });
  });

  describe('remove', () => {
    it('should remove PENDING and FAILED items', async () => {
      const { leaderboardId, submission: submission1 } = buildSubmission();
      const { submission: submission2 } = buildSubmission(leaderboardId);

      const pendingItem = await liveQueueItemDao.addToQueue({ ...submission1 });
      const failedItem = await liveQueueItemDao.addToQueue({ ...submission2 });

      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: failedItem.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: failedItem.submissionId,
        status: LiveQueueItemStatus.FAILED,
        expectedStatus: LiveQueueItemStatus.IN_PROGRESS,
      });

      await liveQueueItemDao.remove({ leaderboardId, submissionId: pendingItem.submissionId });
      await liveQueueItemDao.remove({ leaderboardId, submissionId: failedItem.submissionId });

      const queue = await liveQueueItemDao.getQueue({ leaderboardId });
      expect(queue).toHaveLength(0);
    });

    it('should fail to remove non PENDING or FAILED items', async () => {
      const { leaderboardId, submission } = buildSubmission();
      const { submission: submission2 } = buildSubmission(leaderboardId);

      const inProgressItem = await liveQueueItemDao.addToQueue({
        ...submission,
      });

      const completedItem = await liveQueueItemDao.addToQueue({
        ...submission2,
      });

      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: inProgressItem.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });

      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: completedItem.submissionId,
        status: LiveQueueItemStatus.COMPLETED,
        expectedStatus: completedItem.status,
      });

      await expect(
        liveQueueItemDao.remove({ leaderboardId, submissionId: inProgressItem.submissionId }),
      ).rejects.toThrow();
      await expect(
        liveQueueItemDao.remove({ leaderboardId, submissionId: completedItem.submissionId }),
      ).rejects.toThrow();
    });
  });

  describe('touchItem', () => {
    it('should update lastTriggeredAt', async () => {
      const { leaderboardId, submission } = buildSubmission();

      //  Force Date.now() to return a value 30 minutes in the past
      vi.useFakeTimers({ now: Date.now() - 30 * 60 * 1000, toFake: ['Date'] });
      const item = await liveQueueItemDao.addToQueue({ ...submission });

      vi.useRealTimers();

      const originalTimestamp = item.lastTriggeredAt;

      expect(originalTimestamp).toBeDefined();
      const result = await liveQueueItemDao.touchItem({
        leaderboardId,
        submissionId: item.submissionId,
      });

      expect(result).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.lastTriggeredAt).toBeGreaterThan(originalTimestamp!);
    });
  });

  describe('getNextPending', () => {
    it('should return the first PENDING item by queue position', async () => {
      const { leaderboardId, submission: firstSubmission } = buildSubmission();
      const { submission: secondSubmission } = buildSubmission(leaderboardId);
      const { submission: thirdSubmission } = buildSubmission(leaderboardId);

      const first = await liveQueueItemDao.addToQueue({ ...firstSubmission });

      const second = await liveQueueItemDao.addToQueue({ ...secondSubmission });

      const third = await liveQueueItemDao.addToQueue({ ...thirdSubmission });

      const result = await liveQueueItemDao.getNextPending({ leaderboardId });

      expect(result).toBeDefined();
      expect(result?.submissionId).toBe(first.submissionId);
      expect(result?.status).toBe(LiveQueueItemStatus.PENDING);

      // Transition first to IN_PROGRESS so it's skipped
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: first.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });

      const result_two = await liveQueueItemDao.getNextPending({ leaderboardId });

      expect(result_two).toBeDefined();
      expect(result_two?.submissionId).toBe(second.submissionId);
      expect(result_two?.status).toBe(LiveQueueItemStatus.PENDING);

      // Transition first to COMPLETED and transition second to IN_PROGRESS
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: first.submissionId,
        status: LiveQueueItemStatus.COMPLETED,
        expectedStatus: LiveQueueItemStatus.IN_PROGRESS,
      });
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: second.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });

      const result_three = await liveQueueItemDao.getNextPending({ leaderboardId });

      expect(result_three).toBeDefined();
      expect(result_three?.submissionId).toBe(third.submissionId);
      expect(result_three?.status).toBe(LiveQueueItemStatus.PENDING);

      //  Reset second so it returns to the front of the queue and in PENDING, so it should be first again
      await liveQueueItemDao.resetModel({ leaderboardId, submissionId: second.submissionId });

      const result_four = await liveQueueItemDao.getNextPending({ leaderboardId });

      expect(result_four).toBeDefined();
      expect(result_four?.submissionId).toBe(second.submissionId);
      expect(result_four?.status).toBe(LiveQueueItemStatus.PENDING);

      // Transition second to IN_PROGRESS, then COMPLETED, and transition third to IN_PROGRESS
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: second.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: second.submissionId,
        status: LiveQueueItemStatus.COMPLETED,
        expectedStatus: LiveQueueItemStatus.IN_PROGRESS,
      });
      await liveQueueItemDao.updateStatus({
        leaderboardId,
        submissionId: third.submissionId,
        status: LiveQueueItemStatus.IN_PROGRESS,
        expectedStatus: LiveQueueItemStatus.PENDING,
      });

      const result_five = await liveQueueItemDao.getNextPending({ leaderboardId });

      expect(result_five).toBeNull();

      //  Reset third so it returns to the front of the queue and in PENDING, so it should be first again
      await liveQueueItemDao.resetModel({ leaderboardId, submissionId: third.submissionId });

      const result_six = await liveQueueItemDao.getNextPending({ leaderboardId });

      expect(result_six).toBeDefined();
      expect(result_six?.submissionId).toBe(third.submissionId);
      expect(result_six?.status).toBe(LiveQueueItemStatus.PENDING);
    });

    it('should return null when no PENDING items exist', async () => {
      const leaderboardId = resourceUtils.generateResourceId();

      const result = await liveQueueItemDao.getNextPending({ leaderboardId });

      expect(result).toBeNull();
    });
  });

  describe('deleteByLeaderboardId', () => {
    it('should delete all items for a leaderboard', async () => {
      const { leaderboardId, submission: s1 } = buildSubmission();
      const { submission: s2 } = buildSubmission(leaderboardId);
      await liveQueueItemDao.addToQueue(s1);
      await liveQueueItemDao.addToQueue(s2);

      await liveQueueItemDao.deleteByLeaderboardId(leaderboardId);

      const queue = await liveQueueItemDao.getQueue({ leaderboardId });
      expect(queue).toHaveLength(0);
    });

    it('should no-op when queue is empty', async () => {
      const leaderboardId = resourceUtils.generateResourceId();

      await expect(liveQueueItemDao.deleteByLeaderboardId(leaderboardId)).resolves.toBeUndefined();
    });
  });
});
