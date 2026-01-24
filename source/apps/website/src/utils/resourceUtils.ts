// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { customAlphabet, urlAlphabet } from 'nanoid';

/**
 * - "_" is not accepted in resource names by some AWS services
 * - "-" is used as our workflow job identifier separator (in addition to making IDs frustrating to copy+paste)
 */
const awsSafeAlphabet = urlAlphabet.replace('_', '').replace('-', '');
const nanoid = customAlphabet(awsSafeAlphabet, deepRacerIndyAppConfig.dynamoDB.resourceIdLength);

/**
 * Generates a secure URL-friendly unique ID typed as a special string.
 */
export const generateResourceId = () => {
  return nanoid();
};
