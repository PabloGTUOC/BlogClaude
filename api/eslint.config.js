const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'test/.uploads-fixture/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      // Express error handlers need 4 args, and (req, res, next) signatures
      // often leave params unused by design.
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^(_|req|res|next|err)',
        caughtErrorsIgnorePattern: '^(_|e|err)'
      }]
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
];
