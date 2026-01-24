// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BadRequestError } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { DocumentType } from '@smithy/types';

class GlobalSettingsValidator {
  /**
   * Validates that a key path is allowed for updates
   */
  static validateKeyPath(key: string): void {
    const keyParts = key.split('.');

    // Check for empty key (which results in [''] after split)
    if (keyParts.length === 1 && keyParts[0] === '') {
      logger.error('Invalid request structure');
      this.throwValidationError();
    }

    // Validate top-level key
    const topLevelKey = keyParts[0];
    if (!this.ALLOWED_TOP_LEVEL_KEYS.has(topLevelKey)) {
      logger.error('Invalid request structure');
      this.throwValidationError();
    }

    // Validate nested paths based on top-level key
    if (topLevelKey === 'usageQuotas') {
      this.validateUsageQuotasPath(keyParts.slice(1));
    } else if (topLevelKey === 'registration') {
      this.validateRegistrationPath(keyParts.slice(1));
    }
  }

  /**
   * Validates the value being set based on the key path
   */
  static validateValue(key: string, value: DocumentType): void {
    const keyParts = key.split('.');

    if (keyParts[0] === 'usageQuotas') {
      this.validateUsageQuotasValue(keyParts.slice(1), value);
    } else if (keyParts[0] === 'registration') {
      this.validateRegistrationValue(keyParts.slice(1), value);
    }
  }

  /**
   * Main validation function that validates both key and value
   */
  static validate(key: string, value: DocumentType): void {
    this.validateKeyPath(key);
    this.validateValue(key, value);
  }

  private static readonly ALLOWED_TOP_LEVEL_KEYS = new Set(['usageQuotas', 'registration']);
  private static readonly ALLOWED_USAGE_QUOTAS_KEYS = new Set(['global', 'newUser']);
  private static readonly ALLOWED_GLOBAL_KEYS = new Set(['globalComputeMinutesLimit', 'globalModelCountLimit']);
  private static readonly ALLOWED_NEW_USER_KEYS = new Set(['newUserComputeMinutesLimit', 'newUserModelCountLimit']);
  private static readonly ALLOWED_REGISTRATION_KEYS = new Set(['type']);
  private static readonly ALLOWED_REGISTRATION_TYPES = new Set(['invite-only', 'self-service']);

  /**
   * Validates usage quotas key path
   */
  private static validateUsageQuotasPath(keyParts: string[]): void {
    if (keyParts.length === 0) {
      // Allow updating entire usageQuotas object
      return;
    }

    const quotasKey = keyParts[0];
    if (!this.ALLOWED_USAGE_QUOTAS_KEYS.has(quotasKey)) {
      logger.error(
        `Invalid usage quotas key: ${quotasKey}. Allowed keys: ${Array.from(this.ALLOWED_USAGE_QUOTAS_KEYS).join(', ')}`,
      );
      this.throwValidationError();
    }

    if (keyParts.length >= 2) {
      const fieldKey = keyParts[1];

      if (quotasKey === 'global') {
        if (!this.ALLOWED_GLOBAL_KEYS.has(fieldKey)) {
          logger.error(
            `Invalid global quotas field: ${fieldKey}. Allowed fields: ${Array.from(this.ALLOWED_GLOBAL_KEYS).join(', ')}`,
          );
          this.throwValidationError();
        }
      } else if (quotasKey === 'newUser') {
        if (!this.ALLOWED_NEW_USER_KEYS.has(fieldKey)) {
          logger.error(
            `Invalid new user quotas field: ${fieldKey}. Allowed fields: ${Array.from(this.ALLOWED_NEW_USER_KEYS).join(', ')}`,
          );
          this.throwValidationError();
        }
      }
    }

    if (keyParts.length > 2) {
      logger.error('Usage quotas key path too deep');
      this.throwValidationError();
    }
  }

  /**
   * Validates registration key path
   */
  private static validateRegistrationPath(keyParts: string[]): void {
    if (keyParts.length === 0) {
      // Allow updating entire registration object
      return;
    }

    if (keyParts.length === 1) {
      const fieldKey = keyParts[0];
      if (!this.ALLOWED_REGISTRATION_KEYS.has(fieldKey)) {
        logger.error(
          `Invalid registration field: ${fieldKey}. Allowed fields: ${Array.from(this.ALLOWED_REGISTRATION_KEYS).join(', ')}`,
        );
        this.throwValidationError();
      }
    } else {
      logger.error('Registration key path too deep');
      this.throwValidationError();
    }
  }

  /**
   * Validates usage quotas values
   */
  private static validateUsageQuotasValue(keyParts: string[], value: DocumentType): void {
    if (keyParts.length === 0) {
      // Validating entire usageQuotas object
      this.validateUsageQuotasObject(value);
    } else if (keyParts.length === 1) {
      // Validating global or newUser object
      const quotasKey = keyParts[0];
      if (quotasKey === 'global') {
        this.validateGlobalQuotasObject(value);
      } else if (quotasKey === 'newUser') {
        this.validateNewUserQuotasObject(value);
      }
    } else if (keyParts.length === 2) {
      // Validating individual quota field
      this.validateQuotaFieldValue(value);
    }
  }

  /**
   * Validates registration values
   */
  private static validateRegistrationValue(keyParts: string[], value: DocumentType): void {
    if (keyParts.length === 0) {
      // Validating entire registration object
      this.validateRegistrationObject(value);
    } else if (keyParts.length === 1) {
      const fieldKey = keyParts[0];
      if (fieldKey === 'type') {
        this.validateRegistrationType(value);
      }
    }
  }

  /**
   * Validates complete usage quotas object
   */
  private static validateUsageQuotasObject(value: DocumentType): void {
    if (!this.isObject(value)) {
      logger.error('Usage quotas must be an object');
      this.throwValidationError();
    }

    const obj = value as Record<string, unknown>;

    // Validate required keys
    if (!obj.global || !obj.newUser) {
      logger.error('Usage quotas must contain both "global" and "newUser" objects');
      this.throwValidationError();
    }

    // Validate no extra keys
    const allowedKeys = Array.from(this.ALLOWED_USAGE_QUOTAS_KEYS);
    const actualKeys = Object.keys(obj);
    const extraKeys = actualKeys.filter((k) => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      logger.error(`Invalid keys in usage quotas: ${extraKeys.join(', ')}`);
      this.throwValidationError();
    }

    this.validateGlobalQuotasObject(obj.global as DocumentType);
    this.validateNewUserQuotasObject(obj.newUser as DocumentType);
  }

  /**
   * Validates global quotas object
   */
  private static validateGlobalQuotasObject(value: DocumentType): void {
    if (!this.isObject(value)) {
      logger.error('Global quotas must be an object');
      this.throwValidationError();
    }

    const obj = value as Record<string, unknown>;

    // Check for required keys
    if (
      obj.globalComputeMinutesLimit === undefined ||
      obj.globalComputeMinutesLimit === null ||
      obj.globalModelCountLimit === undefined ||
      obj.globalModelCountLimit === null
    ) {
      logger.error('Global quotas must contain globalComputeMinutesLimit and globalModelCountLimit');
      this.throwValidationError();
    }

    // Validate that values are numbers or numeric strings
    const computeLimit = obj.globalComputeMinutesLimit;
    const modelLimit = obj.globalModelCountLimit;

    if (
      (typeof computeLimit !== 'number' && typeof computeLimit !== 'string') ||
      (typeof modelLimit !== 'number' && typeof modelLimit !== 'string')
    ) {
      logger.error('Global quotas must contain numeric globalComputeMinutesLimit and globalModelCountLimit');
      this.throwValidationError();
    }

    // Validate no extra keys
    const allowedKeys = Array.from(this.ALLOWED_GLOBAL_KEYS);
    const actualKeys = Object.keys(obj);
    const extraKeys = actualKeys.filter((k) => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      logger.error(`Invalid keys in global quotas: ${extraKeys.join(', ')}`);
      this.throwValidationError();
    }

    this.validateQuotaFieldValue(obj.globalComputeMinutesLimit as DocumentType);
    this.validateQuotaFieldValue(obj.globalModelCountLimit as DocumentType);
  }

  /**
   * Validates new user quotas object
   */
  private static validateNewUserQuotasObject(value: DocumentType): void {
    if (!this.isObject(value)) {
      logger.error('New user quotas must be an object');
      this.throwValidationError();
    }

    const obj = value as Record<string, unknown>;

    // Check for required keys
    if (
      obj.newUserComputeMinutesLimit === undefined ||
      obj.newUserComputeMinutesLimit === null ||
      obj.newUserModelCountLimit === undefined ||
      obj.newUserModelCountLimit === null
    ) {
      logger.error('New user quotas must contain newUserComputeMinutesLimit and newUserModelCountLimit');
      this.throwValidationError();
    }

    // Validate that values are numbers or numeric strings
    const computeLimit = obj.newUserComputeMinutesLimit;
    const modelLimit = obj.newUserModelCountLimit;

    if (
      (typeof computeLimit !== 'number' && typeof computeLimit !== 'string') ||
      (typeof modelLimit !== 'number' && typeof modelLimit !== 'string')
    ) {
      logger.error('New user quotas must contain numeric newUserComputeMinutesLimit and newUserModelCountLimit');
      this.throwValidationError();
    }

    // Check for no extra keys
    const allowedKeys = Array.from(this.ALLOWED_NEW_USER_KEYS);
    const actualKeys = Object.keys(obj);
    const extraKeys = actualKeys.filter((k) => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      logger.error(`Invalid keys in new user quotas: ${extraKeys.join(', ')}`);
      this.throwValidationError();
    }

    this.validateQuotaFieldValue(obj.newUserComputeMinutesLimit as DocumentType);
    this.validateQuotaFieldValue(obj.newUserModelCountLimit as DocumentType);
  }

  /**
   * Validates individual quota field value
   */
  private static validateQuotaFieldValue(value: DocumentType): void {
    let num: number;

    if (typeof value === 'string') {
      // Try to parse string as number
      num = Number(value);
      if (isNaN(num)) {
        logger.error('Quota values must be valid numbers or numeric strings');
        this.throwValidationError();
      }
    } else if (typeof value === 'number') {
      num = value;
    } else {
      logger.error('Quota values must be numbers or numeric strings');
      this.throwValidationError();
      return;
    }

    if (!Number.isInteger(num)) {
      logger.error('Quota values must be integers');
      this.throwValidationError();
    }

    if (num < -1) {
      logger.error('Quota values must be -1 (unlimited) or 0 or greater');
      this.throwValidationError();
    }
  }

  /**
   * Validates registration object
   */
  private static validateRegistrationObject(value: DocumentType): void {
    if (!this.isObject(value)) {
      this.throwValidationError();
    }

    const obj = value as Record<string, unknown>;

    // Check for required keys
    if (!obj.type) {
      logger.error('Registration must contain a type field');
      this.throwValidationError();
    }

    // Check for no extra keys
    const allowedKeys = Array.from(this.ALLOWED_REGISTRATION_KEYS);
    const actualKeys = Object.keys(obj);
    const extraKeys = actualKeys.filter((k) => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      logger.error(`Invalid keys in registration: ${extraKeys.join(', ')}`);
      this.throwValidationError();
    }

    this.validateRegistrationType(obj.type as DocumentType);
  }

  /**
   * Validates registration.type value
   */
  private static validateRegistrationType(value: DocumentType): void {
    if (typeof value !== 'string') {
      this.throwValidationError();
    }

    if (!this.ALLOWED_REGISTRATION_TYPES.has(value as string)) {
      this.throwValidationError();
    }
  }

  private static isObject(value: DocumentType): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static throwValidationError(): void {
    throw new BadRequestError({
      message: 'Invalid request structure',
    });
  }
}

export const globalSettingsValidator = GlobalSettingsValidator;
