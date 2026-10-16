// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { profileDao, ResourceId, TEST_ITEM_NOT_FOUND_ERROR, TEST_PROFILE_ITEM } from '@deepracer-indy/database';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { globalSettingsHelper } from '../../../utils/GlobalSettingsHelper.js';
import { GetProfileOperation } from '../getProfile.js';

// Matches EXTERNAL_IDP_NAME in cognito/handlers/common/constants.ts, lowercased to mirror
// Cognito's actual stored username (the user pool has signInCaseSensitive: false).
const FEDERATED_CONTEXT = {
  ...TEST_OPERATION_CONTEXT,
  profileId: 'externalidp_01a2b3c4-d5e6-f7g8-h9i0' as ResourceId,
};

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

  it('creates a fallback profile with a blank alias when a federated profile does not exist', async () => {
    vi.spyOn(profileDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);
    vi.spyOn(globalSettingsHelper, 'getGlobalSetting').mockResolvedValueOnce({
      newUserComputeMinutesLimit: 240,
      newUserModelCountLimit: 10,
    });
    const createSpy = vi.spyOn(profileDao, 'create').mockResolvedValue(TEST_PROFILE_ITEM);

    const output = await GetProfileOperation({}, FEDERATED_CONTEXT);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: FEDERATED_CONTEXT.profileId,
        alias: '',
        maxTotalComputeMinutes: 240,
        maxModelCount: 10,
      }),
    );
    expect(output.profile).toBeDefined();
  });

  it('propagates non-NotFoundError failures without falling back', async () => {
    const unexpectedError = new Error('unexpected failure');
    vi.spyOn(profileDao, 'load').mockRejectedValueOnce(unexpectedError);

    return expect(GetProfileOperation({}, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(unexpectedError);
  });

  it('propagates NotFoundError for a non-federated (native) profile instead of fabricating one', async () => {
    vi.spyOn(profileDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);
    const createSpy = vi.spyOn(profileDao, 'create');

    await expect(GetProfileOperation({}, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(TEST_ITEM_NOT_FOUND_ERROR);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('throws instead of defaulting quotas to 0 when global settings are missing required fields', async () => {
    vi.spyOn(profileDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR);
    vi.spyOn(globalSettingsHelper, 'getGlobalSetting').mockResolvedValueOnce({ newUserComputeMinutesLimit: 240 });
    const createSpy = vi.spyOn(profileDao, 'create');

    await expect(GetProfileOperation({}, FEDERATED_CONTEXT)).rejects.toThrow(/missing usageQuotas.newUser/);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('loads the existing profile instead of throwing when two federated fallback-creates race', async () => {
    vi.spyOn(profileDao, 'load').mockRejectedValueOnce(TEST_ITEM_NOT_FOUND_ERROR).mockResolvedValueOnce(TEST_PROFILE_ITEM);
    vi.spyOn(globalSettingsHelper, 'getGlobalSetting').mockResolvedValueOnce({
      newUserComputeMinutesLimit: 240,
      newUserModelCountLimit: 10,
    });
    const conditionalCheckError = new Error('The conditional request failed');
    conditionalCheckError.name = 'ConditionalCheckFailedException';
    vi.spyOn(profileDao, 'create').mockRejectedValueOnce(conditionalCheckError);

    const output = await GetProfileOperation({}, FEDERATED_CONTEXT);

    expect(output.profile.profileId).toEqual(TEST_PROFILE_ITEM.profileId);
  });
});
