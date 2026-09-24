// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NotAuthorizedError } from '@deepracer-indy/typescript-server-client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { globalSettingsHelper } from '../../../utils/GlobalSettingsHelper.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { UpdateGlobalSettingOperation } from '../updateGlobalSetting.js';

vi.mock('#utils/GlobalSettingsHelper.js', () => ({
  globalSettingsHelper: {
    setGlobalSetting: vi.fn(),
  },
}));

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);

describe('UpdateGlobalSetting operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUserAdmin.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should throw NotAuthorizedError when caller is not an administrator', async () => {
    mockIsUserAdmin.mockResolvedValue(false);

    await expect(
      UpdateGlobalSettingOperation({ key: 'registration.type', value: 'invite-only' }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotAuthorizedError);
    expect(globalSettingsHelper.setGlobalSetting).not.toHaveBeenCalled();
  });

  it('should update a registration type value', async () => {
    const testKey = 'registration.type';
    const testValue = 'invite-only';
    (globalSettingsHelper.setGlobalSetting as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await UpdateGlobalSettingOperation({ key: testKey, value: testValue }, TEST_OPERATION_CONTEXT);

    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledWith(testKey, testValue);
    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledTimes(1);
  });

  it('should update a numeric quota value', async () => {
    const testKey = 'usageQuotas.global.globalComputeMinutesLimit';
    const testValue = 42;
    (globalSettingsHelper.setGlobalSetting as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await UpdateGlobalSettingOperation({ key: testKey, value: testValue }, TEST_OPERATION_CONTEXT);

    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledWith(testKey, testValue);
    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledTimes(1);
  });

  it('should update a complete registration object', async () => {
    const testKey = 'registration';
    const testValue = { type: 'self-service' };
    (globalSettingsHelper.setGlobalSetting as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await UpdateGlobalSettingOperation({ key: testKey, value: testValue }, TEST_OPERATION_CONTEXT);

    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledWith(testKey, testValue);
    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledTimes(1);
  });

  it('should update a complete usageQuotas object', async () => {
    const testKey = 'usageQuotas';
    const testValue = {
      global: {
        globalComputeMinutesLimit: -1,
        globalModelCountLimit: 10,
      },
      newUser: {
        newUserComputeMinutesLimit: 600,
        newUserModelCountLimit: 3,
      },
    };
    (globalSettingsHelper.setGlobalSetting as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await UpdateGlobalSettingOperation({ key: testKey, value: testValue }, TEST_OPERATION_CONTEXT);

    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledWith(testKey, testValue);
    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledTimes(1);
  });

  it('should update a newUser quota value', async () => {
    const testKey = 'usageQuotas.newUser.newUserModelCountLimit';
    const testValue = 5;
    (globalSettingsHelper.setGlobalSetting as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await UpdateGlobalSettingOperation({ key: testKey, value: testValue }, TEST_OPERATION_CONTEXT);

    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledWith(testKey, testValue);
    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledTimes(1);
  });

  it('should update a global quota object', async () => {
    const testKey = 'usageQuotas.global';
    const testValue = {
      globalComputeMinutesLimit: 1200,
      globalModelCountLimit: 20,
    };
    (globalSettingsHelper.setGlobalSetting as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await UpdateGlobalSettingOperation({ key: testKey, value: testValue }, TEST_OPERATION_CONTEXT);

    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledWith(testKey, testValue);
    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledTimes(1);
  });

  it('should throw an error when the update fails', async () => {
    const testKey = 'registration.type';
    const testValue = 'invite-only';
    const error = new Error('Update failed');
    (globalSettingsHelper.setGlobalSetting as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    await expect(
      UpdateGlobalSettingOperation({ key: testKey, value: testValue }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow('Failed to update setting');
    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledWith(testKey, testValue);
    expect(globalSettingsHelper.setGlobalSetting).toHaveBeenCalledTimes(1);
  });

  it('should throw an error when validation fails for invalid keys', async () => {
    const testKey = 'invalidKey';
    const testValue = 'testValue';

    await expect(
      UpdateGlobalSettingOperation({ key: testKey, value: testValue }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow('Invalid request structure');
    expect(globalSettingsHelper.setGlobalSetting).not.toHaveBeenCalled();
  });

  it('should throw an error when validation fails for invalid values', async () => {
    const testKey = 'registration.type';
    const testValue = 'invalidType';

    await expect(
      UpdateGlobalSettingOperation({ key: testKey, value: testValue }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow('Invalid request structure');
    expect(globalSettingsHelper.setGlobalSetting).not.toHaveBeenCalled();
  });
});
