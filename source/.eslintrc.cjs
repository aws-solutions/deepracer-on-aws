/**
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  root: true,
  ignorePatterns: ['apps/**/*', 'libs/**/*'],
  plugins: ['@nx', '@stylistic'],
  extends: ['plugin:import/recommended', 'plugin:prettier/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    EXPERIMENTAL_useProjectService: true,
  },
  rules: {
    // https://nx.dev/packages/eslint-plugin/documents/enforce-module-boundaries
    '@nx/enforce-module-boundaries': [
      'error',
      {
        enforceBuildableLibDependency: true,
        allow: ['../../vitest.config.js', '../../vitest.config.ts', '#*'],
        depConstraints: [
          {
            sourceTag: '*',
            onlyDependOnLibsWithTags: ['*'],
          },
        ],
      },
    ],

    // https://eslint.style/rules
    '@stylistic/comma-dangle': ['warn', 'always-multiline'],
    '@stylistic/dot-location': ['warn', 'property'],
    '@stylistic/eol-last': 'warn',
    '@stylistic/new-parens': 'warn',
    '@stylistic/no-multiple-empty-lines': 'warn',
    '@stylistic/no-trailing-spaces': ['warn', { ignoreComments: true }],
    '@stylistic/no-whitespace-before-property': 'warn',
    '@stylistic/operator-linebreak': ['warn', 'after', { overrides: { '?': 'ignore', ':': 'ignore' } }],
    '@stylistic/quote-props': ['warn', 'as-needed'],
    '@stylistic/quotes': ['warn', 'single', { avoidEscape: true }],
    '@stylistic/rest-spread-spacing': ['warn', 'never'],
    '@stylistic/spaced-comment': ['warn', 'always', { markers: ['/'] }],

    // https://eslint.org/docs/latest/rules/
    'no-var': 'error',
    'prefer-const': 'warn',
    'prefer-object-spread': 'warn',
    'no-eval': 'error',
    'no-lonely-if': 'error',
    'no-multi-str': 'error',
    'no-new-func': 'error',
    'no-object-constructor': 'error',
    'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['acc', 'state'] }],
    'no-template-curly-in-string': 'error',
    'no-unneeded-ternary': 'error',
    'no-useless-return': 'error',
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'default-case': ['error'],
    'no-lone-blocks': 'error',
    'no-undef-init': 'error',
    'no-useless-concat': 'error',
    'no-bitwise': ['error'],
    'no-undef': 'off', // TypeScript already handles this (https://github.com/typescript-eslint/typescript-eslint/issues/477)
    'no-restricted-syntax': [
      'error',
      'WithStatement',
      {
        selector: 'MemberExpression[property.name=/^(?:substring|substr)$/]',
        message: 'Prefer string.slice() over .substring() and .substr().',
      },
    ],

    // https://github.com/import-js/eslint-plugin-import/tree/main/docs/rules
    'import/newline-after-import': 'warn',
    'import/first': 'error',
    'import/order': [
      'warn',
      {
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
        'newlines-between': 'always',
      },
    ],
    'import/named': 'off', // TypeScript compilation already ensures that named imports exist in the referenced module
    'import/no-unresolved': 'off', // TypeScript checks imports
    'import/no-named-as-default': 'off',
    'import/no-named-as-default-member': 'off',

    // https://typescript-eslint.io/rules/
    '@typescript-eslint/prefer-find': 'error',
    'dot-notation': 'off',
    '@typescript-eslint/dot-notation': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/return-await': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    'no-duplicate-imports': ['error'],
    'no-shadow': ['off'],
    '@typescript-eslint/no-shadow': 'error',
    '@typescript-eslint/member-ordering': [
      'error',
      {
        default: [
          'public-static-field',
          'public-static-method',
          'protected-static-field',
          'protected-static-method',
          'private-static-field',
          'private-static-method',
          'field',
          'constructor',
          'method',
        ],
      },
    ],
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: ['enum'],
        format: ['PascalCase'],
      },
      {
        selector: ['enumMember'],
        format: ['UPPER_CASE'],
      },
    ],
    'no-loop-func': 'off',
    '@typescript-eslint/no-loop-func': 'error',
    'no-redeclare': 'off',
    '@typescript-eslint/no-this-alias': 'error',
    'no-unused-expressions': 'off',
    '@typescript-eslint/no-unused-expressions': [
      'error',
      { allowShortCircuit: true, allowTaggedTemplates: true, allowTernary: true },
    ],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': [
      'error',
      {
        functions: false,
        classes: false,
        variables: false,
        typedefs: false,
      },
    ],
    'no-useless-constructor': 'off',
    '@typescript-eslint/no-useless-constructor': 'error',
  },
  overrides: [
    {
      // TypeScript files
      files: ['*.?(c|m)ts?(x)'],
      extends: ['plugin:@nx/typescript', 'plugin:import/typescript'],
      rules: {
        '@typescript-eslint/no-require-imports': ['error'],
        '@typescript-eslint/no-var-requires': 'error',
      },
    },
    {
      files: ['*.js', '*.jsx'],
      extends: ['plugin:@nx/javascript'],
      rules: {},
    },
    {
      files: ['*.spec.ts', '*.spec.tsx', '*.spec.js', '*.spec.jsx'],
      plugins: ['testing-library'],
      extends: ['plugin:vitest/legacy-recommended'],
      rules: {
        // https://github.com/vitest-dev/eslint-plugin-vitest
        'vitest/no-conditional-expect': 'error',
        'vitest/no-identical-title': 'error',
        'vitest/no-interpolation-in-snapshots': 'error',
        'vitest/no-mocks-import': 'error',
        'vitest/valid-describe-callback': 'error',
        'vitest/valid-expect': 'error',
        'vitest/valid-title': 'error',

        // https://github.com/testing-library/eslint-plugin-testing-library
        'testing-library/await-async-utils': 'error',
        'testing-library/no-container': 'error',
        'testing-library/no-debugging-utils': 'error',
        'testing-library/no-dom-import': ['error', 'react'],
        'testing-library/no-node-access': 'error',
        'testing-library/no-promise-in-fire-event': 'error',
        'testing-library/no-unnecessary-act': 'error',
        'testing-library/no-wait-for-multiple-assertions': 'error',
        'testing-library/no-wait-for-side-effects': 'error',
        'testing-library/no-wait-for-snapshot': 'error',
        'testing-library/prefer-find-by': 'error',
        'testing-library/prefer-presence-queries': 'error',
        'testing-library/prefer-query-by-disappearance': 'error',
        'testing-library/prefer-screen-queries': 'error',
        'testing-library/render-result-naming-convention': 'error',
      },
    },
  ],
};
