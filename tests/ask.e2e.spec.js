/**
 * E2E 测试：AI 答疑助手核心问答流程
 *
 * 覆盖链路：打开首页 → 输入问题 → 点击提交 → 断言回答 → 断言历史记录
 * 元素定位统一使用 data-testid，与页面文案、样式解耦。
 */
const { test, expect } = require('@playwright/test');

test.describe('AI 答疑助手核心流程', () => {
  test('打开首页 → 输入问题 → 提交 → 断言回答 → 断言历史记录', async ({ page }) => {
    // 1. 打开首页，确认输入框与回答区已完成初始化
    await page.goto('/');
    await expect(page).toHaveTitle(/AI 答疑助手/);

    const input = page.getByTestId('ask-input');
    const submit = page.getByTestId('ask-button');
    const answer = page.getByTestId('answer-text');

    await expect(input).toBeVisible();
    await expect(submit).toBeVisible();
    await expect(answer).toContainText('等待你的提问');

    // 2. 输入唯一问题并提交，便于后续在历史列表中精确定位
    const question = `E2E 测试问题 ${Date.now()}`;
    await input.fill(question);
    await submit.click();

    // 3. 断言回答：先离开初始态，再等待最终回答生成完成
    await expect(answer).not.toContainText('等待你的提问');
    await expect(answer).not.toContainText('正在检索', { timeout: 15_000 });
    await expect(answer).not.toBeEmpty();

    // 4. 断言历史记录：最新一条应包含刚提交的问题
    const historyItem = page
      .getByTestId('history-list')
      .getByTestId('history-item')
      .first();
    await expect(historyItem).toContainText(question);
  });
});
