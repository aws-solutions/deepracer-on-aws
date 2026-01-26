// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { configDefaults, coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [nxViteTsPaths()],

  test: {
    globals: true,
    passWithNoTests: true,
    silent: true,
    watch: false,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    hookTimeout: 300000,
    testTimeout: 300000,

    include: ['**/{lib,src}/**/*.{test,spec}.?(c|m)[jt]s?(x)', '**/apps/*/lib/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: [...configDefaults.exclude, '**/build/**', '**/cdk.out/**'],

    setupFiles: [path.join(__dirname, 'setupTests.js')],

    environment: 'node',
    environmentMatchGlobs: [['**/*.tsx', 'jsdom']],
    env: {
      TZ: 'UTC',
      /**
       *  Sets powertools logger to use console which
       *  can then be silenced with vitest --silent flag
       */
      POWERTOOLS_DEV: 'true',
      MODEL_DATA_BUCKET_NAME: 'test-model-bucket',
      REWARD_FUNCTION_VALIDATION_LAMBDA_NAME: 'DeepRacerIndy-RewardFunctionValidationFunction',
      SOURCE_BUCKET: 'source-bucket',
      DEST_BUCKET: 'dest-bucket',
      REGION: 'us-east-1',
    },

    coverage: {
      include: ['**/{lib,src}/**', '**/apps/*/lib/**'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        '**/index.ts', // indexes should only include exports
        '**/build',
        '**/cdk.out',
        '**/types',
        '**/types.ts',
        '**/*.stories.ts?(x)',
        'libs/config',
        'libs/model',
        'libs/typescript-client',
        'libs/typescript-server-client',
      ],
      reporter: ['text', 'text-summary', 'cobertura', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      provider: 'v8',
      thresholds: {
        branches: 60,
        functions: 50,
        lines: 60,
      },
    },
  },
});
