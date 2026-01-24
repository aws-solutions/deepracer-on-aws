const path = require('node:path');

module.exports = {
  root: true,
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    EXPERIMENTAL_useProjectService: {
      maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
    },
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: [`${__dirname}/tsconfig.json`],
        alwaysTryTypes: true,
      },
    },
  },
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/*.spec.*', '**/vitest.config.cts'],
        bundledDependencies: false,
        optionalDependencies: false,
        peerDependencies: false,
        packageDir: [__dirname, path.resolve(__dirname, '../../')],
      },
    ],
  },
};
