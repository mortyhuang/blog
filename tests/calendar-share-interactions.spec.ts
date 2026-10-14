import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    shareEncodeCount: number;
    sharePaintedText: string[];
  }
}

test('一句话编辑时不生成，真正失焦后只更新一次', async ({ page }) => {
  await page.addInitScript(() => {
    window.shareEncodeCount = 0;
    window.sharePaintedText = [];
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      window.shareEncodeCount += 1;
      toBlob.call(this, callback, type, quality);
    };
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, maxWidth) {
      window.sharePaintedText.push(value);
      if (maxWidth === undefined) fillText.call(this, value, x, y);
      else fillText.call(this, value, x, y, maxWidth);
    };
  });
  await page.goto('/projects/year-calendar/');
  await page.getByRole('button', { name: '生成分享卡片' }).click();
  const dialog = page.locator('[data-calendar-share-dialog]');
  const image = dialog.locator('[data-share-image]');
  const download = dialog.getByRole('button', { name: '下载 PNG' });
  const caption = dialog.getByRole('textbox', { name: '写一句话' });
  await expect(download).toBeEnabled();
  const before = await image.getAttribute('src');
  const encoded = await page.evaluate(() => window.shareEncodeCount);
  await caption.fill('今天');
  await caption.pressSequentially('也有新的期待。');
  // 跨过旧版的 180ms 防抖时间，确保即便停止输入也不会提前生成。
  await page.waitForTimeout(400);
  await expect(caption).toBeFocused();
  await expect(image).toHaveAttribute('src', before!);
  await expect(download).toBeDisabled();
  await expect(dialog.locator('[data-share-status]')).toContainText('离开输入框后');
  expect(await page.evaluate(() => window.shareEncodeCount)).toBe(encoded);

  await caption.press('Tab');
  await expect(download).toBeEnabled();
  await expect(image).not.toHaveAttribute('src', before!);
  expect(await page.evaluate(() => window.shareEncodeCount)).toBe(encoded + 1);
  expect(await page.evaluate(() => window.sharePaintedText)).toContain('今天也有新的期待。');
  // 没有修改时的失焦不重复编码。
  await caption.focus();
  await caption.press('Tab');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.shareEncodeCount)).toBe(encoded + 1);
});

test('分享入口与工具栏等高，下载复制和系统分享按钮等宽等高', async ({ page, isMobile }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} });
  });
  await page.goto('/projects/year-calendar/');
  await expect(page.getByRole('button', { name: '生成分享卡片' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const view of ['当月', '全年']) {
    await page.getByRole('button', { name: view, exact: true }).click();
    const heights = await page.locator('.hc-panel-controls').evaluate((element) => Array.from(
      element.querySelectorAll('[data-year-reset], [data-view-switch], [data-year-prev], [data-year-next], [data-calendar-share-open]'),
      (control) => control.getBoundingClientRect().height,
    ));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    expect(heights.at(-1)).toBe(25);
  }
  await page.locator('.hc-panel-controls').screenshot({ path: testInfo.outputPath('calendar-toolbar.png') });
  if (!isMobile) await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: '生成分享卡片' }).click();
  const dialog = page.locator('[data-calendar-share-dialog]');
  await expect(dialog.getByRole('button', { name: '系统分享' })).toBeEnabled();
  const sizes = await dialog.locator('.hc-share-actions button:not([hidden])').evaluateAll((buttons) => buttons.map((button) => {
    const bounds = button.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height, right: bounds.right };
  }));
  expect(sizes).toHaveLength(3);
  expect(Math.max(...sizes.map((size) => size.width)) - Math.min(...sizes.map((size) => size.width))).toBeLessThan(1);
  const viewport = await page.evaluate(() => innerWidth);
  expect(sizes.every((size) => size.height === 42 && size.right <= viewport)).toBe(true);
  await dialog.screenshot({ path: testInfo.outputPath('share-buttons.png') });
});
