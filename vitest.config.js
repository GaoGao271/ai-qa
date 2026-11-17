/**
 * Vitest 配置
 * 排除 Playwright 的 E2E 用例，避免 npm test 误加载 .e2e.spec.js
 */
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      'tests/**/*.e2e.spec.js',
    ],
  },
});
