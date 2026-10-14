import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import holidaysData from '../src/data/holidays.json' with { type: 'json' };
import { buildDayFlags, type HolidayData } from '../src/lib/holidays';
import { buildMonthCells } from '../src/lib/lunar-calendar';
import { calendarCardDetails } from '../src/lib/calendar-share-card';

test('分享卡片和网页复用农历与假期数据，闰年和周起点正确', () => {
  const flags = buildDayFlags(holidaysData as HolidayData);
  const february = buildMonthCells(2024, 2, flags);
  const dates = february.filter((cell) => cell !== null);
  expect(dates).toHaveLength(29);
  expect(february.slice(0, 4)).toEqual([null, null, null, null]);
  expect(dates.at(-1)?.date).toBe('2024-02-29');
  const newYear = dates.find((cell) => cell.date === '2024-02-10');
  expect(newYear).toMatchObject({ kind: 'holiday', holidayName: '春节', lunar: '春节' });
  expect(dates.find((cell) => cell.date === '2024-02-18')).toMatchObject({ kind: 'work' });
  expect(calendarCardDetails({
    year: 2024, month: 2, view: 'year', theme: 'paper', lunar: true, countdowns: false,
    paySpec: { days: [10], lastWorkDay: false }, caption: '', today: new Date(),
  })).toMatchObject({ width: 2400, height: 3200, filename: 'themori-space-calendar-2024-paper.png' });
});

test('全年分享卡片支持配色、文案、农历开关与真实高清 PNG 下载', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/projects/year-calendar/');
  const year = Number(await page.locator('[data-holiday-calendar]').getAttribute('data-year')) - 1;
  await page.getByRole('button', { name: '全年', exact: true }).click();
  await page.getByRole('button', { name: '上一年', exact: true }).click();
  await expect(page.locator('[data-year-output]')).toHaveText(`${year} 年`);
  const opener = page.getByRole('button', { name: '生成分享卡片' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: '把日子装进一张卡片' });
  const image = dialog.locator('[data-share-image]');
  const preview = dialog.locator('[data-share-preview]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio', { name: '全年海报' })).toBeChecked();
  await expect(preview).toHaveAttribute('aria-busy', 'false');
  await expect(image).toHaveAttribute('alt', new RegExp(`${year} 年全年日历`));
  await expect(image).toHaveAttribute('alt', /今日/);
  await expect(dialog.locator('[data-share-status]')).toContainText('2400 × 3600');
  expect(await image.evaluate((element: HTMLImageElement) => [element.naturalWidth, element.naturalHeight])).toEqual([2400, 3600]);
  const before = await image.getAttribute('src');

  await dialog.getByRole('radio', { name: '松林青绿' }).check();
  await expect(image).toHaveAttribute('data-theme', 'forest');
  await expect(image).not.toHaveAttribute('src', before!);
  await dialog.getByRole('checkbox', { name: '显示农历与节气' }).uncheck();
  await expect(preview).toHaveAttribute('aria-busy', 'false');
  await expect(image).not.toHaveAttribute('alt', /显示农历与节气/);
  await dialog.getByRole('textbox', { name: '写一句话' }).fill('给每一个平凡的日子，一点期待。');
  await dialog.getByRole('textbox', { name: '写一句话' }).press('Tab');
  await expect(dialog.locator('[data-share-status]')).toContainText('2400 × 3600');

  const downloadEvent = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载 PNG' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(`themori-space-calendar-${year}-forest.png`);
  const output = testInfo.outputPath('calendar-card.png');
  await download.saveAs(output);
  const png = await readFile(output);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2400, 3600]);
  expect(png.length).toBeGreaterThan(50_000);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator('body')).not.toHaveClass(/calendar-share-open/);
  await page.reload();
  await opener.click();
  await expect(dialog.getByRole('radio', { name: '松林青绿' })).toBeChecked();
  await expect(image).toHaveAttribute('data-theme', 'forest');
  expect(errors).toEqual([]);
});

test('单月卡片跟随页面月份，复制与系统分享发送 PNG 文件而不是页面链接', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: ShareData) => data.files?.[0]?.type === 'image/png',
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files![0];
        const bytes = new DataView(await file.arrayBuffer());
        (window as Window & { sharedCard?: unknown }).sharedCard = {
          title: data.title, filename: file.name, type: file.type,
          width: bytes.getUint32(16), height: bytes.getUint32(20),
        };
      },
    });
  });
  await page.goto('/projects/year-calendar/');
  const previousLabel = await page.locator('[data-year-output]').textContent();
  await page.getByRole('button', { name: '上一月', exact: true }).click();
  await expect(page.locator('[data-year-output]')).not.toHaveText(previousLabel!);
  const label = await page.locator('[data-year-output]').textContent();
  const [, year, month] = label!.match(/(\d{4}) 年 (\d+) 月/)!;
  const details = calendarCardDetails({
    year: Number(year), month: Number(month), view: 'month', theme: 'paper', lunar: true, countdowns: true,
    paySpec: { days: [10], lastWorkDay: false }, caption: '', today: new Date(),
  });
  await page.getByRole('button', { name: '生成分享卡片' }).click();
  const dialog = page.locator('[data-calendar-share-dialog]');
  const image = dialog.locator('[data-share-image]');
  await expect(dialog.getByRole('radio', { name: '单月卡片' })).toBeChecked();
  await expect(image).toHaveAttribute('alt', new RegExp(`${year} 年 ${month} 月日历`));
  await expect(dialog.locator('[data-share-status]')).toContainText(`2400 × ${details.height}`);

  await dialog.getByRole('button', { name: '复制图片' }).click();
  await expect(dialog.locator('[data-share-status]')).toContainText('图片已复制');
  expect(await page.evaluate(async () => (await navigator.clipboard.read())[0].types)).toContain('image/png');
  await dialog.getByRole('button', { name: '系统分享' }).click();
  await expect(dialog.locator('[data-share-status]')).toContainText('分享完成');
  expect(await page.evaluate(() => (window as Window & { sharedCard?: unknown }).sharedCard)).toEqual({
    title: `${year} 年 ${month} 月日历`, filename: details.filename,
    type: 'image/png', width: details.width, height: details.height,
  });

  // 用户取消系统分享不是错误，不污染当前预览或禁用之后的分享。
  await page.evaluate(() => Object.defineProperty(navigator, 'share', {
    value: () => Promise.reject(new DOMException('用户取消', 'AbortError')),
  }));
  await dialog.getByRole('button', { name: '系统分享' }).click();
  await expect(dialog.getByRole('button', { name: '系统分享' })).toBeEnabled();
  await expect(dialog.locator('[data-share-status]')).not.toContainText('无法');

  await page.evaluate(() => Object.defineProperty(navigator, 'share', {
    value: () => Promise.reject(new Error('不可用')),
  }));
  await dialog.getByRole('button', { name: '系统分享' }).click();
  await expect(dialog.locator('[data-share-status]')).toContainText('请下载图片后发送');
  await expect(dialog.getByRole('button', { name: '下载 PNG' })).toBeEnabled();
});

test('生成失败可重试，关闭释放预览，快速切换不会导出旧主题', async ({ page }) => {
  await page.addInitScript(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    let failOnce = true;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (failOnce) {
        failOnce = false;
        queueMicrotask(() => callback(null));
        return;
      }
      toBlob.call(this, callback, type, quality);
    };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
  });
  await page.goto('/projects/year-calendar/');
  const opener = page.getByRole('button', { name: '生成分享卡片' });
  await opener.click();
  const dialog = page.locator('[data-calendar-share-dialog]');
  await expect(dialog.locator('[data-share-status]')).toContainText('生成失败');
  await expect(dialog.getByRole('button', { name: '下载 PNG' })).toBeDisabled();
  await dialog.getByRole('button', { name: '重新生成' }).click();
  await expect(dialog.getByRole('button', { name: '下载 PNG' })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: '系统分享' })).toBeHidden();

  await dialog.getByRole('radio', { name: '松林青绿' }).check();
  await dialog.getByRole('radio', { name: '午夜星蓝' }).check();
  await expect(dialog.locator('[data-share-image]')).toHaveAttribute('data-theme', 'night');
  await expect(dialog.locator('[data-share-preview]')).toHaveAttribute('aria-busy', 'false');
  const url = await dialog.locator('[data-share-image]').getAttribute('src');
  await dialog.getByRole('button', { name: '关闭分享卡片' }).click();
  await expect(dialog.locator('[data-share-image]')).not.toHaveAttribute('src');
  expect(await page.evaluate(async (value) => {
    try { await fetch(value!); return false; } catch { return true; }
  }, url)).toBe(true);
  await opener.click();
  await expect(dialog.locator('[data-share-image]')).toHaveAttribute('data-theme', 'night');
  await expect(dialog.getByRole('button', { name: '下载 PNG' })).toBeEnabled();
  // 同一任务内立即重开：上一轮排队中的 close 事件不能清理新预览。
  await page.evaluate(() => {
    document.querySelector<HTMLDialogElement>('[data-calendar-share-dialog]')!.close();
    document.querySelector<HTMLButtonElement>('[data-calendar-share-open]')!.click();
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-share-preview]')).toHaveAttribute('aria-busy', 'false');
  await expect(dialog.getByRole('button', { name: '下载 PNG' })).toBeEnabled();
  await expect(dialog.locator('[data-share-image]')).toBeVisible();
});

test('分享弹窗明暗主题均无无障碍问题，320px 手机也不会横向越界', async ({ page, isMobile }, testInfo) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/projects/year-calendar/');
    await page.getByRole('button', { name: '生成分享卡片' }).click();
    await expect(page.locator('[data-share-image]')).toHaveAttribute('data-theme', 'paper');
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
    if (colorScheme === 'light') {
      await page.locator('[data-calendar-share-dialog]').screenshot({ path: testInfo.outputPath('share-dialog.png') });
    }
    await page.keyboard.press('Escape');
  }
  if (!isMobile) await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole('button', { name: '生成分享卡片' }).click();
  await expect(page.locator('[data-share-image]')).toBeVisible();
  const layout = await page.locator('[data-calendar-share-dialog]').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      left: bounds.left, right: bounds.right, viewport: innerWidth,
      overflow: element.scrollWidth > element.clientWidth,
      controls: Array.from(element.querySelectorAll('.hc-share-actions button:not([hidden])')).map((button) => button.getBoundingClientRect().right),
    };
  });
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewport);
  expect(layout.overflow).toBe(false);
  expect(layout.controls.every((right) => right <= layout.viewport)).toBe(true);
});
