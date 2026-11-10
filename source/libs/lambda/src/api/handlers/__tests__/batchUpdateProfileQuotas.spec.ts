// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { profileDao, TEST_PROFILE_ITEM } from '@deepracer-indy/database';
import {
  getBatchUpdateProfileQuotasHandler,
  NotAuthorizedError,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { HttpRequest } from '@smithy/protocol-http';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { BatchUpdateProfileQuotasOperation } from '../batchUpdateProfileQuotas.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn();
const A = 'profileAAAAAAAA';
const B = 'profileBBBBBBBB';
const C = 'profileCCCCCCCC';
const QUOTAS = { maxTotalComputeMinutes: 1200, maxModelCount: 8 };
const BEFORE = { maxTotalComputeMinutes: 600, maxModelCount: 5 };

const makeProfileIds = (count: number) =>
  Array.from({ length: count }, (_, i) => `profile${String(i).padStart(8, '0')}`);

const auditCalls = () => vi.mocked(logger.info).mock.calls.filter(([message]) => message === 'QUOTA_UPDATE_AUDIT');

describe('BatchUpdateProfileQuotas operation', () => {
  beforeEach(() => {
    mockIsUserAdmin.mockResolvedValue(true);
    vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.spyOn(profileDao, 'load').mockImplementation(async ({ profileId }) => ({
      ...TEST_PROFILE_ITEM,
      ...BEFORE,
      profileId,
    }));
    vi.spyOn(profileDao, 'update').mockImplementation(async ({ profileId }, attributes) => ({
      ...TEST_PROFILE_ITEM,
      ...attributes,
      profileId,
    }));
  });

  it('should reject a non-admin caller without touching any profile', async () => {
    mockIsUserAdmin.mockResolvedValue(false);

    await expect(
      BatchUpdateProfileQuotasOperation({ profileIds: [A], ...QUOTAS }, TEST_OPERATION_CONTEXT),
    ).rejects.toStrictEqual(new NotAuthorizedError({ message: 'Only administrators can update usage quotas.' }));
    expect(mockIsUserAdmin).toHaveBeenCalledWith(TEST_OPERATION_CONTEXT.profileId);
    expect(profileDao.load).not.toHaveBeenCalled();
    expect(profileDao.update).not.toHaveBeenCalled();
  });

  it('should authorize the caller once and update every profile with exactly the two quota values', async () => {
    const output = await BatchUpdateProfileQuotasOperation(
      { profileIds: [A, B, C], ...QUOTAS },
      TEST_OPERATION_CONTEXT,
    );

    expect(output).toEqual({ updatedProfileIds: [A, B, C], errors: [] });
    expect(mockIsUserAdmin).toHaveBeenCalledTimes(1);
    expect(profileDao.load).toHaveBeenCalledTimes(3);
    expect(profileDao.load).toHaveBeenCalledWith({ profileId: A });
    expect(profileDao.load).toHaveBeenCalledWith({ profileId: B });
    expect(profileDao.load).toHaveBeenCalledWith({ profileId: C });
    expect(profileDao.update).toHaveBeenCalledTimes(3);
    expect(profileDao.update).toHaveBeenCalledWith({ profileId: A }, QUOTAS);
    expect(profileDao.update).toHaveBeenCalledWith({ profileId: B }, QUOTAS);
    expect(profileDao.update).toHaveBeenCalledWith({ profileId: C }, QUOTAS);
  });

  it('should write -1 (unlimited) for both quotas', async () => {
    const unlimited = { maxTotalComputeMinutes: -1, maxModelCount: -1 };

    const output = await BatchUpdateProfileQuotasOperation({ profileIds: [A], ...unlimited }, TEST_OPERATION_CONTEXT);

    expect(output.updatedProfileIds).toEqual([A]);
    expect(profileDao.update).toHaveBeenCalledWith({ profileId: A }, unlimited);
  });

  it('should continue past a missing profile and report it as NotFoundError', async () => {
    vi.mocked(profileDao.load).mockImplementation(async ({ profileId }) => {
      if (profileId === B) {
        throw new NotFoundError({ message: 'Item not found.' });
      }
      return { ...TEST_PROFILE_ITEM, ...BEFORE, profileId };
    });

    const output = await BatchUpdateProfileQuotasOperation(
      { profileIds: [A, B, C], ...QUOTAS },
      TEST_OPERATION_CONTEXT,
    );

    expect(output).toEqual({
      updatedProfileIds: [A, C],
      errors: [{ profileId: B, code: 'NotFoundError', message: 'Profile not found.' }],
    });
    expect(profileDao.update).not.toHaveBeenCalledWith({ profileId: B }, QUOTAS);
    expect(logger.warn).toHaveBeenCalledWith('Failed to update profile quotas', {
      action: 'QUOTA_UPDATE_FAILURE',
      profileId: B,
      error: expect.any(NotFoundError),
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should report an unexpected write failure with a generic message and log the detail as an error', async () => {
    const writeError = Object.assign(new Error('Throughput exceeded'), {
      name: 'ProvisionedThroughputExceededException',
    });
    vi.mocked(profileDao.update).mockImplementation(async ({ profileId }, attributes) => {
      if (profileId === A) {
        throw writeError;
      }
      return { ...TEST_PROFILE_ITEM, ...attributes, profileId };
    });

    const output = await BatchUpdateProfileQuotasOperation({ profileIds: [A, B], ...QUOTAS }, TEST_OPERATION_CONTEXT);

    expect(output).toEqual({
      updatedProfileIds: [B],
      errors: [
        {
          profileId: A,
          code: 'ProvisionedThroughputExceededException',
          message: 'Failed to update the profile quotas.',
        },
      ],
    });
    expect(logger.error).toHaveBeenCalledWith('Failed to update profile quotas', {
      action: 'QUOTA_UPDATE_FAILURE',
      profileId: A,
      error: writeError,
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should fall back to the InternalFailure code when the rejection has no error name', async () => {
    vi.mocked(profileDao.update).mockImplementation(async ({ profileId }, attributes) => {
      if (profileId === A) {
        throw 'connection reset';
      }
      return { ...TEST_PROFILE_ITEM, ...attributes, profileId };
    });

    const output = await BatchUpdateProfileQuotasOperation({ profileIds: [A, B], ...QUOTAS }, TEST_OPERATION_CONTEXT);

    expect(output).toEqual({
      updatedProfileIds: [B],
      errors: [{ profileId: A, code: 'InternalFailure', message: 'Failed to update the profile quotas.' }],
    });
    expect(logger.error).toHaveBeenCalledWith('Failed to update profile quotas', {
      action: 'QUOTA_UPDATE_FAILURE',
      profileId: A,
      error: 'connection reset',
    });
  });

  it('should return every profile in errors when all updates fail', async () => {
    vi.mocked(profileDao.load).mockRejectedValue(new NotFoundError({ message: 'Item not found.' }));

    const output = await BatchUpdateProfileQuotasOperation({ profileIds: [A, B], ...QUOTAS }, TEST_OPERATION_CONTEXT);

    expect(output.updatedProfileIds).toEqual([]);
    expect(output.errors.map(({ profileId }) => profileId)).toEqual([A, B]);
    expect(profileDao.update).not.toHaveBeenCalled();
  });

  it('should log one audit entry per updated profile with before and after values, and none for failures', async () => {
    vi.mocked(profileDao.load).mockImplementation(async ({ profileId }) => {
      if (profileId === B) {
        throw new NotFoundError({ message: 'Item not found.' });
      }
      return { ...TEST_PROFILE_ITEM, ...BEFORE, profileId };
    });

    await BatchUpdateProfileQuotasOperation({ profileIds: [A, B], ...QUOTAS }, TEST_OPERATION_CONTEXT);

    expect(auditCalls()).toEqual([
      [
        'QUOTA_UPDATE_AUDIT',
        {
          targetProfileId: A,
          performedBy: TEST_OPERATION_CONTEXT.profileId,
          before: BEFORE,
          after: QUOTAS,
        },
      ],
    ]);
  });

  it('should log a batch summary with zero failures when every update succeeds', async () => {
    await BatchUpdateProfileQuotasOperation({ profileIds: [A, B], ...QUOTAS }, TEST_OPERATION_CONTEXT);

    expect(logger.info).toHaveBeenCalledWith('Batch profile quota update complete', {
      action: 'QUOTA_BATCH_UPDATE',
      performedBy: TEST_OPERATION_CONTEXT.profileId,
      ...QUOTAS,
      updated: 2,
      failed: 0,
    });
  });

  it('should log one batch summary with the applied values and counts', async () => {
    vi.mocked(profileDao.load).mockImplementation(async ({ profileId }) => {
      if (profileId === C) {
        throw new NotFoundError({ message: 'Item not found.' });
      }
      return { ...TEST_PROFILE_ITEM, ...BEFORE, profileId };
    });

    await BatchUpdateProfileQuotasOperation({ profileIds: [A, B, C], ...QUOTAS }, TEST_OPERATION_CONTEXT);

    expect(logger.info).toHaveBeenCalledWith('Batch profile quota update complete', {
      action: 'QUOTA_BATCH_UPDATE',
      performedBy: TEST_OPERATION_CONTEXT.profileId,
      ...QUOTAS,
      updated: 2,
      failed: 1,
    });
  });

  it('should update 25 profiles in input order and write one audit entry for each', async () => {
    const profileIds = makeProfileIds(25);

    const output = await BatchUpdateProfileQuotasOperation({ profileIds, ...QUOTAS }, TEST_OPERATION_CONTEXT);

    expect(output.updatedProfileIds).toEqual(profileIds);
    expect(output.errors).toEqual([]);
    expect(profileDao.update).toHaveBeenCalledTimes(25);
    expect(
      auditCalls()
        .map(([, audit]) => (audit as { targetProfileId: string }).targetProfileId)
        .sort(),
    ).toEqual([...profileIds].sort());
  });

  it('should run 10 updates at a time and never more', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(profileDao.update).mockImplementation(async ({ profileId }, attributes) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return { ...TEST_PROFILE_ITEM, ...attributes, profileId };
    });

    await BatchUpdateProfileQuotasOperation({ profileIds: makeProfileIds(25), ...QUOTAS }, TEST_OPERATION_CONTEXT);

    expect(maxInFlight).toBe(10);
    expect(profileDao.update).toHaveBeenCalledTimes(25);
  });

  it('should keep going after failures in an earlier chunk and return results in input order', async () => {
    const profileIds = makeProfileIds(15);
    const [missing, brokenWrite] = [profileIds[2], profileIds[12]];
    vi.mocked(profileDao.load).mockImplementation(async ({ profileId }) => {
      if (profileId === missing) {
        throw new NotFoundError({ message: 'Item not found.' });
      }
      return { ...TEST_PROFILE_ITEM, ...BEFORE, profileId };
    });
    vi.mocked(profileDao.update).mockImplementation(async ({ profileId }, attributes) => {
      if (profileId === brokenWrite) {
        throw new Error('write failed');
      }
      return { ...TEST_PROFILE_ITEM, ...attributes, profileId };
    });

    const output = await BatchUpdateProfileQuotasOperation({ profileIds, ...QUOTAS }, TEST_OPERATION_CONTEXT);

    expect(output.updatedProfileIds).toEqual(profileIds.filter((id) => id !== missing && id !== brokenWrite));
    expect(output.errors).toEqual([
      { profileId: missing, code: 'NotFoundError', message: 'Profile not found.' },
      { profileId: brokenWrite, code: 'Error', message: 'Failed to update the profile quotas.' },
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      'Batch profile quota update complete',
      expect.objectContaining({ updated: 13, failed: 2 }),
    );
  });

  describe('request validation', () => {
    const sendRequest = (profileIds: string[]) =>
      getBatchUpdateProfileQuotasHandler(BatchUpdateProfileQuotasOperation).handle(
        new HttpRequest({
          method: 'POST',
          path: '/profiles/batch-update-quotas',
          headers: { 'content-type': 'application/json' },
          // The generated handler reads the body as bytes, as it arrives from API Gateway.
          body: Buffer.from(JSON.stringify({ profileIds, ...QUOTAS })),
        }),
        TEST_OPERATION_CONTEXT,
      );

    it('should accept 200 profile IDs and update every profile', async () => {
      const response = await sendRequest(makeProfileIds(200));

      expect(response.statusCode).toBe(200);
      expect(profileDao.update).toHaveBeenCalledTimes(200);
    });

    it('should reject 201 profile IDs with a 400 and update no profile', async () => {
      const response = await sendRequest(makeProfileIds(201));

      expect(response.statusCode).toBe(400);
      expect(response.headers['x-amzn-errortype']).toBe('ValidationException');
      expect(JSON.parse(Buffer.from(response.body).toString()).fieldList).toEqual([
        expect.objectContaining({ path: '/profileIds' }),
      ]);
      expect(profileDao.update).not.toHaveBeenCalled();
    });
  });
});
