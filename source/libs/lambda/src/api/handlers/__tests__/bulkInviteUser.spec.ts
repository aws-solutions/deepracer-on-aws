// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { bulkInviteJobDao } from '@deepracer-indy/database';
import {
  BadRequestError,
  BulkInviteJobStatus,
  ConflictError,
  InternalFailureError,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';

import { sfnClient } from '../../../utils/clients/sfnClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { BulkInviteUserOperation } from '../bulkInviteUser.js';

vi.mock('../../../utils/clients/sfnClient.js', () => ({
  sfnClient: { send: vi.fn() },
}));

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);
const STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:111122223333:stateMachine:BulkInvite';

const input = (count: number) => ({
  profiles: Array.from({ length: count }, (_, i) => ({ emailAddress: `racer${i}@example.com` })),
});

const sentInput = () =>
  JSON.parse((vi.mocked(sfnClient.send).mock.calls[0][0] as never as { input: { input: string } }).input.input);

describe('BulkInviteUser operation', () => {
  beforeEach(() => {
    mockIsUserAdmin.mockResolvedValue(true);
    process.env.BULK_INVITE_STATE_MACHINE_ARN = STATE_MACHINE_ARN;
    delete process.env.EMAIL_DELIVERY_METHOD;
    delete process.env.COGNITO_DAILY_EMAIL_LIMIT;
    vi.mocked(sfnClient.send).mockResolvedValue({} as never);
    vi.spyOn(bulkInviteJobDao, 'hasActiveJob').mockResolvedValue(false);
    vi.spyOn(bulkInviteJobDao, 'createJob').mockImplementation(
      (params) =>
        Promise.resolve({
          bulkInviteJobId: 'job-001',
          adminProfileId: params.adminProfileId,
          status: BulkInviteJobStatus.PROCESSING,
          totalEntries: params.totalEntries,
        }) as never,
    );
    vi.spyOn(bulkInviteJobDao, 'markTerminal').mockResolvedValue({} as never);
    vi.spyOn(bulkInviteJobDao, 'getTokenGuard').mockResolvedValue(null);
    vi.spyOn(bulkInviteJobDao, 'getById').mockResolvedValue(null);
  });

  it('creates a job and starts the state machine for a valid request', async () => {
    const out = await BulkInviteUserOperation(input(2), TEST_OPERATION_CONTEXT);

    expect(bulkInviteJobDao.createJob).toHaveBeenCalledWith(
      expect.objectContaining({ adminProfileId: TEST_OPERATION_CONTEXT.profileId, totalEntries: 2 }),
    );
    expect(sfnClient.send).toHaveBeenCalledTimes(1);
    const payload = sentInput();
    expect(payload).toMatchObject({ jobId: 'job-001', adminProfileId: TEST_OPERATION_CONTEXT.profileId });
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries[0]).toMatchObject({ index: 0, emailAddress: 'racer0@example.com' });
    expect(out).toEqual({ jobId: 'job-001', status: BulkInviteJobStatus.PROCESSING, totalEntries: 2 });
  });

  it('rejects non-admin callers without creating a job or starting the machine', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(false);

    await expect(BulkInviteUserOperation(input(2), TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
    expect(bulkInviteJobDao.createJob).not.toHaveBeenCalled();
    expect(sfnClient.send).not.toHaveBeenCalled();
  });

  it('fails with a config error when the state machine ARN is missing', async () => {
    delete process.env.BULK_INVITE_STATE_MACHINE_ARN;

    await expect(BulkInviteUserOperation(input(2), TEST_OPERATION_CONTEXT)).rejects.toThrow(InternalFailureError);
    expect(bulkInviteJobDao.createJob).not.toHaveBeenCalled();
  });

  it('rejects an invalid email address', async () => {
    const bad = { profiles: [{ emailAddress: 'not-an-email' }] };
    await expect(BulkInviteUserOperation(bad, TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
    expect(bulkInviteJobDao.createJob).not.toHaveBeenCalled();
  });

  it('rejects duplicate email addresses (case-insensitive)', async () => {
    const dup = { profiles: [{ emailAddress: 'a@example.com' }, { emailAddress: 'A@Example.com' }] };
    await expect(BulkInviteUserOperation(dup, TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
    expect(sfnClient.send).not.toHaveBeenCalled();
  });

  it('rejects more than 200 entries', async () => {
    await expect(BulkInviteUserOperation(input(201), TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
  });

  it('rejects when the default Cognito email quota would be exceeded', async () => {
    process.env.COGNITO_DAILY_EMAIL_LIMIT = '1';
    await expect(BulkInviteUserOperation(input(2), TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
    expect(bulkInviteJobDao.createJob).not.toHaveBeenCalled();
  });

  it('allows a large batch when SES is configured (pre-flight bypassed)', async () => {
    process.env.EMAIL_DELIVERY_METHOD = 'SES';
    process.env.COGNITO_DAILY_EMAIL_LIMIT = '1';
    await expect(BulkInviteUserOperation(input(5), TEST_OPERATION_CONTEXT)).resolves.toMatchObject({ totalEntries: 5 });
    expect(sfnClient.send).toHaveBeenCalledTimes(1);
  });

  it('rejects with 409 when a bulk invite is already in progress', async () => {
    vi.spyOn(bulkInviteJobDao, 'hasActiveJob').mockResolvedValue(true);

    await expect(BulkInviteUserOperation(input(2), TEST_OPERATION_CONTEXT)).rejects.toThrow(ConflictError);
    expect(bulkInviteJobDao.createJob).not.toHaveBeenCalled();
    expect(sfnClient.send).not.toHaveBeenCalled();
  });

  it('marks the job FAILED and errors when StartExecution fails', async () => {
    vi.mocked(sfnClient.send).mockRejectedValueOnce(new Error('SFN down'));

    await expect(BulkInviteUserOperation(input(2), TEST_OPERATION_CONTEXT)).rejects.toThrow(InternalFailureError);
    expect(bulkInviteJobDao.markTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ bulkInviteJobId: 'job-001', status: BulkInviteJobStatus.FAILED }),
    );
  });

  it('forwards clientToken to createJob and checks the token guard before creating a job', async () => {
    const clientToken = crypto.randomUUID();
    const out = await BulkInviteUserOperation(
      { profiles: [{ emailAddress: 'a@example.com' }, { emailAddress: 'b@example.com' }], clientToken },
      TEST_OPERATION_CONTEXT,
    );

    expect(out).toEqual({ jobId: 'job-001', status: BulkInviteJobStatus.PROCESSING, totalEntries: 2 });
    expect(bulkInviteJobDao.getTokenGuard).toHaveBeenCalledWith({
      adminProfileId: TEST_OPERATION_CONTEXT.profileId,
      clientToken,
    });
    expect(bulkInviteJobDao.createJob).toHaveBeenCalledWith(
      expect.objectContaining({ adminProfileId: TEST_OPERATION_CONTEXT.profileId, totalEntries: 2, clientToken }),
    );
    expect(sfnClient.send).toHaveBeenCalledTimes(1);
  });

  it('replays a repeated clientToken: returns the original job without creating a new one or starting a new execution', async () => {
    const clientToken = crypto.randomUUID();
    vi.spyOn(bulkInviteJobDao, 'getTokenGuard').mockResolvedValue({ bulkInviteJobId: 'job-original' } as never);
    vi.spyOn(bulkInviteJobDao, 'getById').mockResolvedValue({
      bulkInviteJobId: 'job-original',
      adminProfileId: TEST_OPERATION_CONTEXT.profileId,
      status: BulkInviteJobStatus.PROCESSING,
      totalEntries: 2,
    } as never);

    const out = await BulkInviteUserOperation(
      { profiles: [{ emailAddress: 'a@example.com' }, { emailAddress: 'b@example.com' }], clientToken },
      TEST_OPERATION_CONTEXT,
    );

    expect(out).toEqual({ jobId: 'job-original', status: BulkInviteJobStatus.PROCESSING, totalEntries: 2 });
    expect(bulkInviteJobDao.createJob).not.toHaveBeenCalled();
    expect(bulkInviteJobDao.hasActiveJob).not.toHaveBeenCalled();
    expect(sfnClient.send).not.toHaveBeenCalled();
  });

  it('throws ConflictError when a token guard exists but its job cannot be found', async () => {
    const clientToken = crypto.randomUUID();
    vi.spyOn(bulkInviteJobDao, 'getTokenGuard').mockResolvedValue({ bulkInviteJobId: 'missing-job' } as never);
    vi.spyOn(bulkInviteJobDao, 'getById').mockResolvedValue(null);

    await expect(
      BulkInviteUserOperation({ profiles: [{ emailAddress: 'a@example.com' }], clientToken }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(ConflictError);
    expect(bulkInviteJobDao.createJob).not.toHaveBeenCalled();
    expect(sfnClient.send).not.toHaveBeenCalled();
  });

  it('treats ExecutionAlreadyExists as an idempotent success (no FAILED marking)', async () => {
    vi.mocked(sfnClient.send).mockRejectedValueOnce(
      Object.assign(new Error('already exists'), { name: 'ExecutionAlreadyExists' }),
    );

    await expect(
      BulkInviteUserOperation({ profiles: [{ emailAddress: 'a@example.com' }] }, TEST_OPERATION_CONTEXT),
    ).resolves.toMatchObject({ jobId: 'job-001' });
    expect(bulkInviteJobDao.markTerminal).not.toHaveBeenCalled();
  });
});
