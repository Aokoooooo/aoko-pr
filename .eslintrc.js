/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-magic-numbers */
module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: [
    'airbnb-base',
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
  ],
  globals: {
    socialShare: false,
    soundManager: false,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
      jsx: true,
    },
    ecmaVersion: 7,
    sourceType: 'module',
  },
  plugins: ['import', '@typescript-eslint'],
  root: true,
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        format: ['camelCase'],
        selector: [
          'method',
          'function',
          'accessor',
          'classProperty',
          'parameterProperty',
          'classMethod',
          'objectLiteralMethod',
        ],
      },
      {
        format: ['UPPER_CASE', 'camelCase', 'snake_case'],
        selector: 'objectLiteralProperty',
      },
      {
        custom: {
          match: true,
          // 必须以 E + 大写字母开头
          regex: '^E[A-Z]',
        },
        format: ['PascalCase'],
        selector: 'enum',
      },
      {
        format: ['PascalCase'],
        selector: ['enumMember', 'class', 'typeParameter'],
      },
      {
        custom: {
          match: true,
          // 必须以 I + 大写字母开头
          regex: '^I[A-Z]',
        },
        format: ['PascalCase'],
        selector: 'interface',
      },
      {
        custom: {
          match: true,
          // 必须以 T + 大写字母开头
          regex: '^T[A-Z]',
        },
        format: ['PascalCase'],
        selector: 'typeAlias',
      },
      {
        format: ['camelCase', 'snake_case'],
        selector: ['typeProperty'],
      },
      {
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow',
        selector: 'variable',
      },
      {
        format: ['camelCase'],
        leadingUnderscore: 'allow',
        selector: 'parameter',
      },
      {
        format: ['camelCase', 'UPPER_CASE', 'snake_case'],
        modifiers: ['destructured'],
        selector: ['variable'],
      },
    ],
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-shadow': ['error'],
    '@typescript-eslint/no-use-before-define': ['error'],
    '@typescript-eslint/no-var-requires': 'off',
    'array-bracket-spacing': [
      'error',
      'never',
      { arraysInArrays: false, objectsInArrays: false },
    ],
    'arrow-parens': ['error', 'always', { requireForBlockBody: false }],
    'block-spacing': ['error', 'always'],
    'brace-style': 'error',
    'camelcase': 'off',
    'class-methods-use-this': 'off',
    'comma-dangle': ['error', 'always-multiline'],
    'consistent-return': 'error',
    'curly': ['error', 'multi-line'],
    'eqeqeq': ['warn', 'smart'],
    'global-require': 'off',
    'import/extensions': 'off',
    'import/no-mutable-exports': 'off',
    'import/no-dynamic-require': 'off',
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'import/no-unresolved': ['error', { ignore: ['\\*\\.(png|jpg)$'] }],
    'import/order': [
      'error',
      {
        'alphabetize': { order: 'asc' },
        'newlines-between': 'ignore',
        'pathGroupsExcludedImportTypes': ['external'],
      },
    ],
    'import/prefer-default-export': ['off'],
    'indent': [
      'error',
      2,
      {
        CallExpression: { arguments: 1 },
        FunctionDeclaration: { parameters: 2 },
        ignoredNodes: [
          'JSXElement',
          'JSXElement > *',
          'JSXAttribute',
          'JSXIdentifier',
          'JSXNamespacedName',
          'JSXMemberExpression',
          'JSXSpreadAttribute',
          'JSXExpressionContainer',
          'JSXOpeningElement',
          'JSXClosingElement',
          'JSXText',
          'JSXEmptyExpression',
          'JSXSpreadChild',
        ],
        SwitchCase: 0,
      },
    ],
    'jsx-quotes': 'warn',
    'key-spacing': 'error',
    'keyword-spacing': 'error',
    'linebreak-style': ['error', 'unix'],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-irregular-whitespace': [
      'error',
      { skipComments: true, skipStrings: true, skipTemplates: true },
    ],
    'no-magic-numbers': [
      'error',
      {
        detectObjects: true,
        ignore: [-1, 0, 1, 2, 10, 16, 24, 30, 60, 100, 1000],
        ignoreArrayIndexes: true,
      },
    ],
    'no-multiple-empty-lines': ['error', { max: 1 }],
    'no-param-reassign': ['error', { props: false }],
    'no-plusplus': 'off',
    // 核心库内的规则和 ts 的同时启用会冲突，所以关闭核心库的启用 ts 的。no-use-before-define 同
    'no-shadow': 'off',
    'no-sparse-arrays': 'error',
    'no-underscore-dangle': 'off',
    'no-unused-vars': ['warn', { args: 'none' }],
    'no-use-before-define': 'off',
    'no-var': 'error',
    'object-curly-newline': [
      'error',
      {
        ObjectPattern: { multiline: true },
      },
    ],
    'object-curly-spacing': ['error', 'always'],
    'operator-linebreak': ['error', 'before'],
    'prefer-const': ['error', { destructuring: 'all' }],
    'prefer-destructuring': [
      'error',
      { AssignmentExpression: { array: false } },
    ],
    'quote-props': ['error', 'consistent-as-needed'],
    'quotes': ['error', 'single'],
    'radix': ['error', 'as-needed'],
    'semi': ['error', 'never'],
    'sort-imports': ['error', { ignoreDeclarationSort: true }],
    // 修改这个文件时需要打开这个规则来确认属性顺序正确
    // 'sort-keys': ['error'],
    'space-before-function-paren': [
      'error',
      { anonymous: 'always', asyncArrow: 'always', named: 'never' },
    ],
    'space-in-parens': ['error', 'never'],
    'unicode-bom': 'error',
    'use-isnan': 'warn',
  },
  settings: {
    'html/html-extensions': ['.html'],
    'html/indent': '+2',
    'import/core-modules': [
      'classnames',
      'clipboard',
      'lodash',
      'redux',
      'redux-api-middleware',
      'redux-observers',
      'reselect',
    ],
    'import/resolver': {
      node: {
        extensions: ['', '.es', '.js', '.jsx', '.ts', '.tsx', '.d.ts'],
        paths: [__dirname],
      },
    },
  },
}
