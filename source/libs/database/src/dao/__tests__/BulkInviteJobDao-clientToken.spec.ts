// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BulkInviteJobStatus, ConflictError, InternalFailureError } from '@deepracer-indy/typescript-server-client';

import { TEST_PROFILE_ID_1 } from '../../constants/testConstants.js';

// The clientToken idempotency path (BulkInviteJobDao.createJob) uses a DynamoDB transaction
// (Service.transaction.write), which vitest-dynamodb-lite (the local emulator used by
// BulkInviteJobDao.spec.ts's other, real-DB tests) does not implement. This file instead mocks
// `electrodb`'s Service and the two entities involved, mirroring the pattern LapDao.spec.ts uses
// to unit-test its own (also transaction-based) idempotency-token guard.
const mockBulkInviteJobsEntity = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  query: { byAdminProfileId: vi.fn() },
  parse: vi.fn(),
}));

const mockBulkInviteJobTokensEntity = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
}));

const mockTransactionGo = vi.hoisted(() => vi.fn());
const mockTransactionParams = vi.hoisted(() => vi.fn());
const mockTransactionWrite = vi.hoisted(() =>
  vi.fn(
    (
      callback: (entities: {
        bulkInviteJobs: typeof mockBulkInviteJobsEntity;
        bulkInviteJobTokens: typeof mockBulkInviteJobTokensEntity;
      }) => unknown,
    ) => {
      callback({ bulkInviteJobs: mockBulkInviteJobsEntity, bulkInviteJobTokens: mockBulkInviteJobTokensEntity });
      return {
        go: mockTransactionGo,
        params: mockTransactionParams,
      };
    },
  ),
);

vi.mock('electrodb', async () => ({
  ...(await vi.importActual('electrodb')),
  Service: vi.fn(function () {
    return {
      entities: {
        bulkInviteJobs: mockBulkInviteJobsEntity,
        bulkInviteJobTokens: mockBulkInviteJobTokensEntity,
      },
      transaction: {
        write: mockTransactionWrite,
      },
    };
  }),
}));

vi.mock('#entities/BulkInviteJobEntity.js', async () => {
  const actual = await vi.importActual<typeof import('../../entities/BulkInviteJobEntity.js')>(
    '../../entities/BulkInviteJobEntity.js',
  );
  return { ...actual, BulkInviteJobEntity: mockBulkInviteJobsEntity };
});

vi.mock('#entities/BulkInviteJobTokenEntity.js', async () => {
  const actual = await vi.importActual<typeof import('../../entities/BulkInviteJobTokenEntity.js')>(
    '../../entities/BulkInviteJobTokenEntity.js',
  );
  return { ...actual, BulkInviteJobTokenEntity: mockBulkInviteJobTokensEntity };
});

const { bulkInviteJobDao } = await import('../BulkInviteJobDao.js');

const adminProfileId = TEST_PROFILE_ID_1;

const TEST_JOB_ITEM = {
  adminProfileId,
  bulkInviteJobId: 'generatedJobId123',
  status: BulkInviteJobStatus.PROCESSING,
  totalEntries: 3,
  processedCount: 0,
  createdCount: 0,
  skippedCount: 0,
  failedCount: 0,
  results: [],
};

describe('BulkInviteJobDao — clientToken idempotency (mocked Service/transaction)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBulkInviteJobsEntity.create.mockReturnValue({ commit: vi.fn(() => 'job-commit') });
    mockBulkInviteJobTokensEntity.create.mockReturnValue({ commit: vi.fn(() => 'token-commit') });
    mockTransactionParams.mockReturnValue({
      TransactItems: [{ Put: { mock: 'job-put-params' } }, { Put: { mock: 'token-put-params' } }],
    });
    mockBulkInviteJobsEntity.parse.mockReturnValue({ data: TEST_JOB_ITEM });
  });

  it('creates the job with no token guard item when clientToken is not supplied', async () => {
    mockBulkInviteJobsEntity.create.mockReturnValue({ go: vi.fn().mockResolvedValue({ data: TEST_JOB_ITEM }) });

    const result = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 3 });

    expect(mockTransactionWrite).not.toHaveBeenCalled();
    expect(mockBulkInviteJobTokensEntity.create).not.toHaveBeenCalled();
    expect(result).toEqual(TEST_JOB_ITEM);
  });

  it('creates the job and a token guard item transactionally when clientToken is supplied', async () => {
    mockTransactionGo.mockResolvedValue({ canceled: false });

    const result = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 3, clientToken: 'token-abc' });

    expect(mockTransactionWrite).toHaveBeenCalledWith(expect.any(Function));
    expect(mockBulkInviteJobsEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({ adminProfileId, totalEntries: 3, status: BulkInviteJobStatus.PROCESSING }),
    );
    expect(mockBulkInviteJobTokensEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({ adminProfileId, clientToken: 'token-abc' }),
    );
    expect(result).toEqual(TEST_JOB_ITEM);
  });

  it('is idempotent: a canceled transaction (replayed clientToken) resolves the original job via the token guard', async () => {
    mockTransactionGo.mockResolvedValue({
      canceled: true,
      data: [
        { rejected: false, code: 'None' },
        { rejected: true, code: 'ConditionalCheckFailed' },
      ],
    });
    mockBulkInviteJobTokensEntity.get.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: { bulkInviteJobId: TEST_JOB_ITEM.bulkInviteJobId } }),
    });
    mockBulkInviteJobsEntity.get.mockReturnValue({ go: vi.fn().mockResolvedValue({ data: TEST_JOB_ITEM }) });

    const result = await bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 3, clientToken: 'token-abc' });

    expect(mockBulkInviteJobTokensEntity.get).toHaveBeenCalledWith({ adminProfileId, clientToken: 'token-abc' });
    expect(result).toEqual(TEST_JOB_ITEM);
  });

  it('throws ConflictError if the transaction is canceled on the token guard but it cannot be resolved to a job', async () => {
    mockTransactionGo.mockResolvedValue({
      canceled: true,
      data: [
        { rejected: false, code: 'None' },
        { rejected: true, code: 'ConditionalCheckFailed' },
      ],
    });
    mockBulkInviteJobTokensEntity.get.mockReturnValue({ go: vi.fn().mockResolvedValue({ data: null }) });

    await expect(
      bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 3, clientToken: 'token-abc' }),
    ).rejects.toThrow(ConflictError);
  });

  it('throws InternalFailureError (not ConflictError) when the transaction is canceled for a reason other than the token guard', async () => {
    // e.g. a TransactionConflictException or throttling — the job item (index 0) was rejected,
    // not the token guard (index 1), so this is NOT a replayed clientToken and must not be
    // silently reinterpreted as one.
    mockTransactionGo.mockResolvedValue({
      canceled: true,
      data: [
        { rejected: true, code: 'TransactionConflict' },
        { rejected: false, code: 'None' },
      ],
    });

    await expect(
      bulkInviteJobDao.createJob({ adminProfileId, totalEntries: 3, clientToken: 'token-abc' }),
    ).rejects.toThrow(InternalFailureError);
    expect(mockBulkInviteJobTokensEntity.get).not.toHaveBeenCalled();
  });

  describe('getTokenGuard()', () => {
    it('resolves the guard item for a given token', async () => {
      mockBulkInviteJobTokensEntity.get.mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: { bulkInviteJobId: 'job-1' } }),
      });

      const guard = await bulkInviteJobDao.getTokenGuard({ adminProfileId, clientToken: 'token-abc' });

      expect(mockBulkInviteJobTokensEntity.get).toHaveBeenCalledWith({ adminProfileId, clientToken: 'token-abc' });
      expect(guard).toEqual({ bulkInviteJobId: 'job-1' });
    });

    it('resolves null when no guard item exists for the token', async () => {
      mockBulkInviteJobTokensEntity.get.mockReturnValue({ go: vi.fn().mockResolvedValue({ data: null }) });

      const guard = await bulkInviteJobDao.getTokenGuard({ adminProfileId, clientToken: 'unused-token' });

      expect(guard).toBeNull();
    });
  });
});
