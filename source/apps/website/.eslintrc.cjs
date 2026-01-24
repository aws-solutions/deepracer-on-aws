const path = require('node:path');

module.exports = {
  root: true,
  ignorePatterns: ['!.storybook', 'dist', 'node_modules'],
  extends: ['plugin:@nx/react', 'plugin:storybook/recommended', '../../.eslintrc.cjs'],
  plugins: ['react-refresh'],
  parserOptions: {
    EXPERIMENTAL_useProjectService: true,
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: [`${__dirname}/tsconfig.*?.json`],
        alwaysTryTypes: true,
      },
    },
  },
  rules: {
    'storybook/no-uninstalled-addons': ['error', { packageJsonLocation: `${__dirname}/package.json` }],
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          '**/*.spec.*',
          '**/vite.config.ts',
          '**/*.stories.tsx',
          '**/.storybook/**/*',
          '**/testUtils.tsx',
          '**/setupTests.js',
          '**/*.d.ts',
        ],
        bundledDependencies: false,
        optionalDependencies: false,
        peerDependencies: false,
        packageDir: [__dirname, path.resolve(__dirname, '../../')],
      },
    ],
  },
};
