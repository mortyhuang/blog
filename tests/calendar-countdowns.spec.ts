import { test, expect } from '@playwright/test';
import { buildDayFlags, getWageRows, type HolidayData } from '../src/lib/holidays';
import { calendarCardCountdowns } from '../src/lib/calendar-share-card';

const data: HolidayData = {
  Years: {
    '2026': [
      { Name: '元旦', StartDate: '2026-01-01', EndDate: '2026-01-03' },
      { Name: '春节', StartDate: '2026-02-15', EndDate: '2026-02-23', CompDays: ['2026-02-14', '2026-02-28'] },
    ],
  },
};
const flags = buildDayFlags(data);

test('卡片给出下一次假期的完整日期和天数，工资按设置顺延', () => {
  const today = new Date(2026, 0, 28);
  const paySpec = { days: [31], lastWorkDay: false };
  const rows = getWageRows(today, flags, paySpec);
  expect(rows[0]).toMatchObject({ payDate: '2026-02-02', scheduledDate: '2026-01-31', daysLeft: 5 });
  expect(calendarCardCountdowns(today, data, flags, paySpec)).toMatchObject({
    holiday: { heading: '下次放假 · 春节', value: '18', unit: '天后放假', detail: '2026.02.15 — 2026.02.23 · 共 9 天' },
    wage: { heading: '下次发工资', value: '5', unit: '天后发薪', detail: '预计发薪 2026.02.02', note: '原定 2026.01.31，遇休息日顺延' },
  });
});

test('假期中、当天发薪、多发薪日和最后工作日都使用同一套规则', () => {
  expect(calendarCardCountdowns(new Date(2026, 1, 16), data, flags, { days: [10, 20], lastWorkDay: true })).toMatchObject({
    holiday: { heading: '正在放假 · 春节', value: '8', unit: '天假期剩余' },
    wage: { value: '8', detail: '预计发薪 2026.02.24' },
  });
  expect(calendarCardCountdowns(new Date(2026, 1, 24), data, flags, { days: [20], lastWorkDay: false }).wage).toMatchObject({
    value: '今天发', unit: '', detail: '预计发薪 2026.02.24',
  });
  expect(calendarCardCountdowns(new Date(2026, 0, 28), data, flags, { days: [20], lastWorkDay: true }).wage).toMatchObject({
    value: '2', detail: '预计发薪 2026.01.30', note: '每月最后一个工作日 · 按页面设置计算',
  });
});

test('跨年日期保留年份，没有后续假期或发薪设置时不编造日期', () => {
  expect(calendarCardCountdowns(new Date(2025, 11, 30), data, flags, { days: [1], lastWorkDay: false })).toMatchObject({
    holiday: { value: '2', detail: '2026.01.01 — 2026.01.03 · 共 3 天' },
    wage: { value: '6', detail: '预计发薪 2026.01.05' },
  });
  expect(calendarCardCountdowns(new Date(2026, 11, 30), data, flags, { days: [], lastWorkDay: false })).toMatchObject({
    holiday: { value: '待公布', detail: '暂无后续法定放假安排' },
    wage: { value: '未设置', detail: '先在页面添加一个发薪日' },
  });
});

interface DrawingLog {
  text: string[];
  rects: number[][];
  todayRects: number[][];
}

declare global {
  interface Window { cardDrawing: DrawingLog }
}

test('全年和单月 PNG 实际绘制今日、假期、当前工资设置和正方形日期格', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date(2026, 0, 28, 12));
  await page.addInitScript(() => {
    const log: DrawingLog = { text: [], rects: [], todayRects: [] };
    window.cardDrawing = log;
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    const roundRect = CanvasRenderingContext2D.prototype.roundRect;
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, maxWidth) {
      log.text.push(value);
      if (maxWidth === undefined) fillText.call(this, value, x, y);
      else fillText.call(this, value, x, y, maxWidth);
    };
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radii) {
      log.rects.push([x, y, width, height]);
      return roundRect.call(this, x, y, width, height, radii);
    };
    CanvasRenderingContext2D.prototype.stroke = function (...args: [] | [Path2D]) {
      const rect = log.rects.at(-1);
      if (this.lineWidth === 2 && rect && rect[2] === rect[3]) log.todayRects.push(rect);
      Reflect.apply(stroke, this, args);
    };
  });
  await page.goto('/projects/year-calendar/');
  await expect(page.locator('[data-year-output]')).toHaveText('2026 年 1 月');
  await page.getByRole('button', { name: '移除每月 10 号发薪日' }).click();
  await page.locator('[data-pay-input]').fill('31');
  await page.getByRole('button', { name: '添加', exact: true }).click();
  await page.getByRole('button', { name: '全年', exact: true }).click();
  await page.getByRole('button', { name: '生成分享卡片' }).click();
  const dialog = page.locator('[data-calendar-share-dialog]');
  const image = dialog.locator('[data-share-image]');
  await expect(dialog.getByRole('checkbox', { name: '显示放假与发薪倒计时' })).toBeChecked();
  await expect(image).toHaveAttribute('alt', /今日 2026\.01\.28 · 星期三/);
  await expect(image).toHaveAttribute('alt', /预计发薪 2026\.02\.02/);
  await expect(image).toHaveAttribute('alt', /下次放假 · 春节：18天后放假/);

  for (const view of ['全年海报', '单月卡片']) {
    await page.evaluate(() => {
      const log = window.cardDrawing;
      log.text.length = log.rects.length = log.todayRects.length = 0;
    });
    // 首次也触发一次重新绘制，确保日志仅包含这一版卡片。
    if (view === '全年海报') await dialog.getByRole('radio', { name: '松林青绿' }).check();
    else await dialog.getByRole('radio', { name: view }).check();
    await expect(dialog.locator('[data-share-preview]')).toHaveAttribute('aria-busy', 'false');
    const log = await page.evaluate(() => window.cardDrawing);
    expect(log.text).toEqual(expect.arrayContaining([
      '今日 2026.01.28 · 星期三', '下次放假 · 春节', '18', '天后放假',
      '2026.02.15 — 2026.02.23 · 共 9 天', '下次发工资', '5', '天后发薪',
      '预计发薪 2026.02.02', '原定 2026.01.31，遇休息日顺延',
    ]));
    expect(log.text).toContain('themori.space');
    expect(log.text).toContain('themori.space / 全年日历');
    expect(log.text).not.toContain('mori.');
    expect(log.text).toContain('2026 年度进度');
    if (view === '全年海报') {
      expect(log.text).toEqual(expect.arrayContaining(['全年放假安排', '全年调休上班', '已过 28 / 365 天 · 剩余 337 天']));
      await expect(image).toHaveAttribute('alt', /全年放假安排 \d+ 天，全年调休上班 \d+ 天/);
    } else {
      expect(log.text).not.toContain('全年放假安排');
      expect(log.text).not.toContain('全年调休上班');
      expect(log.text).toEqual(expect.arrayContaining(['已过 28 / 365 天', '剩余 337 天']));
      await expect(image).not.toHaveAttribute('alt', /全年放假安排|全年调休上班/);
    }
    // 验证 PNG 实际绘制了进度条，而不只是一个百分比文本。
    const barWidth = view === '全年海报' ? 288 : 992;
    const barHeight = view === '全年海报' ? 6 : 8;
    const track = log.rects.find(([, , width, height]) => width === barWidth && height === barHeight);
    expect(track).toBeDefined();
    const fill = log.rects.find(([x, y, width, height]) => x === track![0] && y === track![1] && height === barHeight && width < barWidth);
    expect(fill?.[2]).toBeCloseTo(barWidth * 28 / 365, 5);
    const dateRects = log.rects.filter(([, , width, height]) => width > 20 && width < 180 && height > 20 && height < 180);
    expect(dateRects.length).toBeGreaterThan(28);
    expect(dateRects.every(([, , width, height]) => Math.abs(width - height) < 0.01)).toBe(true);
    expect(log.todayRects).toHaveLength(1);
    const downloadEvent = page.waitForEvent('download');
    await dialog.getByRole('button', { name: '下载 PNG' }).click();
    await (await downloadEvent).saveAs(testInfo.outputPath(view === '全年海报' ? 'countdown-card.png' : 'month-progress-card.png'));
  }

  await dialog.getByRole('checkbox', { name: '显示放假与发薪倒计时' }).uncheck();
  await expect(image).not.toHaveAttribute('alt', /下次发工资/);
  await expect(dialog.locator('[data-share-status]')).toContainText('2400 × 3040');
  await expect(image).toHaveAttribute('alt', /2026 年度进度 8%，已过 28 \/ 365 天，剩余 337 天/);
  // 不想分享工资时间时仍然显示今天；重新打开要读取刚修改的页面发薪设置。
  await expect(image).toHaveAttribute('alt', /今日 2026\.01\.28/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '移除每月 31 号发薪日' }).click();
  await page.getByRole('button', { name: '+ 最后工作日', exact: true }).click();
  await page.getByRole('button', { name: '生成分享卡片' }).click();
  await dialog.getByRole('checkbox', { name: '显示放假与发薪倒计时' }).check();
  await expect(image).toHaveAttribute('alt', /预计发薪 2026\.01\.30/);
  await expect(image).toHaveAttribute('alt', /每月最后一个工作日/);
});

test('页面全年与当月的日期也是正方形，今天保持高亮', async ({ page, isMobile }) => {
  await page.clock.setFixedTime(new Date(2026, 0, 28, 12));
  for (const width of isMobile ? [390] : [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/projects/year-calendar/');
    for (const view of ['当月', '全年']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      const panel = page.locator(view === '全年' ? '[data-months-year]' : '[data-months-month]');
      await expect(panel).toBeVisible();
      await expect(panel.locator('.hc-day.is-today')).toHaveCount(1);
      const cells = await panel.locator('.hc-day:not(.is-empty)').evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }));
      expect(cells.every((cell) => Math.abs(cell.width - cell.height) < 1), `${width}px ${view}`).toBe(true);
    }
  }
});
