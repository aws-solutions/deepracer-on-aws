// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NotFoundError } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { globalSettingsHelper } from '../../../utils/GlobalSettingsHelper.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetGlobalSettingOperation } from '../getGlobalSetting.js';

vi.mock('#utils/GlobalSettingsHelper.js', () => ({
  globalSettingsHelper: {
    getGlobalSetting: vi.fn(),
  },
}));

vi.mock('@deepracer-indy/utils', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
  logMethod: vi
    .fn()
    .mockImplementation(() => (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => descriptor),
  tracer: {
    captureAWSv3Client: vi.fn().mockImplementation((client) => client),
  },
  metrics: {
    logMetrics: vi.fn(),
  },
}));

describe('GetGlobalSetting operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return the global setting value when it exists', async () => {
    const testKey = 'testKey';
    const testValue = 'testValue';
    (globalSettingsHelper.getGlobalSetting as ReturnType<typeof vi.fn>).mockResolvedValue(testValue);

    const result = await GetGlobalSettingOperation({ key: testKey }, TEST_OPERATION_CONTEXT);

    expect(result).toEqual({ value: testValue });
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledWith(testKey);
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledTimes(1);
  });

  it('should return a nested global setting value when it exists', async () => {
    const testKey = 'nested.key';
    const testValue = { nestedProperty: 'nestedValue' };
    (globalSettingsHelper.getGlobalSetting as ReturnType<typeof vi.fn>).mockResolvedValue(testValue);

    const result = await GetGlobalSettingOperation({ key: testKey }, TEST_OPERATION_CONTEXT);

    expect(result).toEqual({ value: testValue });
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledWith(testKey);
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledTimes(1);
  });

  it('should return a numeric global setting value when it exists', async () => {
    const testKey = 'numericKey';
    const testValue = 42;
    (globalSettingsHelper.getGlobalSetting as ReturnType<typeof vi.fn>).mockResolvedValue(testValue);

    const result = await GetGlobalSettingOperation({ key: testKey }, TEST_OPERATION_CONTEXT);

    expect(result).toEqual({ value: testValue });
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledWith(testKey);
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledTimes(1);
  });

  it('should return a boolean global setting value when it exists', async () => {
    const testKey = 'booleanKey';
    const testValue = true;
    (globalSettingsHelper.getGlobalSetting as ReturnType<typeof vi.fn>).mockResolvedValue(testValue);

    const result = await GetGlobalSettingOperation({ key: testKey }, TEST_OPERATION_CONTEXT);

    expect(result).toEqual({ value: testValue });
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledWith(testKey);
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledTimes(1);
  });

  it('should return an array global setting value when it exists', async () => {
    const testKey = 'arrayKey';
    const testValue = [1, 2, 3];
    (globalSettingsHelper.getGlobalSetting as ReturnType<typeof vi.fn>).mockResolvedValue(testValue);

    const result = await GetGlobalSettingOperation({ key: testKey }, TEST_OPERATION_CONTEXT);

    expect(result).toEqual({ value: testValue });
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledWith(testKey);
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundError when the global setting does not exist', async () => {
    const testKey = 'nonExistentKey';
    const notFoundError = new NotFoundError({ message: `Key '${testKey}' not found in the provided object` });
    (globalSettingsHelper.getGlobalSetting as ReturnType<typeof vi.fn>).mockRejectedValue(notFoundError);

    await expect(GetGlobalSettingOperation({ key: testKey }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      'Failed to retrieve global setting for provided key.',
    );
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledWith(testKey);
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`Error fetching global setting: ${notFoundError}`);
  });

  it('should throw an error when there is an internal error', async () => {
    const testKey = 'testKey';
    const internalError = new Error('Internal error');
    (globalSettingsHelper.getGlobalSetting as ReturnType<typeof vi.fn>).mockRejectedValue(internalError);

    await expect(GetGlobalSettingOperation({ key: testKey }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      'Failed to retrieve global setting for provided key.',
    );
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledWith(testKey);
    expect(globalSettingsHelper.getGlobalSetting).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`Error fetching global setting: ${internalError}`);
  });
});
