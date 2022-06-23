'use strict'

module.exports = {
  extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  plugins: ['@typescript-eslint', 'prettier'],
  env: { browser: true, es6: true, node: true },
  parser: '@typescript-eslint/parser',
  root: true,
  rules: {
    'prettier/prettier': 'warn',
  },
}
