const path = require('path');
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    // Set before any module import: middleware/auth.js exits without JWT_SECRET,
    // and the media route resolves UPLOAD_PATH at require time.
    env: {
      JWT_SECRET: 'test-secret-not-for-production',
      UPLOAD_PATH: path.join(__dirname, 'test', '.uploads-fixture')
    },
    include: ['test/**/*.test.js']
  }
});
