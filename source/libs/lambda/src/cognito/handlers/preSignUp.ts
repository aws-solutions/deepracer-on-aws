// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  DynamoDBItemAttribute,
  isConditionalCheckFailure,
  profileDao,
  RESOURCE_ID_REGEX,
  ResourceId,
} from '@deepracer-indy/database';
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

  const { userName, request, triggerSource } = event;

  // Federated (SAML/SSO) sign-ins get a Cognito-assigned username (e.g. "ExternalIdP_<subject>"),
  // not the 15-char generateResourceId() format native sign-up/admin-create explicitly pass as
  // username — so the format check only applies to those non-federated paths.
  const isFederatedSignUp = triggerSource === 'PreSignUp_ExternalProvider';

  if (!isFederatedSignUp && !RESOURCE_ID_REGEX.test(userName)) {
    throw new Error('Username is invalid');
  }

  const newUserLimits: NewUserLimits = (await globalSettingsHelper.getGlobalSetting('usageQuotas.newUser')) as {
    newUserComputeMinutesLimit: number;
    newUserModelCountLimit: number;
  };

  validateNewUserLimits(newUserLimits);

  const { newUserComputeMinutesLimit, newUserModelCountLimit } = newUserLimits;

  // Get racer alias: self-service SignUp passes it via clientMetadata; admin-created users
  // (bulk invite) have no ClientMetadata parameter available on AdminCreateUser, so they instead
  // carry a pre-sanitized alias candidate via the custom:racerAlias user attribute. Falls back
  // to the hardcoded default if neither source is present — except for federated sign-ins, which
  // intentionally get a blank alias instead: that's the signal the frontend's
  // needsProfileCompletion check uses to route the user to CompleteProfileForm (the IdP's
  // displayName claim is not mapped to custom:racerAlias, so this always applies to them).
  const racerAlias = isFederatedSignUp
    ? ''
    : request.clientMetadata?.racerAlias || request.userAttributes['custom:racerAlias'] || 'RacerAlias';

  // Validate alias format — skipped for the intentionally-blank federated placeholder above.
  if (racerAlias && !isValidAlias(racerAlias)) {
    throw new Error('Invalid racer alias format');
  }

  try {
    await profileDao.create({
      profileId: userName as ResourceId,
      alias: racerAlias,
      [DynamoDBItemAttribute.MAX_TOTAL_COMPUTE_MINUTES]: Number(newUserComputeMinutesLimit),
      [DynamoDBItemAttribute.MAX_MODEL_COUNT]: Number(newUserModelCountLimit),
      [DynamoDBItemAttribute.CREATED_AT]: new Date().toISOString(),
      [DynamoDBItemAttribute.EMAIL_ADDRESS]: event.request.userAttributes.email,
      // Optional racer country (2-letter code) supplied at sign-up; surfaced on leaderboards.
      ...(event.request.userAttributes['custom:countryCode']
        ? { [DynamoDBItemAttribute.COUNTRY_CODE]: event.request.userAttributes['custom:countryCode'] }
        : {}),
    });
    metricsLogger.logCreateUser();
  } catch (error) {
    // Cognito doesn't persist a federated user as fully linked until the whole sign-in flow
    // (including everything downstream of this trigger) succeeds — so a prior attempt that got
    // this far but failed later (e.g. a misconfigured attribute mapping, a blocked token
    // exchange) can cause PreSignUp_ExternalProvider to fire again for the exact same
    // deterministic username on retry, with the profile already created from attempt one. Treat
    // that as success rather than failing the sign-in; this is specific to the federated path —
    // a duplicate-create conflict on the native/admin-create paths is a real anomaly and should
    // still surface as an error.
    if (!isFederatedSignUp || !isConditionalCheckFailure(error)) {
      throw error;
    }
    logger.info('Federated sign-in profile already exists from a prior attempt — treating as success', {
      profileId: userName,
    });
  }

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
