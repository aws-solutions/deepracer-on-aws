// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { bulkInviteJobDao } from '@deepracer-indy/database';
import { BulkInviteJobStatus, NotAuthorizedError } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ListBulkInviteUserJobsOperation } from '../listBulkInviteUserJobs.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);

const baseJob = {
  adminProfileId: TEST_OPERATION_CONTEXT.profileId,
  totalEntries: 3,
  processedCount: 3,
  createdCount: 2,
  skippedCount: 1,
  failedCount: 0,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
  results: [],
};

describe('ListBulkInviteUserJobs operation', () => {
  beforeEach(() => {
    mockIsUserAdmin.mockResolvedValue(true);
  });

  it('rejects non-admin callers', async () => {
    mockIsUserAdmin.mockResolvedValue(false);
    await expect(ListBulkInviteUserJobsOperation({}, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
  });

  it('maps jobs to summaries scoped to the requesting admin', async () => {
    vi.spyOn(bulkInviteJobDao, 'listRecentByAdmin').mockResolvedValue([
      { ...baseJob, bulkInviteJobId: 'job-1', status: BulkInviteJobStatus.COMPLETED },
    ] as never);

    const output = await ListBulkInviteUserJobsOperation({}, TEST_OPERATION_CONTEXT);

    expect(bulkInviteJobDao.listRecentByAdmin).toHaveBeenCalledWith(TEST_OPERATION_CONTEXT.profileId);
    expect(output.jobs).toHaveLength(1);
    expect(output.jobs[0]).toMatchObject({
      jobId: 'job-1',
      status: BulkInviteJobStatus.COMPLETED,
      totalEntries: 3,
      processedCount: 3,
      createdCount: 2,
      skippedCount: 1,
      failedCount: 0,
    });
  });

  it('derives EXPIRED for a stale PROCESSING job', async () => {
    vi.spyOn(bulkInviteJobDao, 'listRecentByAdmin').mockResolvedValue([
      {
        ...baseJob,
        bulkInviteJobId: 'job-stale',
        status: BulkInviteJobStatus.PROCESSING,
        updatedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
      },
    ] as never);

    const output = await ListBulkInviteUserJobsOperation({}, TEST_OPERATION_CONTEXT);
    expect(output.jobs[0].status).toBe(BulkInviteJobStatus.EXPIRED);
  });

  it('does not expire a fresh PROCESSING job', async () => {
    vi.spyOn(bulkInviteJobDao, 'listRecentByAdmin').mockResolvedValue([
      { ...baseJob, bulkInviteJobId: 'job-fresh', status: BulkInviteJobStatus.PROCESSING },
    ] as never);

    const output = await ListBulkInviteUserJobsOperation({}, TEST_OPERATION_CONTEXT);
    expect(output.jobs[0].status).toBe(BulkInviteJobStatus.PROCESSING);
  });
});
