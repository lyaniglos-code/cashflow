import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

const unusedVars = [
  'error',
  { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true },
];

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'shots/**',
      'scripts/**', // ad-hoc QA/screenshot tooling (puppeteer)
      'server/data/**',
      '**/*.log',
    ],
  },

  js.configs.recommended,

  // ---- Backend (Node, ESM) ----
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': unusedVars,
      'no-console': 'off',
    },
  },

  // ---- Frontend (React, browser) ----
  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...(react.configs.recommended?.rules ?? {}),
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Apostrophes/quotes in copy ("Let's", "You'll") are fine — cosmetic only.
      'react/no-unescaped-entities': 'off',
      'no-unused-vars': unusedVars,
    },
  },

  // ---- Client build/config files run in Node ----
  {
    files: ['client/*.config.js', '*.config.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
  },

  // ---- Test files (Vitest globals) ----
  {
    files: ['**/*.test.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
