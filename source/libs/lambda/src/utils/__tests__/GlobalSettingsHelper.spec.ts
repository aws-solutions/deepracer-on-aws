// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NotFoundError } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { appConfigServiceHelper } from '../../appconfig/AppConfigServiceHelper.js';
import { globalSettingsHelper } from '../GlobalSettingsHelper.js';

vi.mock('#appconfig/AppConfigServiceHelper.js', () => ({
  appConfigServiceHelper: {
    getConfiguration: vi.fn(),
    updateConfiguration: vi.fn(),
  },
}));

vi.mock('@deepracer-indy/utils', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GlobalSettingsHelper', () => {
  const mockConfiguration = new Uint8Array(
    Buffer.from(
      JSON.stringify({
        simple: 'value',
        nested: {
          key: 'nestedValue',
          deep: {
            key: 'deepValue',
          },
        },
        array: [1, 2, 3],
      }),
    ),
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getGlobalSetting', () => {
    it('should get a simple setting value', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);

      const result = await globalSettingsHelper.getGlobalSetting('simple');
      expect(result).toBe('value');
      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should get a nested setting value', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);

      const result = await globalSettingsHelper.getGlobalSetting('nested.key');
      expect(result).toBe('nestedValue');
      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should get a deeply nested setting value', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);

      const result = await globalSettingsHelper.getGlobalSetting('nested.deep.key');
      expect(result).toBe('deepValue');
      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should get an array setting value', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);

      const result = await globalSettingsHelper.getGlobalSetting('array');
      expect(result).toEqual([1, 2, 3]);
      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundError when setting does not exist', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);

      await expect(globalSettingsHelper.getGlobalSetting('nonexistent')).rejects.toThrow(NotFoundError);
      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundError when nested setting does not exist', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);

      await expect(globalSettingsHelper.getGlobalSetting('nested.nonexistent')).rejects.toThrow(NotFoundError);
      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundError when trying to access a property of a non-object', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);

      await expect(globalSettingsHelper.getGlobalSetting('simple.nonexistent')).rejects.toThrow(NotFoundError);
      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
    });
  });

  describe('setGlobalSetting', () => {
    it('should set a simple setting value', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);
      (appConfigServiceHelper.updateConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await globalSettingsHelper.setGlobalSetting('simple', 'newValue');

      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
      expect(appConfigServiceHelper.updateConfiguration).toHaveBeenCalledTimes(1);
      expect(appConfigServiceHelper.updateConfiguration).toHaveBeenCalledWith(
        JSON.stringify({
          simple: 'newValue',
          nested: {
            key: 'nestedValue',
            deep: {
              key: 'deepValue',
            },
          },
          array: [1, 2, 3],
        }),
      );
      expect(logger.info).toHaveBeenCalledWith('SetGlobalSetting output: Updated key: simple with value: "newValue"');
    });

    it('should set a nested setting value', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);
      (appConfigServiceHelper.updateConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await globalSettingsHelper.setGlobalSetting('nested.key', 'newNestedValue');

      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
      expect(appConfigServiceHelper.updateConfiguration).toHaveBeenCalledTimes(1);
      expect(appConfigServiceHelper.updateConfiguration).toHaveBeenCalledWith(
        JSON.stringify({
          simple: 'value',
          nested: {
            key: 'newNestedValue',
            deep: {
              key: 'deepValue',
            },
          },
          array: [1, 2, 3],
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'SetGlobalSetting output: Updated key: nested.key with value: "newNestedValue"',
      );
    });

    it('should create a new nested setting if it does not exist', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);
      (appConfigServiceHelper.updateConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await globalSettingsHelper.setGlobalSetting('nested.newKey', 'brandNewValue');

      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
      expect(appConfigServiceHelper.updateConfiguration).toHaveBeenCalledTimes(1);
      expect(appConfigServiceHelper.updateConfiguration).toHaveBeenCalledWith(
        JSON.stringify({
          simple: 'value',
          nested: {
            key: 'nestedValue',
            deep: {
              key: 'deepValue',
            },
            newKey: 'brandNewValue',
          },
          array: [1, 2, 3],
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'SetGlobalSetting input: Setting key: nested.newKey with value: "brandNewValue"',
      );
    });

    it('should create a new deeply nested setting path if it does not exist', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);
      (appConfigServiceHelper.updateConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await globalSettingsHelper.setGlobalSetting('new.path.to.value', 'newPathValue');

      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
      expect(appConfigServiceHelper.updateConfiguration).toHaveBeenCalledTimes(1);
      expect(appConfigServiceHelper.updateConfiguration).toHaveBeenCalledWith(
        expect.stringContaining('"new":{"path":{"to":{"value":"newPathValue"}}}'),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'SetNestedValue input: Setting nested value for key: new.path.to.value with value: "newPathValue"',
      );
    });

    it('should throw an error when updateConfiguration fails', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);
      (appConfigServiceHelper.updateConfiguration as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(globalSettingsHelper.setGlobalSetting('simple', 'newValue')).rejects.toThrow(
        'An error occurred while updating the provided setting.',
      );
      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
      expect(appConfigServiceHelper.updateConfiguration).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('Error updating setting', { err: expect.any(Error) });
    });

    it('should throw an error when trying to set a nested property on a non-object', async () => {
      (appConfigServiceHelper.getConfiguration as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfiguration);

      await expect(globalSettingsHelper.setGlobalSetting('simple.nonexistent', 'value')).rejects.toThrow();
      expect(appConfigServiceHelper.getConfiguration).toHaveBeenCalledTimes(1);
      expect(appConfigServiceHelper.updateConfiguration).not.toHaveBeenCalled();
    });
  });

  describe('decodeConfigurationContent', () => {
    it('should decode configuration content from Uint8Array to DocumentType', () => {
      const content = new Uint8Array(Buffer.from(JSON.stringify({ key: 'value' })));
      const result = globalSettingsHelper.decodeConfigurationContent(content);
      expect(result).toEqual({ key: 'value' });
    });

    it('should handle complex JSON structures', () => {
      const complexObject = {
        string: 'value',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        nested: {
          key: 'nestedValue',
        },
      };
      const content = new Uint8Array(Buffer.from(JSON.stringify(complexObject)));
      const result = globalSettingsHelper.decodeConfigurationContent(content);
      expect(result).toEqual(complexObject);
    });
  });

  describe('getNestedValue', () => {
    it('should get a top-level value', () => {
      const obj = { key: 'value', nested: { key: 'nestedValue' } };
      const result = globalSettingsHelper.getNestedValue('key', obj);
      expect(result).toBe('value');
    });

    it('should get a nested value', () => {
      const obj = { key: 'value', nested: { key: 'nestedValue' } };
      const result = globalSettingsHelper.getNestedValue('nested.key', obj);
      expect(result).toBe('nestedValue');
    });

    it('should get a deeply nested value', () => {
      const obj = { key: 'value', nested: { deep: { key: 'deepValue' } } };
      const result = globalSettingsHelper.getNestedValue('nested.deep.key', obj);
      expect(result).toBe('deepValue');
    });

    it('should throw NotFoundError when key does not exist', () => {
      const obj = { key: 'value' };
      expect(() => globalSettingsHelper.getNestedValue('nonexistent', obj)).toThrow(NotFoundError);
    });

    it('should throw NotFoundError when nested key does not exist', () => {
      const obj = { key: 'value', nested: { key: 'nestedValue' } };
      expect(() => globalSettingsHelper.getNestedValue('nested.nonexistent', obj)).toThrow(NotFoundError);
    });

    it('should throw NotFoundError when trying to access a property of a non-object', () => {
      const obj = { key: 'value', nested: { key: 'nestedValue' } };
      expect(() => globalSettingsHelper.getNestedValue('key.nonexistent', obj)).toThrow(NotFoundError);
    });
  });

  describe('setNestedValue', () => {
    it('should set a top-level value', () => {
      const obj = { key: 'value' };
      const result = globalSettingsHelper.setNestedValue('key', 'newValue', obj);
      expect(result).toEqual({ key: 'newValue' });
    });

    it('should set a nested value', () => {
      const obj = { key: 'value', nested: { key: 'nestedValue' } };
      const result = globalSettingsHelper.setNestedValue('nested.key', 'newNestedValue', obj);
      expect(result).toEqual({ key: 'value', nested: { key: 'newNestedValue' } });
    });

    it('should set a deeply nested value', () => {
      const obj = { key: 'value', nested: { deep: { key: 'deepValue' } } };
      const result = globalSettingsHelper.setNestedValue('nested.deep.key', 'newDeepValue', obj);
      expect(result).toEqual({ key: 'value', nested: { deep: { key: 'newDeepValue' } } });
    });

    it('should create a new top-level property if it does not exist', () => {
      const obj = { key: 'value' };
      const result = globalSettingsHelper.setNestedValue('newKey', 'newValue', obj);
      expect(result).toEqual({ key: 'value', newKey: 'newValue' });
    });

    it('should create a new nested property if it does not exist', () => {
      const obj = { key: 'value', nested: { key: 'nestedValue' } };
      const result = globalSettingsHelper.setNestedValue('nested.newKey', 'newNestedValue', obj);
      expect(result).toEqual({ key: 'value', nested: { key: 'nestedValue', newKey: 'newNestedValue' } });
    });

    it('should create a new nested path if it does not exist', () => {
      const obj = { key: 'value' };
      const result = globalSettingsHelper.setNestedValue('new.path.to.value', 'newPathValue', obj);
      expect(result).toEqual({
        key: 'value',
        new: {
          path: {
            to: {
              value: 'newPathValue',
            },
          },
        },
      });
    });

    it('should handle array values', () => {
      const obj = { key: 'value', array: [1, 2, 3] };
      const result = globalSettingsHelper.setNestedValue('array', [4, 5, 6], obj);
      expect(result).toEqual({ key: 'value', array: [4, 5, 6] });
    });

    it('should handle object values', () => {
      const obj = { key: 'value' };
      const result = globalSettingsHelper.setNestedValue('newObj', { a: 1, b: 2 }, obj);
      expect(result).toEqual({ key: 'value', newObj: { a: 1, b: 2 } });
    });

    it('should throw an error when trying to set a nested property on a non-object (null)', () => {
      const obj = { key: null };
      expect(() => globalSettingsHelper.setNestedValue('key.nested', 'value', obj)).toThrow();
    });

    it('should throw an error when trying to set a nested property on a non-object (array)', () => {
      const obj = { key: [] };
      expect(() => globalSettingsHelper.setNestedValue('key.nested', 'value', obj)).toThrow();
    });

    it('should throw an error when trying to set a nested property on a primitive', () => {
      const obj = { key: 123 };
      expect(() => globalSettingsHelper.setNestedValue('key.nested', 'value', obj)).toThrow();
    });

    it('should throw an error if the root object is not an object', () => {
      expect(() => globalSettingsHelper.setNestedValue('key', 'value', null)).toThrow();
    });
  });
});
