// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BadRequestError } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { globalSettingsValidator } from '../GlobalSettingsValidator.js';

describe('GlobalSettingsValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(logger, 'error').mockImplementation(() => {
      // Mock implementation
    });
  });

  describe('validateKeyPath', () => {
    it('should allow valid top-level keys', () => {
      expect(() => globalSettingsValidator.validateKeyPath('usageQuotas')).not.toThrow();
      expect(() => globalSettingsValidator.validateKeyPath('registration')).not.toThrow();
    });

    it('should reject invalid top-level keys', () => {
      expect(() => globalSettingsValidator.validateKeyPath('invalidKey')).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateKeyPath('database')).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateKeyPath('users')).toThrow(BadRequestError);
    });

    it('should allow valid usageQuotas paths', () => {
      expect(() => globalSettingsValidator.validateKeyPath('usageQuotas.global')).not.toThrow();
      expect(() => globalSettingsValidator.validateKeyPath('usageQuotas.newUser')).not.toThrow();
      expect(() =>
        globalSettingsValidator.validateKeyPath('usageQuotas.global.globalComputeMinutesLimit'),
      ).not.toThrow();
      expect(() => globalSettingsValidator.validateKeyPath('usageQuotas.newUser.newUserModelCountLimit')).not.toThrow();
    });

    it('should reject invalid usageQuotas paths', () => {
      expect(() => globalSettingsValidator.validateKeyPath('usageQuotas.invalid')).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateKeyPath('usageQuotas.global.invalidField')).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateKeyPath('usageQuotas.newUser.invalidField')).toThrow(
        BadRequestError,
      );
      expect(() =>
        globalSettingsValidator.validateKeyPath('usageQuotas.global.globalComputeMinutesLimit.tooDeep'),
      ).toThrow(BadRequestError);
    });

    it('should allow valid registration paths', () => {
      expect(() => globalSettingsValidator.validateKeyPath('registration.type')).not.toThrow();
    });

    it('should reject invalid registration paths', () => {
      expect(() => globalSettingsValidator.validateKeyPath('registration.invalidField')).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateKeyPath('registration.type.tooDeep')).toThrow(BadRequestError);
    });

    it('should reject empty keys', () => {
      expect(() => globalSettingsValidator.validateKeyPath('')).toThrow(BadRequestError);
    });
  });

  describe('validateValue', () => {
    it('should validate complete usageQuotas object', () => {
      const validUsageQuotas = {
        global: {
          globalComputeMinutesLimit: '-1',
          globalModelCountLimit: '10',
        },
        newUser: {
          newUserComputeMinutesLimit: '600',
          newUserModelCountLimit: '3',
        },
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas', validUsageQuotas)).not.toThrow();
    });

    it('should reject usageQuotas with missing keys', () => {
      const invalidUsageQuotas = {
        global: {
          globalComputeMinutesLimit: '-1',
          globalModelCountLimit: '10',
        },
        // missing newUser
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas', invalidUsageQuotas)).toThrow(BadRequestError);
    });

    it('should reject usageQuotas with extra keys', () => {
      const invalidUsageQuotas = {
        global: {
          globalComputeMinutesLimit: '-1',
          globalModelCountLimit: '10',
        },
        newUser: {
          newUserComputeMinutesLimit: '600',
          newUserModelCountLimit: '3',
        },
        extraKey: 'should not be allowed',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas', invalidUsageQuotas)).toThrow(BadRequestError);
    });

    it('should reject usageQuotas that is not an object', () => {
      expect(() => globalSettingsValidator.validateValue('usageQuotas', 'invalid string')).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('usageQuotas', 42)).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('usageQuotas', null)).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('usageQuotas', [])).toThrow(BadRequestError);
    });

    it('should validate individual quota fields', () => {
      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', '-1'),
      ).not.toThrow();
      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', '0'),
      ).not.toThrow();
      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', '100'),
      ).not.toThrow();
      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', -1),
      ).not.toThrow();
      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', '0'),
      ).not.toThrow();
      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', '100'),
      ).not.toThrow();
    });

    it('should reject non-numeric string quota values', () => {
      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', 'abc'),
      ).toThrow(BadRequestError);
      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', 'invalid'),
      ).toThrow(BadRequestError);
      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', '12.5.3'),
      ).toThrow(BadRequestError);
    });

    it('should reject non-integer quota values', () => {
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', 3.14)).toThrow(
        BadRequestError,
      );
      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', '3.14'),
      ).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', 0.5)).toThrow(
        BadRequestError,
      );
    });

    it('should reject quota values less than -1', () => {
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', -2)).toThrow(
        BadRequestError,
      );
      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', '-10'),
      ).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', -100)).toThrow(
        BadRequestError,
      );
    });

    it('should reject quota values that are not numbers or strings', () => {
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', true)).toThrow(
        BadRequestError,
      );
      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', false),
      ).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', {})).toThrow(
        BadRequestError,
      );
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', [])).toThrow(
        BadRequestError,
      );
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', null)).toThrow(
        BadRequestError,
      );
    });

    it('should validate global quotas object', () => {
      const validGlobalQuotas = {
        globalComputeMinutesLimit: '-1',
        globalModelCountLimit: '10',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', validGlobalQuotas)).not.toThrow();
    });

    it('should reject invalid global quotas object with extra keys', () => {
      const invalidGlobalQuotas = {
        globalComputeMinutesLimit: '-1',
        globalModelCountLimit: '10',
        extraKey: 'should not be allowed',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', invalidGlobalQuotas)).toThrow(
        BadRequestError,
      );
    });

    it('should reject global quotas that is not an object', () => {
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', 'invalid string')).toThrow(
        BadRequestError,
      );
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', 42)).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', null)).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', [])).toThrow(BadRequestError);
    });

    it('should reject global quotas with non-numeric field values', () => {
      const invalidGlobalQuotasWithBoolean = {
        globalComputeMinutesLimit: false,
        globalModelCountLimit: '10',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', invalidGlobalQuotasWithBoolean)).toThrow(
        BadRequestError,
      );

      const invalidGlobalQuotasWithObject = {
        globalComputeMinutesLimit: '-1',
        globalModelCountLimit: { value: 10 },
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', invalidGlobalQuotasWithObject)).toThrow(
        BadRequestError,
      );

      const invalidGlobalQuotasWithArray = {
        globalComputeMinutesLimit: [-1],
        globalModelCountLimit: '10',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', invalidGlobalQuotasWithArray)).toThrow(
        BadRequestError,
      );
    });

    it('should reject global quotas with missing required fields', () => {
      const globalQuotasMissingComputeLimit = {
        globalModelCountLimit: '10',
      };

      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.global', globalQuotasMissingComputeLimit),
      ).toThrow(BadRequestError);

      const globalQuotasMissingModelLimit = {
        globalComputeMinutesLimit: '-1',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', globalQuotasMissingModelLimit)).toThrow(
        BadRequestError,
      );

      const globalQuotasWithNullValues = {
        globalComputeMinutesLimit: null,
        globalModelCountLimit: null,
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', globalQuotasWithNullValues)).toThrow(
        BadRequestError,
      );
    });

    it('should validate newUser quotas object', () => {
      const validNewUserQuotas = {
        newUserComputeMinutesLimit: '600',
        newUserModelCountLimit: '3',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.newUser', validNewUserQuotas)).not.toThrow();
    });

    it('should reject invalid newUser quotas object with extra keys', () => {
      const invalidNewUserQuotas = {
        newUserComputeMinutesLimit: '600',
        newUserModelCountLimit: '3',
        extraKey: 'should not be allowed',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.newUser', invalidNewUserQuotas)).toThrow(
        BadRequestError,
      );
    });

    it('should reject newUser quotas that is not an object', () => {
      expect(() => globalSettingsValidator.validateValue('usageQuotas.newUser', 'invalid string')).toThrow(
        BadRequestError,
      );
      expect(() => globalSettingsValidator.validateValue('usageQuotas.newUser', 42)).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('usageQuotas.newUser', null)).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('usageQuotas.newUser', [])).toThrow(BadRequestError);
    });

    it('should reject newUser quotas with non-numeric field values', () => {
      const invalidNewUserQuotasWithBoolean = {
        newUserComputeMinutesLimit: true,
        newUserModelCountLimit: '3',
      };

      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.newUser', invalidNewUserQuotasWithBoolean),
      ).toThrow(BadRequestError);

      const invalidNewUserQuotasWithObject = {
        newUserComputeMinutesLimit: '600',
        newUserModelCountLimit: { value: 3 },
      };

      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.newUser', invalidNewUserQuotasWithObject),
      ).toThrow(BadRequestError);

      const invalidNewUserQuotasWithArray = {
        newUserComputeMinutesLimit: [600],
        newUserModelCountLimit: '3',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.newUser', invalidNewUserQuotasWithArray)).toThrow(
        BadRequestError,
      );

      // Test when both fields are non-numeric
      const invalidNewUserQuotasBothFields = {
        newUserComputeMinutesLimit: null,
        newUserModelCountLimit: {},
      };

      expect(() =>
        globalSettingsValidator.validateValue('usageQuotas.newUser', invalidNewUserQuotasBothFields),
      ).toThrow(BadRequestError);
    });

    it('should validate registration object', () => {
      const validRegistration = { type: 'invite-only' };
      expect(() => globalSettingsValidator.validateValue('registration', validRegistration)).not.toThrow();

      const validRegistration2 = { type: 'self-service' };
      expect(() => globalSettingsValidator.validateValue('registration', validRegistration2)).not.toThrow();
    });

    it('should reject invalid registration types', () => {
      const invalidRegistration = { type: 'open' };
      expect(() => globalSettingsValidator.validateValue('registration', invalidRegistration)).toThrow(BadRequestError);

      expect(() => globalSettingsValidator.validateValue('registration.type', 'open')).toThrow(BadRequestError);
    });

    it('should reject non-string registration type values', () => {
      expect(() => globalSettingsValidator.validateValue('registration.type', 42)).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('registration.type', null)).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('registration.type', true)).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('registration.type', {})).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('registration.type', [])).toThrow(BadRequestError);
    });

    it('should reject registration with extra keys', () => {
      const invalidRegistration = {
        type: 'invite-only',
        extraKey: 'should not be allowed',
      };
      expect(() => globalSettingsValidator.validateValue('registration', invalidRegistration)).toThrow(BadRequestError);
    });

    it('should reject registration that is not an object', () => {
      expect(() => globalSettingsValidator.validateValue('registration', 'invalid string')).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('registration', 42)).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('registration', null)).toThrow(BadRequestError);
      expect(() => globalSettingsValidator.validateValue('registration', [])).toThrow(BadRequestError);
    });

    it('should reject registration object missing type field', () => {
      const registrationWithoutType = {
        // missing type field
        extraField: 'some value',
      };

      expect(() => globalSettingsValidator.validateValue('registration', registrationWithoutType)).toThrow(
        BadRequestError,
      );
    });
  });

  describe('validate (complete validation)', () => {
    it('should allow valid complete settings updates', () => {
      const validSettings = {
        usageQuotas: {
          global: {
            globalComputeMinutesLimit: '-1',
            globalModelCountLimit: '10',
          },
          newUser: {
            newUserComputeMinutesLimit: '600',
            newUserModelCountLimit: '3',
          },
        },
        registration: {
          type: 'invite-only' as const,
        },
      };

      expect(() => globalSettingsValidator.validate('usageQuotas', validSettings.usageQuotas)).not.toThrow();
      expect(() => globalSettingsValidator.validate('registration', validSettings.registration)).not.toThrow();
    });

    it('should prevent malicious updates', () => {
      // Try to inject malicious data
      const maliciousData = {
        __proto__: { isAdmin: true },
        usageQuotas: {
          global: {
            globalComputeMinutesLimit: '-1',
            globalModelCountLimit: '10',
          },
          newUser: {
            newUserComputeMinutesLimit: '600',
            newUserModelCountLimit: '3',
          },
        },
        database: {
          connectionString: 'malicious-db-connection',
        },
      };

      expect(() => globalSettingsValidator.validate('maliciousKey', maliciousData)).toThrow(BadRequestError);
    });

    it('should prevent SQL injection attempts', () => {
      const sqlInjectionAttempt = "'; DROP TABLE users; --";
      expect(() => globalSettingsValidator.validate('registration.type', sqlInjectionAttempt)).toThrow(BadRequestError);
    });

    it('should prevent XSS attempts', () => {
      const xssAttempt = '<script>alert("xss")</script>';
      expect(() => globalSettingsValidator.validate('registration.type', xssAttempt)).toThrow(BadRequestError);
    });
  });

  describe('logging behavior', () => {
    it('should log error when invalid top-level key is provided', () => {
      expect(() => globalSettingsValidator.validateKeyPath('invalidKey')).toThrow(BadRequestError);
      expect(logger.error).toHaveBeenCalledWith('Invalid request structure');
    });

    it('should log error when empty key is provided', () => {
      expect(() => globalSettingsValidator.validateKeyPath('')).toThrow(BadRequestError);
      expect(logger.error).toHaveBeenCalledWith('Invalid request structure');
    });

    it('should log error when invalid usage quotas key is provided', () => {
      expect(() => globalSettingsValidator.validateKeyPath('usageQuotas.invalid')).toThrow(BadRequestError);
      expect(logger.error).toHaveBeenCalledWith('Invalid usage quotas key: invalid. Allowed keys: global, newUser');
    });

    it('should log error when usage quotas path is too deep', () => {
      expect(() =>
        globalSettingsValidator.validateKeyPath('usageQuotas.global.globalComputeMinutesLimit.tooDeep'),
      ).toThrow(BadRequestError);
      expect(logger.error).toHaveBeenCalledWith('Usage quotas key path too deep');
    });

    it('should log error when invalid newUser quotas field is provided', () => {
      expect(() => globalSettingsValidator.validateKeyPath('usageQuotas.newUser.invalidField')).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Invalid new user quotas field: invalidField. Allowed fields: newUserComputeMinutesLimit, newUserModelCountLimit',
      );
    });

    it('should log error when registration path is too deep', () => {
      expect(() => globalSettingsValidator.validateKeyPath('registration.type.tooDeep')).toThrow(BadRequestError);
      expect(logger.error).toHaveBeenCalledWith('Registration key path too deep');
    });

    it('should log error when usage quotas object is missing required keys', () => {
      const invalidUsageQuotas = {
        global: {
          globalComputeMinutesLimit: '-1',
          globalModelCountLimit: '10',
        },
        // missing newUser
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas', invalidUsageQuotas)).toThrow(BadRequestError);
      expect(logger.error).toHaveBeenCalledWith('Usage quotas must contain both "global" and "newUser" objects');
    });

    it('should log error when quota value is invalid negative number', () => {
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global.globalComputeMinutesLimit', -2)).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith('Quota values must be -1 (unlimited) or 0 or greater');
    });

    it('should log error when global quotas object has extra keys', () => {
      const invalidGlobalQuotas = {
        globalComputeMinutesLimit: '-1',
        globalModelCountLimit: '10',
        extraKey: 'should not be allowed',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', invalidGlobalQuotas)).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith('Invalid keys in global quotas: extraKey');
    });

    it('should log error when global quotas have non-numeric field values', () => {
      const invalidGlobalQuotas = {
        globalComputeMinutesLimit: { value: -1 },
        globalModelCountLimit: '10',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', invalidGlobalQuotas)).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Global quotas must contain numeric globalComputeMinutesLimit and globalModelCountLimit',
      );
    });

    it('should log error when global quotas are missing required fields', () => {
      const globalQuotasMissingFields = {
        globalComputeMinutesLimit: '-1',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', globalQuotasMissingFields)).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Global quotas must contain globalComputeMinutesLimit and globalModelCountLimit',
      );

      vi.clearAllMocks();

      const globalQuotasWithNull = {
        globalComputeMinutesLimit: null,
        globalModelCountLimit: '10',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', globalQuotasWithNull)).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Global quotas must contain globalComputeMinutesLimit and globalModelCountLimit',
      );
    });

    it('should log error when new user quotas object has extra keys', () => {
      const invalidNewUserQuotas = {
        newUserComputeMinutesLimit: '600',
        newUserModelCountLimit: '3',
        extraKey: 'should not be allowed',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.newUser', invalidNewUserQuotas)).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith('Invalid keys in new user quotas: extraKey');
    });

    it('should log error when new user quotas have non-numeric field values', () => {
      const invalidNewUserQuotas = {
        newUserComputeMinutesLimit: true,
        newUserModelCountLimit: '3',
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.newUser', invalidNewUserQuotas)).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'New user quotas must contain numeric newUserComputeMinutesLimit and newUserModelCountLimit',
      );

      vi.clearAllMocks();

      // Test when modelLimit is non-numeric
      const invalidModelLimit = {
        newUserComputeMinutesLimit: '600',
        newUserModelCountLimit: false,
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.newUser', invalidModelLimit)).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'New user quotas must contain numeric newUserComputeMinutesLimit and newUserModelCountLimit',
      );

      vi.clearAllMocks();

      // Test when both are non-numeric (object and array)
      const bothNonNumeric = {
        newUserComputeMinutesLimit: {},
        newUserModelCountLimit: [],
      };

      expect(() => globalSettingsValidator.validateValue('usageQuotas.newUser', bothNonNumeric)).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'New user quotas must contain numeric newUserComputeMinutesLimit and newUserModelCountLimit',
      );
    });

    it('should log error when usageQuotas is not an object', () => {
      expect(() => globalSettingsValidator.validateValue('usageQuotas', 'invalid string')).toThrow(BadRequestError);
      expect(logger.error).toHaveBeenCalledWith('Usage quotas must be an object');
    });

    it('should log error when global quotas is not an object', () => {
      expect(() => globalSettingsValidator.validateValue('usageQuotas.global', 'invalid string')).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith('Global quotas must be an object');
    });

    it('should log error when newUser quotas is not an object', () => {
      expect(() => globalSettingsValidator.validateValue('usageQuotas.newUser', 'invalid string')).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith('New user quotas must be an object');
    });

    it('should log error when registration object is missing type field', () => {
      const registrationWithoutType = {
        // missing type field
        extraField: 'some value',
      };

      expect(() => globalSettingsValidator.validateValue('registration', registrationWithoutType)).toThrow(
        BadRequestError,
      );
      expect(logger.error).toHaveBeenCalledWith('Registration must contain a type field');
    });
  });
});
