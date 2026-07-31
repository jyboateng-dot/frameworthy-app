import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'frameworkthy-app', // abandoned Next.js scaffold, unrelated to this app (see .gitignore)
    'landing_all_*.jsx', // one-off scratch/dev files (see .gitignore)
    'fix.js',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Node-context files (Cloud Functions and one-off tooling scripts) never
    // run in a browser — require/process/module/__dirname are Node globals,
    // not browser ones, so the default `globals.browser` above leaves them
    // flagged as no-undef.
    files: ['functions/**/*.js', 'scratch/**/*.js', 'vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
