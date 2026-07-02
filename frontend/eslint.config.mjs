import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  js.configs.recommended,
  // 'essential' tier: real Vue errors (invalid v-for keys, template bugs)
  // without stylistic churn on the existing codebase.
  ...pluginVue.configs['flat/essential'],
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^(_|e|err)' }],
      // Options API components are registered by key; name casing is noise here
      'vue/multi-word-component-names': 'off',
      // Deep mutation of object props (photo.like_count etc.) is an accepted
      // pattern in this codebase; still forbid reassigning the prop itself.
      'vue/no-mutating-props': ['error', { shallowOnly: true }]
    }
  },
  {
    // CommonJS build tooling configs
    files: ['postcss.config.js', 'tailwind.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node }
    }
  },
  {
    // Vite pre-bundles its config: ESM syntax but Node globals like __dirname work
    files: ['vite.config.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node }
    }
  }
];
