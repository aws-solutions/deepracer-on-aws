// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InternalFailureError, NotFoundError } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { DocumentType } from '@smithy/types';

import { appConfigServiceHelper } from '../appconfig/AppConfigServiceHelper.js';

class GlobalSettingsHelper {
  /**
   * Fetches a global setting using either a single or nested key.
   * @param key - The key for the setting, which can be a single key or a nested key (e.g., 'nested.key').
   * @returns - The value of the global setting.
   */
  async getGlobalSetting(key: string): Promise<DocumentType> {
    logger.info(`GetGlobalSetting input: Fetching setting for key: ${key}`);

    const configuration = await appConfigServiceHelper.getConfiguration();
    const content = this.decodeConfigurationContent(configuration as Uint8Array);
    const value = this.getNestedValue(key, content);

    logger.info(`GetGlobalSetting output: Found value for key '${key}': ${JSON.stringify(value)}`);
    return value;
  }

  /**
   * Sets a global setting using either a single or nested key.
   * @param key - The key for the setting, which can be a single key or a nested key (e.g., 'nested.key').
   * @param value - The value to set for the global setting. This can be any type that is serializable to JSON.
   * @returns - void
   */
  async setGlobalSetting(key: string, value: DocumentType): Promise<void> {
    logger.info(`SetGlobalSetting input: Setting key: ${key} with value: ${JSON.stringify(value)}`);

    const configuration = await appConfigServiceHelper.getConfiguration();
    const content = this.decodeConfigurationContent(configuration as Uint8Array);
    const updatedContent = this.setNestedValue(key, value, content);
    try {
      await appConfigServiceHelper.updateConfiguration(JSON.stringify(updatedContent));
      logger.info(`SetGlobalSetting output: Updated key: ${key} with value: ${JSON.stringify(value)}`);
    } catch (err) {
      logger.error('Error updating setting', { err });
      throw new InternalFailureError({
        message: 'An error occurred while updating the provided setting.',
      });
    }
  }

  /**
   * Decodes the configuration content returned from a getConfiguration() call from a Uint8Array to a DocumentType.
   * @param content - The content of the configuration as a Uint8Array.
   * @returns - The decoded configuration content as a DocumentType.
   */
  decodeConfigurationContent(content: Uint8Array): DocumentType {
    const contentString = new TextDecoder().decode(content);
    const parsedContent = JSON.parse(contentString);

    logger.info(`DecodeConfigurationContent output: ${JSON.stringify(parsedContent)}`);
    return parsedContent;
  }

  /**
   * Given a key and an object, finds a nested value in the object using the key.
   * @param key - The key to search for, which can be a single key or a nested key (e.g., 'nested.key').
   * @param obj - The object in which to search for the key.
   * @returns - The value associated with the key in the object.
   */
  getNestedValue(key: string, obj: DocumentType): DocumentType {
    logger.info(`GetNestedValue input: Searching for key: ${key}`);

    const keyParts = key.split('.');
    const nestedValue = keyParts.reduce<DocumentType>((current, keyPart) => {
      if (this.isObject(current) && current !== undefined && Object.prototype.hasOwnProperty.call(current, keyPart)) {
        return (current as { [prop: string]: DocumentType })[keyPart];
      } else {
        throw new NotFoundError({
          message: 'Could not find a value for the provided object and search key.',
        });
      }
    }, obj);

    logger.info(`GetNestedValue output: Found nested value for key '${key}': ${JSON.stringify(nestedValue)}`);
    return nestedValue;
  }

  /**
   * Updates a nested value in an object using a dot-separated key.
   * @param key - The key to update (e.g., 'thiskey' or 'nested.key').
   * @param value - The value to set.
   * @param obj - The object to update.
   * @returns The updated object.
   */
  setNestedValue(key: string, value: DocumentType, obj: DocumentType): DocumentType {
    logger.info(`SetNestedValue input: Setting nested value for key: ${key} with value: ${JSON.stringify(value)}`);

    let targetValue: unknown = obj;
    const keyParts = key.split('.');
    // For each key part except the last, traverse through the object
    for (let i = 0; i < keyParts.length - 1; i++) {
      const keyPart = keyParts[i];
      // If current value is not an object or does not have the key, create an empty object at that key
      if (this.doesNotContainKey(targetValue, keyPart)) {
        if (this.isObject(targetValue)) {
          (targetValue as Record<string, DocumentType>)[keyPart] = {};
        }
      }

      // If current value is an object, set current to the next nested object
      if (this.isObject(targetValue)) {
        targetValue = (targetValue as Record<string, DocumentType>)[keyPart];
      }
    }

    // Set the value for the last key
    const lastKey = keyParts[keyParts.length - 1];
    if (this.isObject(targetValue)) {
      (targetValue as Record<string, DocumentType>)[lastKey] = value;
    } else {
      throw new InternalFailureError({
        message: 'An error occurred while saving the provided value.',
      });
    }

    logger.info(`SetNestedValue output: Updated object ${JSON.stringify(obj)}`);
    return obj;
  }

  // Helper functions for type checking

  /**
   * Checks if the current value is an object (not null, not an array, and of type 'object').
   * @param current - The value to check.
   * @returns - True if the value is an object, false otherwise.
   */
  isObject = (current: unknown) => typeof current === 'object' && current !== null && !Array.isArray(current);

  /**
   * Checks if the target value does not contain the specified key part.
   * @param targetValue - The value to check.
   * @param keyPart - The key part to check for.
   * @returns - True if the key part is not present in the target value, false otherwise.
   */
  doesNotContainKey = (targetValue: unknown, keyPart: string) =>
    typeof targetValue !== 'object' || targetValue === null || Array.isArray(targetValue) || !(keyPart in targetValue);
}

export const globalSettingsHelper = new GlobalSettingsHelper();
