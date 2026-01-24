// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBItemAttribute, profileDao, RESOURCE_ID_REGEX, ResourceId } from '@deepracer-indy/database';
import { logger, metricsLogger } from '@deepracer-indy/utils';
import type { PreSignUpTriggerHandler } from 'aws-lambda';

import { globalSettingsHelper } from '../../utils/GlobalSettingsHelper.js';
import { instrumentHandler } from '../../utils/instrumentation/instrumentHandler.js';

/**
 * The PreSignUp trigger is invoked before a new user is created in the user pool and
 * is responsible for setting initial attributes, including alias and any new
 * user compute and model count limits.
 */
export const PreSignUp: PreSignUpTriggerHandler = async (event) => {
  logger.info('PreSignUp lambda start', { input: event });

  const { userName, request } = event;

  if (!RESOURCE_ID_REGEX.test(userName)) {
    throw new Error('Username is invalid');
  }

  const newUserLimits: NewUserLimits = (await globalSettingsHelper.getGlobalSetting('usageQuotas.newUser')) as {
    newUserComputeMinutesLimit: number;
    newUserModelCountLimit: number;
  };

  validateNewUserLimits(newUserLimits);

  const { newUserComputeMinutesLimit, newUserModelCountLimit } = newUserLimits;

  // Get racer alias from client metadata, fallback to default if not provided
  const racerAlias = request.clientMetadata?.racerAlias || 'RacerAlias';

  // Validate alias format
  if (!isValidAlias(racerAlias)) {
    throw new Error('Invalid racer alias format');
  }

  await profileDao.create({
    profileId: userName as ResourceId,
    alias: racerAlias,
    [DynamoDBItemAttribute.MAX_TOTAL_COMPUTE_MINUTES]: Number(newUserComputeMinutesLimit),
    [DynamoDBItemAttribute.MAX_MODEL_COUNT]: Number(newUserModelCountLimit),
    [DynamoDBItemAttribute.CREATED_AT]: new Date().toISOString(),
    [DynamoDBItemAttribute.EMAIL_ADDRESS]: event.request.userAttributes.email,
  });

  metricsLogger.logCreateUser();

  return event;
};

export const lambdaHandler = instrumentHandler(PreSignUp);

interface NewUserLimits {
  newUserComputeMinutesLimit: number;
  newUserModelCountLimit: number;
}

const isValidAlias = (alias: string): boolean => {
  // Check length (3-20 characters)
  if (alias.length < 3 || alias.length > 20) {
    return false;
  }

  // Check format (letters, numbers, hyphens, underscores only)
  const aliasRegex = /^[a-zA-Z0-9_-]+$/;
  return aliasRegex.test(alias);
};

const validateNewUserLimits = (newUserLimits: NewUserLimits) => {
  const requiredProperties: (keyof NewUserLimits)[] = ['newUserComputeMinutesLimit', 'newUserModelCountLimit'];

  for (const property of requiredProperties) {
    if (!(property in newUserLimits)) {
      logger.error(`Failed to create profile; missing required property ${property} from AppConfig`);
      throw new Error('Failed to create profile');
    }

    const value = newUserLimits[property];

    if (value === undefined || value === null) {
      logger.error(`Failed to create profile; ${property} is undefined or null from AppConfig`);
      throw new Error('Failed to create profile');
    }

    const numericValue = Number(value);
    if (isNaN(numericValue)) {
      logger.error(
        `Failed to create profile; ${property} cannot be converted to a number (received ${typeof value}: ${value}) from AppConfig`,
      );
      throw new Error('Failed to create profile');
    }
  }
};
