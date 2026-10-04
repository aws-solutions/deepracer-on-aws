// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarLogFetchStatus } from '@deepracer-indy/typescript-server-client';

import { TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { generateResourceId } from '../../utils/resourceUtils.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';
import { carLogFetchJobDao, isTerminalCarLogFetchStatus } from '../CarLogFetchJobDao.js';

const baseJob = (overrides: Record<string, unknown> = {}) => ({
  source: 'CAR' as const,
  status: CarLogFetchStatus.CREATED,
  instanceId: `mi-${generateResourceId()}`,
  profileId: generateResourceId(),
  ...overrides,
});

describe('CarLogFetchJobDao', () => {
  beforeEach(async () => {
    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
    await Promise.all(
      (Items ?? []).map((item) =>
        testDynamoDBDocumentClient.delete({ TableName: TEST_TABLE_NAME, Key: { pk: item.pk, sk: item.sk } }),
      ),
    );
  });

  it('creates a job with a ttl and loads it back', async () => {
    const job = await carLogFetchJobDao.createJob(baseJob());
    expect(job.ttl).toBeGreaterThan(Date.now() / 1000);

    const loaded = await carLogFetchJobDao.load({ jobId: job.jobId });
    expect(loaded.status).toBe(CarLogFetchStatus.CREATED);
  });

  it('lists jobs newest first', async () => {
    const first = await carLogFetchJobDao.createJob(baseJob({ createdAt: '2024-01-01T00:00:00.000Z' }));
    const second = await carLogFetchJobDao.createJob(baseJob({ createdAt: '2025-01-01T00:00:00.000Z' }));

    const { data } = await carLogFetchJobDao.list();
    expect(data.map((j) => j.jobId)).toEqual([second.jobId, first.jobId]);
  });

  it('lists jobs by event', async () => {
    const eventId = generateResourceId();
    const inEvent = await carLogFetchJobDao.createJob(baseJob({ eventId }));
    await carLogFetchJobDao.createJob(baseJob());

    const { data } = await carLogFetchJobDao.listByEvent({ eventId });
    expect(data.map((j) => j.jobId)).toEqual([inEvent.jobId]);
  });

  it('lists only non-terminal jobs of an instance', async () => {
    const instanceId = `mi-${generateResourceId()}`;
    const active = await carLogFetchJobDao.createJob(baseJob({ instanceId }));
    const finished = await carLogFetchJobDao.createJob(baseJob({ instanceId }));
    await carLogFetchJobDao.updateStatus({ jobId: finished.jobId, status: CarLogFetchStatus.DONE });
    await carLogFetchJobDao.createJob(baseJob());

    const jobs = await carLogFetchJobDao.listActiveByInstance({ instanceId });
    expect(jobs.map((j) => j.jobId)).toEqual([active.jobId]);
  });

  describe('updateStatus()', () => {
    it('updates status and attributes and bumps the version', async () => {
      const job = await carLogFetchJobDao.createJob(baseJob());
      const updated = await carLogFetchJobDao.updateStatus({
        jobId: job.jobId,
        status: CarLogFetchStatus.REQUESTED_UPLOAD,
        attributes: { ssmCommandId: 'cmd-1' },
      });

      expect(updated).toMatchObject({ status: CarLogFetchStatus.REQUESTED_UPLOAD, ssmCommandId: 'cmd-1' });
      expect(updated.endedAt).toBeUndefined();
    });

    it('sets endedAt and the error on terminal states', async () => {
      const job = await carLogFetchJobDao.createJob(baseJob());
      const updated = await carLogFetchJobDao.updateStatus({
        jobId: job.jobId,
        status: CarLogFetchStatus.FAILED,
        errorMessage: 'boom',
      });

      expect(updated).toMatchObject({ status: CarLogFetchStatus.FAILED, errorMessage: 'boom' });
      expect(updated.endedAt).toBeDefined();
    });

    it('never leaves a terminal state', async () => {
      const job = await carLogFetchJobDao.createJob(baseJob());
      await carLogFetchJobDao.updateStatus({ jobId: job.jobId, status: CarLogFetchStatus.DONE });

      await expect(
        carLogFetchJobDao.updateStatus({ jobId: job.jobId, status: CarLogFetchStatus.PROCESSING }),
      ).rejects.toThrow();
      expect((await carLogFetchJobDao.load({ jobId: job.jobId })).status).toBe(CarLogFetchStatus.DONE);
    });
  });

  it('identifies terminal statuses', () => {
    expect(isTerminalCarLogFetchStatus(CarLogFetchStatus.DONE)).toBe(true);
    expect(isTerminalCarLogFetchStatus(CarLogFetchStatus.UPLOAD_FAILED)).toBe(true);
    expect(isTerminalCarLogFetchStatus(CarLogFetchStatus.PROCESSING)).toBe(false);
  });
});
