import { writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { calendarCardDetails, calendarCardLayout, type CalendarShareOptions } from '../src/lib/calendar-share-card';

const base: CalendarShareOptions = {
  year: 2026, month: 1, view: 'month', theme: 'paper', lunar: true, countdowns: true,
  paySpec: { days: [31], lastWorkDay: false }, caption: '把日子过成喜欢的样子。', today: new Date(2026, 0, 28, 12),
};

test('卡片高度随四、五、六周变化，进度和页脚紧跟日历而不留空行', () => {
  for (const [month, weeks, height] of [[2, 4, 3120], [1, 5, 3440], [8, 6, 3760]]) {
    const options = { ...base, month };
    const layout = calendarCardLayout(options);
    expect(layout.weekRows).toBe(weeks);
    expect(calendarCardDetails(options).height).toBe(height);
    expect(layout.summaryY - layout.calendarY - layout.monthHeight).toBe(30);
    const footerGap = layout.height - 96 - layout.summaryY - layout.summaryHeight;
    expect(footerGap).toBeGreaterThanOrEqual(40);
    expect(footerGap).toBeLessThan(80);
  }
});

interface Rect { x: number; y: number; width: number; height: number }
interface TextBounds {
  value: string;
  baseline: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  cell?: Rect;
}
interface Inspection { text: TextBounds[]; lastRect?: Rect }
declare global {
  interface Window { shareCardInspection: Inspection }
}

// 通过真实入口下载，不使用截图代替导出的 PNG。原图、局部放大与手机尺寸预览均保留为测试产物。
test('share-card-export-review', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, '海报是固定分辨率，导出巡检在桌面项目执行。');
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.setItem('mori.year-calendar.paydays', JSON.stringify({ days: [31], lastWorkDay: false }));
    localStorage.setItem('mori.year-calendar.view', 'month');
    const inspection: Inspection = { text: [] };
    window.shareCardInspection = inspection;
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    const roundRect = CanvasRenderingContext2D.prototype.roundRect;
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radii) {
      inspection.lastRect = { x, y, width, height };
      return roundRect.call(this, x, y, width, height, radii);
    };
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, maxWidth) {
      const metrics = this.measureText(value);
      const rect = inspection.lastRect;
      const cell = rect && rect.width === rect.height && rect.width >= 29 && rect.width < 150 ? { ...rect } : undefined;
      inspection.text.push({
        value, baseline: y, left: x - metrics.actualBoundingBoxLeft, right: x + metrics.actualBoundingBoxRight,
        top: y - metrics.actualBoundingBoxAscent, bottom: y + metrics.actualBoundingBoxDescent, cell,
      });
      if (maxWidth === undefined) fillText.call(this, value, x, y);
      else fillText.call(this, value, x, y, maxWidth);
    };
  });
  const cases = [
    { id: 'year', view: 'year' as const, month: 1, today: new Date(2026, 0, 28, 12), lunar: true, countdowns: true },
    { id: 'month-4-weeks', view: 'month' as const, month: 2, today: new Date(2026, 1, 16, 12), lunar: true, countdowns: true },
    { id: 'month-5-weeks', view: 'month' as const, month: 1, today: new Date(2026, 0, 28, 12), lunar: true, countdowns: true },
    { id: 'month-6-weeks', view: 'month' as const, month: 8, today: new Date(2026, 7, 15, 12), lunar: true, countdowns: true },
    { id: 'month-minimal', view: 'month' as const, month: 1, today: new Date(2026, 0, 28, 12), lunar: false, countdowns: false },
  ];
  const themes = [
    { id: 'paper' as const, name: '纸间暖白' },
    { id: 'forest' as const, name: '松林青绿' },
    { id: 'night' as const, name: '午夜星蓝' },
  ];
  for (const sample of cases) {
    await page.clock.setFixedTime(sample.today);
    await page.goto('/projects/year-calendar/');
    await page.getByRole('button', { name: sample.view === 'year' ? '全年' : '当月', exact: true }).click();
    await expect(page.locator('[data-year-output]')).toHaveText(sample.view === 'year' ? '2026 年' : `2026 年 ${sample.month} 月`);
    await page.getByRole('button', { name: '生成分享卡片' }).click();
    const dialog = page.locator('[data-calendar-share-dialog]');
    await dialog.getByRole('checkbox', { name: '显示农历与节气' }).setChecked(sample.lunar);
    await dialog.getByRole('checkbox', { name: '显示放假与发薪倒计时' }).setChecked(sample.countdowns);
    await expect(dialog.locator('[data-share-preview]')).toHaveAttribute('aria-busy', 'false');
    for (const theme of themes) {
      const options: CalendarShareOptions = { ...base, ...sample, theme: theme.id };
      const details = calendarCardDetails(options);
      const layout = calendarCardLayout(options);
      await page.evaluate(() => { window.shareCardInspection.text.length = 0; });
      await dialog.getByRole('radio', { name: theme.name }).check();
      // 已选主题的 check 不触发 change；重试入口用同一真实生成流程重新导出。
      if (await page.evaluate(() => window.shareCardInspection.text.length === 0)) {
        await dialog.locator('[data-share-retry]').evaluate((button: HTMLButtonElement) => button.click());
      }
      await expect(dialog.locator('[data-share-preview]')).toHaveAttribute('aria-busy', 'false');
      const image = dialog.locator('[data-share-image]');
      await expect(image).toHaveAttribute('data-theme', theme.id);
      expect(await image.evaluate((element: HTMLImageElement) => [element.naturalWidth, element.naturalHeight])).toEqual([details.width, details.height]);
      const text = await page.evaluate(() => window.shareCardInspection.text);
      expect(text.map((item) => item.value)).toContain('themori.space');
      expect(text.map((item) => item.value)).not.toContain('mori.');
      expect(text.every((item) => item.left >= 60 && item.right <= 1140 && item.top >= 24 && item.bottom <= layout.height - 24), `${sample.id} ${theme.id} 画布边缘`).toBe(true);
      const labels = text.filter((item) => item.cell);
      expect(labels.length).toBeGreaterThan(28);
      const outside = labels.filter((item) => {
        const cell = item.cell!;
        return item.left < cell.x || item.right > cell.x + cell.width || item.top < cell.y || item.bottom > cell.y + cell.height;
      });
      expect(outside, `${sample.id} ${theme.id} 日期文字不越出方格`).toEqual([]);
      const dayBaselines = new Set(labels.filter((item) => /^\d+$/.test(item.value)).map((item) => item.baseline - item.cell!.y));
      expect(dayBaselines.size, `${sample.id} ${theme.id} 日期数字基线一致`).toBe(1);
      if (sample.id === 'year') expect(text.map((item) => item.value)).toContain('腊八节');
      if (sample.view === 'month') expect(text.map((item) => item.value)).not.toContain('全年放假安排');

      const name = `${sample.id}-${theme.id}`;
      const downloadEvent = page.waitForEvent('download');
      await dialog.getByRole('button', { name: '下载 PNG' }).click();
      const download = await downloadEvent;
      expect(download.suggestedFilename()).toBe(details.filename);
      await download.saveAs(testInfo.outputPath(`${name}.png`));
      const crops = await image.evaluate((element: HTMLImageElement, { calendarY, monthHeight, yearView }) => {
        const make = (x: number, y: number, width: number, height: number, outWidth = width) => {
          const canvas = document.createElement('canvas');
          canvas.width = outWidth;
          canvas.height = Math.round(height * outWidth / width);
          canvas.getContext('2d')!.drawImage(element, x, y, width, height, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/png').split(',')[1];
        };
        return {
          detail: make(128, calendarY * 2 - 16, yearView ? 1100 : 2144, Math.min(monthHeight * 2 + 32, yearView ? 650 : 800)),
          preview: make(0, 0, element.naturalWidth, element.naturalHeight, 720),
        };
      }, { calendarY: layout.calendarY, monthHeight: layout.monthHeight, yearView: sample.view === 'year' });
      await writeFile(testInfo.outputPath(`${name}-detail.png`), Buffer.from(crops.detail, 'base64'));
      await writeFile(testInfo.outputPath(`${name}-preview.png`), Buffer.from(crops.preview, 'base64'));
    }
    await dialog.getByRole('button', { name: '关闭分享卡片' }).click();
  }
});
