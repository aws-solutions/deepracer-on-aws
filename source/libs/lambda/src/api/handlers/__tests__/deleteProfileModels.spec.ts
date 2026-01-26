// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourceId } from '@deepracer-indy/database';
import { logger, metricsLogger } from '@deepracer-indy/utils';

import { deleteModelsForProfile } from '../../../utils/deleteModelsForProfile.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { DeleteProfileModelsOperation } from '../deleteProfileModels.js';

vi.mock('#utils/deleteModelsForProfile.js');

describe('DeleteProfileModels operation', () => {
  const mockDeleteModelsForProfile = vi.mocked(deleteModelsForProfile);

  beforeEach(() => {
    mockDeleteModelsForProfile.mockResolvedValue();
    vi.spyOn(logger, 'info').mockImplementation(vi.fn());
    vi.spyOn(metricsLogger, 'logDeleteProfileModels').mockImplementation(() => undefined);
  });

  it('should delete models for specified profile', async () => {
    const targetProfileId = 'target-profile-id' as ResourceId;
    const input = { profileId: targetProfileId };
    const context = { ...TEST_OPERATION_CONTEXT, profileId: 'admin-profile-id' as ResourceId };

    const result = await DeleteProfileModelsOperation(input, context);

    expect(mockDeleteModelsForProfile).toHaveBeenCalledWith(targetProfileId);
    expect(metricsLogger.logDeleteProfileModels).toHaveBeenCalledWith();
    expect(logger.info).toHaveBeenCalledWith('Deleting all models for profile', { targetProfileId });
    expect(logger.info).toHaveBeenCalledWith('Deleted all models for profile', { targetProfileId });
    expect(result).toEqual({});
  });
});
