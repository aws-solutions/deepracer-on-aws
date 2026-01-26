// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DeepRacerIndyUserPoolConfig } from '#types/userPoolConfig.js';

import { DEFAULT_NAMESPACE } from './commonDefaults.js';

export const BASE_USER_POOL_NAME = 'DeepRacerIndyUserPool';

const namespace = (typeof process !== 'undefined' && process.env?.NAMESPACE) || DEFAULT_NAMESPACE;

export const userPoolDefaults = {
  userPoolName: `${namespace}-${BASE_USER_POOL_NAME}`,
  enableMFA: false,
  enableSignups: false,
} as const satisfies DeepRacerIndyUserPoolConfig;
