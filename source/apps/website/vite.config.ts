// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/// <reference types='vitest' />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, mergeConfig } from 'vite';

import sharedConfig from '../../vitest.config';

// https://vitejs.dev/config/
export default mergeConfig(
  sharedConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/apps/website',

    server: {
      port: 4200,
      host: 'localhost',
      open: '/home',
    },

    preview: {
      port: 4300,
      host: 'localhost',
    },

    plugins: [react(), nxViteTsPaths()],

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        external: ['/env.js'],
      },
    },

    resolve: {
      alias: {
        './runtimeConfig': './runtimeConfig.browser',
      },
    },
    test: {
      setupFiles: ['./setupTests.js'],
      environment: 'jsdom',
    },
  }),
);
