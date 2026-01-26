// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { userPoolDefaults } from '#defaults/userPoolDefaults.js';
import type { DeepRacerIndyUserPoolConfig } from '#types/userPoolConfig.js';

/**
 * DeepRacerIndy UserPool config.
 */
export const deepRacerIndyUserPoolConfig = {
  userPoolName: userPoolDefaults.userPoolName,
  enableMFA: userPoolDefaults.enableMFA,
  enableSignups: userPoolDefaults.enableSignups,
} as const satisfies DeepRacerIndyUserPoolConfig;
