// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NotAuthorizedError } from '@deepracer-indy/typescript-server-client';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import { deleteModelsForProfile } from '../../../utils/deleteModelsForProfile.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { DeleteProfileModelsOperation } from '../deleteProfileModels.js';

vi.mock('#utils/deleteModelsForProfile.js');

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);

describe('DeleteProfileModels operation', () => {
  const mockDeleteModelsForProfile = vi.mocked(deleteModelsForProfile);

  beforeEach(() => {
    mockDeleteModelsForProfile.mockResolvedValue();
    mockIsUserAdmin.mockResolvedValue(true);
    vi.spyOn(logger, 'info').mockImplementation(vi.fn());
    vi.spyOn(logger, 'warn').mockImplementation(vi.fn());
    vi.spyOn(metricsLogger, 'logDeleteProfileModels').mockImplementation(() => undefined);
  });

  it('should throw NotAuthorizedError when caller is not an administrator', async () => {
    mockIsUserAdmin.mockResolvedValue(false);
    const input = { profileId: 'target-profile-id' };

    await expect(DeleteProfileModelsOperation(input, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
    expect(mockDeleteModelsForProfile).not.toHaveBeenCalled();
  });

  it('should delete models for specified profile when caller is admin', async () => {
    const targetProfileId = 'target-profile-id';
    const input = { profileId: targetProfileId };

    const result = await DeleteProfileModelsOperation(input, TEST_OPERATION_CONTEXT);

    expect(mockDeleteModelsForProfile).toHaveBeenCalledWith(targetProfileId);
    expect(metricsLogger.logDeleteProfileModels).toHaveBeenCalledWith();
    expect(logger.info).toHaveBeenCalledWith('Deleting all models for profile', { targetProfileId });
    expect(logger.info).toHaveBeenCalledWith('Deleted all models for profile', { targetProfileId });
    expect(result).toEqual({});
  });
});
