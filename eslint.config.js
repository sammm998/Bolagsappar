import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['legacy/**', '**/node_modules/**', '**/dist/**', '**/.astro/**', '**/.expo/**', '**/*.ts', '**/*.tsx', 'apps/mobile/**', 'supabase/functions/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-unused-vars': ['warn', { args: 'none' }], 'no-empty': 'off', 'no-cond-assign': 'off', 'no-useless-escape': 'off', 'no-control-regex': 'off', 'no-sparse-arrays': 'off', 'no-useless-assignment': 'off', 'no-irregular-whitespace': ['error', { skipRegExps: true, skipStrings: true, skipTemplates: true }] }
  },
  { files: ['packages/core/src/avrakning/engine.js', 'packages/core/src/kassan/engine.js', 'packages/core/src/verkstad/engine.js', 'packages/core/src/kassan/avtal.js'], rules: { 'no-unused-vars': 'off', 'no-irregular-whitespace': 'off' } }
];
