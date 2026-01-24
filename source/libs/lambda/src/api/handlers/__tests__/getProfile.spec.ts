// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { profileDao, TEST_ITEM_NOT_FOUND_ERROR, TEST_PROFILE_ITEM } from '@deepracer-indy/database';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetProfileOperation } from '../getProfile.js';

describe('GetProfile operation', () => {
  it('should return profile in response', async () => {
    vi.spyOn(profileDao, 'load').mockResolvedValue(TEST_PROFILE_ITEM);

    const output = await GetProfileOperation({}, TEST_OPERATION_CONTEXT);

    expect(output.profile).toBeDefined();
    expect(output.profile.profileId).toEqual(TEST_PROFILE_ITEM.profileId);
    expect(output.profile.alias).toEqual(TEST_PROFILE_ITEM.alias);
    expect(output.profile.avatar).toEqual(TEST_PROFILE_ITEM.avatar);
    expect(output.profile.emailAddress).toEqual(TEST_PROFILE_ITEM.emailAddress);
    expect(output.profile.computeMinutesUsed).toEqual(TEST_PROFILE_ITEM.computeMinutesUsed);
    expect(output.profile.computeMinutesQueued).toEqual(TEST_PROFILE_ITEM.computeMinutesQueued);
    expect(output.profile.maxTotalComputeMinutes).toEqual(TEST_PROFILE_ITEM.maxTotalComputeMinutes);
    expect(output.profile.modelCount).toEqual(TEST_PROFILE_ITEM.modelCount);
    expect(output.profile.maxModelCount).toEqual(TEST_PROFILE_ITEM.maxModelCount);
  });

  it('should throw error if profile does not exist', async () => {
    vi.spyOn(profileDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);

    return expect(GetProfileOperation({}, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
  });
});
