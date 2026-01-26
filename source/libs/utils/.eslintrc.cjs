const path = require('node:path');

/**
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  root: true,
  extends: ['../../.eslintrc.cjs'],
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
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/*.spec.*', '**/vitest.config.ts'],
        bundledDependencies: false,
        optionalDependencies: false,
        peerDependencies: false,
        packageDir: [__dirname, path.resolve(__dirname, '../../')],
      },
    ],
  },
};
