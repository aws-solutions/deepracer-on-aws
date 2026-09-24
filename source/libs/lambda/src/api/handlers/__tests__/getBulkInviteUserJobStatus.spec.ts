// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { bulkInviteJobDao } from '@deepracer-indy/database';
import { BulkInviteJobStatus, NotAuthorizedError, NotFoundError } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetBulkInviteUserJobStatusOperation } from '../getBulkInviteUserJobStatus.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);

const job = {
  bulkInviteJobId: 'job-1',
  adminProfileId: TEST_OPERATION_CONTEXT.profileId,
  status: BulkInviteJobStatus.PROCESSING,
  totalEntries: 3,
  processedCount: 2,
  createdCount: 1,
  skippedCount: 1,
  failedCount: 0,
  results: [
    { emailAddress: 'a@example.com', status: 'CREATED' },
    { emailAddress: 'b@example.com', displayName: 'B', status: 'SKIPPED', reason: 'User already exists' },
  ],
};

describe('GetBulkInviteUserJobStatus operation', () => {
  beforeEach(() => {
    mockIsUserAdmin.mockResolvedValue(true);
    vi.spyOn(bulkInviteJobDao, 'getById').mockResolvedValue(job as never);
  });

  it('rejects non-admin callers', async () => {
    mockIsUserAdmin.mockResolvedValue(false);
    await expect(GetBulkInviteUserJobStatusOperation({ jobId: 'job-1' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotAuthorizedError,
    );
  });

  it('scopes the lookup to the requesting admin (job isolation)', async () => {
    await GetBulkInviteUserJobStatusOperation({ jobId: 'job-1' }, TEST_OPERATION_CONTEXT);
    expect(bulkInviteJobDao.getById).toHaveBeenCalledWith({
      adminProfileId: TEST_OPERATION_CONTEXT.profileId,
      bulkInviteJobId: 'job-1',
    });
  });

  it('returns 404 when the job does not exist', async () => {
    vi.spyOn(bulkInviteJobDao, 'getById').mockResolvedValue(null);
    await expect(GetBulkInviteUserJobStatusOperation({ jobId: 'missing' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('returns the status, counts, and per-entry results', async () => {
    const output = await GetBulkInviteUserJobStatusOperation({ jobId: 'job-1' }, TEST_OPERATION_CONTEXT);
    expect(output.status).toBe(BulkInviteJobStatus.PROCESSING);
    expect(output.totalEntries).toBe(3);
    expect(output.processedCount).toBe(2);
    expect(output.results).toHaveLength(2);
    expect(output.results?.[1]).toMatchObject({ displayName: 'B', reason: 'User already exists' });
  });

  it('derives EXPIRED for a stale PROCESSING record so the frontend stops polling (§5.5.1)', async () => {
    vi.spyOn(bulkInviteJobDao, 'getById').mockResolvedValue({
      ...job,
      updatedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    } as never);

    const output = await GetBulkInviteUserJobStatusOperation({ jobId: 'job-1' }, TEST_OPERATION_CONTEXT);
    expect(output.status).toBe(BulkInviteJobStatus.EXPIRED);
  });

  it('does not expire a fresh PROCESSING record', async () => {
    vi.spyOn(bulkInviteJobDao, 'getById').mockResolvedValue({
      ...job,
      updatedAt: new Date().toISOString(),
    } as never);

    const output = await GetBulkInviteUserJobStatusOperation({ jobId: 'job-1' }, TEST_OPERATION_CONTEXT);
    expect(output.status).toBe(BulkInviteJobStatus.PROCESSING);
  });
});
