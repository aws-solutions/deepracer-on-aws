// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';

import { ImportModelFormValues } from '#pages/ImportModel/types';

import { validateInputs } from '../validation';

vi.mock('react-i18next', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'validation:required': 'Model name is required',
      'importModel:validation.modelNameSpecialCharsAndLength':
        'Model name has one or more non-allowed characters, or is greater than 64 characters in length',
      'importModel:validation.modelDescSpecialCharsAndLength':
        'Model description has one or more non-allowed characters, or is greater than 255 characters in length',
    };
    return translations[key] || key;
  },
}));

describe('validateInputs', () => {
  describe('modelName validation', () => {
    it('should return error when modelName is empty string', () => {
      const values: ImportModelFormValues = {
        modelName: '',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toEqual({
        type: 'required',
        message: 'Model name is required',
      });
    });

    it('should return error when modelName is undefined', () => {
      const values: ImportModelFormValues = {
        modelName: undefined as never,
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toEqual({
        type: 'required',
        message: 'Model name is required',
      });
    });

    it('should return error when modelName contains invalid characters', () => {
      const values: ImportModelFormValues = {
        modelName: 'invalid@name!',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toEqual({
        type: 'required',
        message: 'Model name has one or more non-allowed characters, or is greater than 64 characters in length',
      });
    });

    it('should return error when modelName contains spaces', () => {
      const values: ImportModelFormValues = {
        modelName: 'my model name',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toEqual({
        type: 'required',
        message: 'Model name has one or more non-allowed characters, or is greater than 64 characters in length',
      });
    });

    it('should return error when modelName is too long (>= 64 characters)', () => {
      const values: ImportModelFormValues = {
        modelName: 'a'.repeat(66),
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toEqual({
        type: 'required',
        message: 'Model name has one or more non-allowed characters, or is greater than 64 characters in length',
      });
    });

    it('should return error when modelName is much too long', () => {
      const values: ImportModelFormValues = {
        modelName: 'a'.repeat(100),
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toEqual({
        type: 'required',
        message: 'Model name has one or more non-allowed characters, or is greater than 64 characters in length',
      });
    });

    it('should pass when modelName is valid with letters only', () => {
      const values: ImportModelFormValues = {
        modelName: 'validModelName',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toBeUndefined();
    });

    it('should pass when modelName is valid with numbers', () => {
      const values: ImportModelFormValues = {
        modelName: 'validModel123',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toBeUndefined();
    });

    it('should pass when modelName is valid with hyphens', () => {
      const values: ImportModelFormValues = {
        modelName: 'valid-model-name',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toBeUndefined();
    });

    it('should pass when modelName is valid with mixed characters', () => {
      const values: ImportModelFormValues = {
        modelName: 'model-123-test',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toBeUndefined();
    });

    it('should pass when modelName is at maximum allowed length (63 characters)', () => {
      const values: ImportModelFormValues = {
        modelName: 'a'.repeat(63),
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toBeUndefined();
    });

    it('should pass when modelName is single character', () => {
      const values: ImportModelFormValues = {
        modelName: 'a',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toBeUndefined();
    });
  });

  describe('modelDescription validation', () => {
    it('should pass when modelDescription is undefined', () => {
      const values: ImportModelFormValues = {
        modelName: 'validModel',
        modelDescription: undefined,
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelDescription).toBeUndefined();
    });

    it('should pass when modelDescription is empty string', () => {
      const values: ImportModelFormValues = {
        modelName: 'validModel',
        modelDescription: '',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelDescription).toBeUndefined();
    });

    it('should return error when modelDescription contains invalid characters', () => {
      const values: ImportModelFormValues = {
        modelName: 'validModel',
        modelDescription: 'invalid@description!',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelDescription).toEqual({
        type: 'required',
        message:
          'Model description has one or more non-allowed characters, or is greater than 255 characters in length',
      });
    });

    it('should return error when modelDescription is too long (>= 255 characters)', () => {
      const values: ImportModelFormValues = {
        modelName: 'validModel',
        modelDescription: 'a'.repeat(257),
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelDescription).toEqual({
        type: 'required',
        message:
          'Model description has one or more non-allowed characters, or is greater than 255 characters in length',
      });
    });

    it('should return error when modelDescription is much too long', () => {
      const values: ImportModelFormValues = {
        modelName: 'validModel',
        modelDescription: 'a'.repeat(300),
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelDescription).toEqual({
        type: 'required',
        message:
          'Model description has one or more non-allowed characters, or is greater than 255 characters in length',
      });
    });

    it('should pass when modelDescription is valid with letters only', () => {
      const values: ImportModelFormValues = {
        modelName: 'validModel',
        modelDescription: 'validDescription',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelDescription).toBeUndefined();
    });

    it('should pass when modelDescription is valid with numbers', () => {
      const values: ImportModelFormValues = {
        modelName: 'validModel',
        modelDescription: 'description123',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelDescription).toBeUndefined();
    });

    it('should pass when modelDescription is valid with hyphens', () => {
      const values: ImportModelFormValues = {
        modelName: 'validModel',
        modelDescription: 'valid-description',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelDescription).toBeUndefined();
    });

    it('should pass when modelDescription is at maximum allowed length (254 characters)', () => {
      const values: ImportModelFormValues = {
        modelName: 'validModel',
        modelDescription: 'a'.repeat(254),
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelDescription).toBeUndefined();
    });
  });

  describe('combined validation scenarios', () => {
    it('should return errors for both modelName and modelDescription when both are invalid', () => {
      const values: ImportModelFormValues = {
        modelName: 'invalid@name!',
        modelDescription: 'invalid@description!',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toEqual({
        type: 'required',
        message: 'Model name has one or more non-allowed characters, or is greater than 64 characters in length',
      });
      expect(result.modelDescription).toEqual({
        type: 'required',
        message:
          'Model description has one or more non-allowed characters, or is greater than 255 characters in length',
      });
    });

    it('should return empty errors object when both modelName and modelDescription are valid', () => {
      const values: ImportModelFormValues = {
        modelName: 'valid-model-name',
        modelDescription: 'valid-description-123',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result).toEqual({});
    });

    it('should return empty errors object when modelName is valid and modelDescription is not provided', () => {
      const values: ImportModelFormValues = {
        modelName: 'valid-model-name',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result).toEqual({});
    });

    it('should prioritize required error over format error for modelName', () => {
      const values: ImportModelFormValues = {
        modelName: '',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toEqual({
        type: 'required',
        message: 'Model name is required',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null modelName', () => {
      const values: ImportModelFormValues = {
        modelName: null as never,
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toEqual({
        type: 'required',
        message: 'Model name is required',
      });
    });

    it('should handle whitespace-only modelName', () => {
      const values: ImportModelFormValues = {
        modelName: '   ',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toEqual({
        type: 'required',
        message: 'Model name has one or more non-allowed characters, or is greater than 64 characters in length',
      });
    });

    it('should handle special characters in modelName', () => {
      const specialChars = [
        '!',
        '@',
        '#',
        '$',
        '%',
        '^',
        '&',
        '*',
        '(',
        ')',
        '_',
        '+',
        '=',
        '[',
        ']',
        '{',
        '}',
        '|',
        '\\',
        ':',
        ';',
        '"',
        "'",
        '<',
        '>',
        ',',
        '.',
        '?',
        '/',
        '~',
        '`',
      ];

      specialChars.forEach((char) => {
        const values: ImportModelFormValues = {
          modelName: `model${char}name`,
          files: undefined,
        };

        const result = validateInputs(values);

        expect(result.modelName).toEqual({
          type: 'required',
          message: 'Model name has one or more non-allowed characters, or is greater than 64 characters in length',
        });
      });
    });

    it('should handle Unicode characters in modelName', () => {
      const values: ImportModelFormValues = {
        modelName: 'modelñame',
        files: undefined,
      };

      const result = validateInputs(values);

      expect(result.modelName).toEqual({
        type: 'required',
        message: 'Model name has one or more non-allowed characters, or is greater than 64 characters in length',
      });
    });
  });
});
