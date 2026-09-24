// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BulkInviteEntryStatus, BulkInviteJobStatus } from '@deepracer-indy/typescript-server-client';

import { TEST_TABLE_NAME } from '../../constants/testConstants.js';
import type { ResourceId } from '../../types/resource.js';
import { generateResourceId } from '../../utils/resourceUtils.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';
import { ACTIVE_JOB_STALE_MS, bulkInviteJobDao } from '../BulkInviteJobDao.js';

const adminProfileId = generateResourceId() as ResourceId;

const result = (status: BulkInviteEntryStatus, emailAddress = 'racer@example.com') => ({
  emailAddress,
  status,
});

describe('BulkInviteJobDao', () => {
  beforeEach(async () => {
    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
    if (Items?.length) {
      await Promise.all(
        Items.map((item) =>
          testDynamoDBDocumentClient.delete({ TableName: TEST_TABLE_NAME, Key: { pk: item.pk, sk: item.sk } }),
        ),
      );
    }
  });

  describe('createJob() / getById()', () => {
    it('creates a PROCESSING job with zeroed counters and an empty results list', async () => {
      const created = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 3 });

      expect(created).toMatchObject({
        adminProfileId,
        status: BulkInviteJobStatus.PROCESSING,
        totalEntries: 3,
        processedCount: 0,
        createdCount: 0,
        skippedCount: 0,
        failedCount: 0,
        results: [],
      });
      expect(created.bulkInviteJobId).toMatch(/^[0-9A-Z]{26}$/); // ULID, time-ordered SK (§5.5.1)

      // A ~90-day DynamoDB TTL is set at creation so the record self-expires.
      const ninetyDaysSeconds = 90 * 24 * 60 * 60;
      const nowSeconds = Math.floor(Date.now() / 1000);
      expect(created.ttl).toBeGreaterThanOrEqual(nowSeconds + ninetyDaysSeconds - 120);
      expect(created.ttl).toBeLessThanOrEqual(nowSeconds + ninetyDaysSeconds + 120);

      const fetched = await bulkInviteJobDao.getById({ adminProfileId, bulkInviteJobId: created.bulkInviteJobId });
      expect(fetched?.bulkInviteJobId).toBe(created.bulkInviteJobId);
    });

    it('scopes the job under the admin profile partition (PK profile_, SK bulkinvitejob_)', async () => {
      const created = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 1 });
      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = Items?.[0] as any;
      expect(item.pk).toBe(`profile_${adminProfileId}`);
      expect(item.sk).toBe(`bulkinvitejob_${created.bulkInviteJobId}`);
    });

    it('always generates a fresh, distinct job id per call when no clientToken is supplied', async () => {
      const first = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 3 });
      const second = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 3 });

      expect(second.bulkInviteJobId).not.toBe(first.bulkInviteJobId);
      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
      expect(Items).toHaveLength(2);
    });

    it('getTokenGuard() resolves to null for an unused clientToken', async () => {
      const guard = await bulkInviteJobDao.getTokenGuard({ adminProfileId, clientToken: 'never-used' });
      expect(guard).toBeNull();
    });

    // The clientToken path uses a multi-item DynamoDB transaction (TransactWriteItems), which
    // vitest-dynamodb-lite (the local emulator these tests run against) does not implement — see
    // BulkInviteJobDao.spec-mocked.ts for token-guard coverage using mocked entities/Service,
    // mirroring how LapDao.spec.ts covers its own (also transaction-based) token guard.
  });

  describe('appendEntryResult()', () => {
    it('appends results and increments processed + per-status counters', async () => {
      const { bulkInviteJobId } = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 3 });

      await bulkInviteJobDao.appendEntryResult({
        adminProfileId,
        bulkInviteJobId,
        entryIndex: 0,
        result: result(BulkInviteEntryStatus.CREATED),
      });
      await bulkInviteJobDao.appendEntryResult({
        adminProfileId,
        bulkInviteJobId,
        entryIndex: 1,
        result: result(BulkInviteEntryStatus.SKIPPED),
      });

      const job = await bulkInviteJobDao.getById({ adminProfileId, bulkInviteJobId });
      expect(job).toMatchObject({ processedCount: 2, createdCount: 1, skippedCount: 1, failedCount: 0 });
      expect(job?.results).toHaveLength(2);
    });

    it('is idempotent: a replayed write at the same index does not double-append or double-count', async () => {
      const { bulkInviteJobId } = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 2 });
      const entry = { adminProfileId, bulkInviteJobId, entryIndex: 0, result: result(BulkInviteEntryStatus.FAILED) };

      await bulkInviteJobDao.appendEntryResult(entry);
      // Simulated SDK retry after a lost response — the conditional guard must reject it silently.
      await expect(bulkInviteJobDao.appendEntryResult(entry)).resolves.toBeUndefined();

      const job = await bulkInviteJobDao.getById({ adminProfileId, bulkInviteJobId });
      expect(job?.results).toHaveLength(1);
      expect(job).toMatchObject({ processedCount: 1, failedCount: 1 });
    });
  });

  describe('markTerminal()', () => {
    it('sets a terminal status, completedAt, and (for FAILED) the errorMessage', async () => {
      const { bulkInviteJobId } = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 1 });

      const completed = await bulkInviteJobDao.markTerminal({
        adminProfileId,
        bulkInviteJobId,
        status: BulkInviteJobStatus.COMPLETED,
      });
      expect(completed.status).toBe(BulkInviteJobStatus.COMPLETED);
      expect(completed.completedAt).toEqual(expect.any(String));

      const failed = await bulkInviteJobDao.markTerminal({
        adminProfileId,
        bulkInviteJobId,
        status: BulkInviteJobStatus.FAILED,
        errorMessage: 'state machine error',
      });
      expect(failed).toMatchObject({ status: BulkInviteJobStatus.FAILED, errorMessage: 'state machine error' });
    });
  });

  describe('hasActiveJob()', () => {
    it('is true while a fresh PROCESSING job exists and false once it is terminal', async () => {
      const { bulkInviteJobId } = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 1 });
      expect(await bulkInviteJobDao.hasActiveJob(adminProfileId)).toBe(true);

      await bulkInviteJobDao.markTerminal({ adminProfileId, bulkInviteJobId, status: BulkInviteJobStatus.COMPLETED });
      expect(await bulkInviteJobDao.hasActiveJob(adminProfileId)).toBe(false);
    });

    it('treats a PROCESSING job older than the staleness horizon as inactive (escape hatch)', async () => {
      const { bulkInviteJobId } = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 1 });
      // Backdate createdAt beyond the staleness horizon to simulate a stuck job.
      const staleIso = new Date(Date.now() - ACTIVE_JOB_STALE_MS - 60_000).toISOString();
      await testDynamoDBDocumentClient.update({
        TableName: TEST_TABLE_NAME,
        Key: { pk: `profile_${adminProfileId}`, sk: `bulkinvitejob_${bulkInviteJobId}` },
        UpdateExpression: 'SET createdAt = :u',
        ExpressionAttributeValues: { ':u': staleIso },
      });

      expect(await bulkInviteJobDao.hasActiveJob(adminProfileId)).toBe(false);
    });

    it('transitions a stale PROCESSING job to EXPIRED (persisted) so it no longer blocks new jobs', async () => {
      const { bulkInviteJobId } = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 1 });
      const staleIso = new Date(Date.now() - ACTIVE_JOB_STALE_MS - 60_000).toISOString();
      await testDynamoDBDocumentClient.update({
        TableName: TEST_TABLE_NAME,
        Key: { pk: `profile_${adminProfileId}`, sk: `bulkinvitejob_${bulkInviteJobId}` },
        UpdateExpression: 'SET createdAt = :u',
        ExpressionAttributeValues: { ':u': staleIso },
      });

      expect(await bulkInviteJobDao.hasActiveJob(adminProfileId)).toBe(false);

      const job = await bulkInviteJobDao.getById({ adminProfileId, bulkInviteJobId });
      expect(job?.status).toBe(BulkInviteJobStatus.EXPIRED);
      expect(job?.completedAt).toEqual(expect.any(String));
    });

    it('is false when the admin has no jobs', async () => {
      expect(await bulkInviteJobDao.hasActiveJob(generateResourceId() as ResourceId)).toBe(false);
    });
  });

  describe('listRecentByAdmin()', () => {
    it("returns the admin's jobs most recent first (by createdAt)", async () => {
      const older = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 1 });
      const newer = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 2 });
      // Make createdAt deterministic and distinct (jobIds are random nanoids, not time-ordered).
      const setCreatedAt = (bulkInviteJobId: string, createdAt: string) =>
        testDynamoDBDocumentClient.update({
          TableName: TEST_TABLE_NAME,
          Key: { pk: `profile_${adminProfileId}`, sk: `bulkinvitejob_${bulkInviteJobId}` },
          UpdateExpression: 'SET createdAt = :c',
          ExpressionAttributeValues: { ':c': createdAt },
        });
      await setCreatedAt(older.bulkInviteJobId, '2026-01-01T00:00:00.000Z');
      await setCreatedAt(newer.bulkInviteJobId, '2026-06-01T00:00:00.000Z');

      const jobs = await bulkInviteJobDao.listRecentByAdmin(adminProfileId);
      expect(jobs.map((j) => j.bulkInviteJobId)).toEqual([newer.bulkInviteJobId, older.bulkInviteJobId]);
    });

    it('returns an empty list for an admin with no jobs', async () => {
      expect(await bulkInviteJobDao.listRecentByAdmin(generateResourceId() as ResourceId)).toEqual([]);
    });
  });
});
