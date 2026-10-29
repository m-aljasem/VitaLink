// @ts-check
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const angular = require('@angular-eslint/eslint-plugin');
const angularTemplate = require('@angular-eslint/eslint-plugin-template');
const templateParser = require('@angular-eslint/template-parser');

module.exports = [
  {
    ignores: ['www/**', 'android/**', 'ios/**', 'website/**', '.angular/**', 'node_modules/**'],
  },
  ...tsPlugin.configs['flat/recommended'].map((config) => ({ ...config, files: ['src/**/*.ts'] })),
  {
    files: ['src/**/*.ts'],
    plugins: { '@angular-eslint': angular },
    rules: {
      ...angular.configs.recommended.rules,
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      // The codebase consistently uses constructor injection.
      '@angular-eslint/prefer-inject': 'off',
      // The codebase uses `any` for Supabase error objects; tighten gradually.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['src/**/*.html'],
    languageOptions: { parser: templateParser },
    plugins: { '@angular-eslint/template': angularTemplate },
    rules: {
      ...angularTemplate.configs.recommended.rules,
    },
  },
];
