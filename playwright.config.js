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
  // 控制台 list 输出（本地看方便）+ HTML 报告（CI 上传到 artifact）
  reporter: ['list', 'html', { open: 'never' }],
  use: {
    baseURL: 'http://localhost:3000',
    // 实验要求观察浏览器执行过程，因此本地默认关闭无头模式；
    // 仅 GitHub Actions 的 ubuntu runner 没有桌面，必须用无头模式
    // 注意：不用 process.env.CI，因为本机系统级被误设了 CI=true
    headless: !!process.env.GITHUB_ACTIONS,
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
