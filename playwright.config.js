/**
 * Playwright 端到端测试配置
 */
const path = require('path');
const os = require('os');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.spec.js',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    // 实验要求观察浏览器执行过程，因此关闭无头模式
    headless: false,
    // 失败时自动截图，便于写实验报告时取证
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node src/server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      PORT: '3000',
      // 强制演示模式，避免真实大模型调用导致断言不稳定
      LLM_API_KEY: '',
      // 记录写入系统临时文件，避免污染项目根目录的 qa-records.json
      QA_RECORDS_PATH: path.join(os.tmpdir(), 'aiqa-e2e-records.json'),
    },
  },
});
