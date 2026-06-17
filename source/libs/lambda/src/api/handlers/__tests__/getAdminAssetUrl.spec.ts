// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  TEST_MODEL_ITEM,
  TEST_PROFILE_ID_2,
  TEST_PROFILE_ITEM,
  TEST_MODEL_ID_1,
  modelDao,
  profileDao,
} from '@deepracer-indy/database';
import { ModelStatus, NotAuthorizedError, NotFoundError, UserGroups } from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger, s3Helper } from '@deepracer-indy/utils';
import { assert, vi } from 'vitest';

import { cognitoClient } from '../../../utils/clients/cognitoClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetAdminAssetUrlOperation } from '../getAdminAssetUrl.js';

vi.mock('@deepracer-indy/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepracer-indy/database')>();
  return {
    ...actual,
    modelDao: { load: vi.fn() },
    profileDao: { load: vi.fn() },
  };
});

const mockModelDao = vi.mocked(modelDao);
const mockProfileDao = vi.mocked(profileDao);

const READY_MODEL = { ...TEST_MODEL_ITEM, status: ModelStatus.READY };
const INPUT = { modelId: TEST_MODEL_ID_1, profileId: TEST_PROFILE_ID_2 };
const MOCK_URL = 'https://mock-presigned-url';
const EXPECTED_FILENAME = `${TEST_PROFILE_ITEM.alias}_${TEST_MODEL_ITEM.name}.tar.gz`;

describe('GetAdminAssetUrl operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USER_POOL_ID = 'test-user-pool-id';
  });

  it('should throw NotAuthorizedError when caller is not admin or facilitator', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACERS }] }),
    );

    await expect(GetAdminAssetUrlOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new NotAuthorizedError({ message: 'Not authorized.' }),
    );
    expect(mockModelDao.load).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when model is not READY', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockModelDao.load.mockResolvedValue({ ...TEST_MODEL_ITEM, status: ModelStatus.TRAINING });

    await expect(GetAdminAssetUrlOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new NotFoundError({ message: 'Model is not ready for download.' }),
    );
    expect(mockProfileDao.load).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when model artifact is missing', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockModelDao.load.mockResolvedValue({
      ...READY_MODEL,
      assetS3Locations: { ...READY_MODEL.assetS3Locations, modelArtifactS3Location: undefined },
    });

    await expect(GetAdminAssetUrlOperation(INPUT, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      new NotFoundError({ message: 'Unable to find physical model artifact.' }),
    );
  });

  it('should return url and filename on success', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockModelDao.load.mockResolvedValue(READY_MODEL);
    mockProfileDao.load.mockResolvedValue(TEST_PROFILE_ITEM);
    vi.spyOn(s3Helper, 'getPresignedUrl').mockResolvedValue(MOCK_URL);
    const logDownloadSpy = vi.spyOn(metricsLogger, 'logDownloadModel');

    const result = await GetAdminAssetUrlOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(result.url).toBe(MOCK_URL);
    expect(result.filename).toBe(EXPECTED_FILENAME);
    expect(s3Helper.getPresignedUrl).toHaveBeenCalledWith(
      READY_MODEL.assetS3Locations.modelArtifactS3Location,
      300,
      EXPECTED_FILENAME,
    );
    expect(logDownloadSpy).toHaveBeenCalledWith({ modelId: TEST_MODEL_ID_1 });
  });

  it('should emit audit log with correct fields and not log the url', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.ADMIN }] }),
    );
    mockModelDao.load.mockResolvedValue(READY_MODEL);
    mockProfileDao.load.mockResolvedValue(TEST_PROFILE_ITEM);
    vi.spyOn(s3Helper, 'getPresignedUrl').mockResolvedValue(MOCK_URL);
    const logSpy = vi.spyOn(logger, 'info');

    await GetAdminAssetUrlOperation(INPUT, TEST_OPERATION_CONTEXT);

    const auditCall = logSpy.mock.calls.find(
      ([, fields]) => (fields as Record<string, string>)?.action === 'ADMIN_MODEL_DOWNLOAD',
    );
    // assert will narrow the type so `auditCall` will not be able to be undefined
    assert(auditCall !== undefined);
    const fields = auditCall[1] as Record<string, string>;
    expect(fields.adminProfileId).toBe(TEST_OPERATION_CONTEXT.profileId);
    expect(fields.targetProfileId).toBe(TEST_PROFILE_ID_2);
    expect(fields.modelId).toBe(TEST_MODEL_ID_1);
    expect(fields.modelName).toBe(TEST_MODEL_ITEM.name);
    expect(fields.targetAlias).toBe(TEST_PROFILE_ITEM.alias);
    // URL must not appear in any log call
    logSpy.mock.calls.forEach(([msg, ...rest]) => {
      expect(JSON.stringify([msg, ...rest])).not.toContain(MOCK_URL);
    });
  });

  it('should work for race facilitator caller', async () => {
    vi.spyOn(cognitoClient, 'send').mockImplementation(() =>
      Promise.resolve({ Groups: [{ GroupName: UserGroups.RACE_FACILITATORS }] }),
    );
    mockModelDao.load.mockResolvedValue(READY_MODEL);
    mockProfileDao.load.mockResolvedValue(TEST_PROFILE_ITEM);
    vi.spyOn(s3Helper, 'getPresignedUrl').mockResolvedValue(MOCK_URL);

    const result = await GetAdminAssetUrlOperation(INPUT, TEST_OPERATION_CONTEXT);

    expect(result.url).toBe(MOCK_URL);
    expect(result.filename).toBe(EXPECTED_FILENAME);
  });
});
