// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { defineProject, mergeConfig } from 'vitest/config';

import sharedConfig from '../../vitest.config.js';

export default mergeConfig(
  sharedConfig,
  defineProject({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/apps/infra',
  }),
);
