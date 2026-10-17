import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * 四季主题：按节气自动换季、可手动锁定、南半球对调。
 *
 * 交节时刻用 page.clock 把浏览器时间冻在节气前后，所以不用等真的换季也能验。
 * 下面的官方时刻取自紫金山天文台公布的数据（北京时间）。
 */

type Season = 'spring' | 'summer' | 'autumn' | 'winter';

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** 每套配色的 --bg，用来确认季节确实换上了（而不是只看属性）。 */
const BG: Record<Season, { light: string; dark: string }> = {
  spring: { light: '#fbfaf4', dark: '#0f140d' },
  summer: { light: '#f4faf7', dark: '#0c1512' },
  autumn: { light: '#fbf7f0', dark: '#16110c' },
  winter: { light: '#f6f8fa', dark: '#0e1318' },
};

/** 2026 年四个交节时刻的前后各一小时左右。 */
const SOLAR_TERM_CASES: Array<[string, string, Season, string, Season]> = [
  ['立春 02-04 04:01:51', '2026-02-04T02:00:00+08:00', 'winter', '2026-02-04T06:00:00+08:00', 'spring'],
  ['立夏 05-05 19:48:27', '2026-05-05T17:00:00+08:00', 'spring', '2026-05-05T22:00:00+08:00', 'summer'],
  ['立秋 08-07 19:42:26', '2026-08-07T17:00:00+08:00', 'summer', '2026-08-07T22:00:00+08:00', 'autumn'],
  ['立冬 11-07 17:51:46', '2026-11-07T15:00:00+08:00', 'autumn', '2026-11-07T20:00:00+08:00', 'winter'],
];

// 半球靠浏览器时区推断，固定住测试才可预期。
test.use({ timezoneId: 'Asia/Shanghai' });

const seasonOf = (page: import('@playwright/test').Page) => page.locator('html').getAttribute('data-season');
const bgOf = (page: import('@playwright/test').Page) => page.evaluate(
  () => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
);

for (const [name, before, expectedBefore, after, expectedAfter] of SOLAR_TERM_CASES) {
  test(`${name} 之前仍是 ${expectedBefore}，之后换成 ${expectedAfter}`, async ({ page }) => {
    await page.clock.install({ time: new Date(before) });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-season', expectedBefore);
    expect(await bgOf(page)).toBe(BG[expectedBefore].light);

    await page.clock.setFixedTime(new Date(after));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-season', expectedAfter);
    expect(await bgOf(page)).toBe(BG[expectedAfter].light);
  });
}

test('季节在首屏绘制前就定好，且不依赖打包出来的模块', async ({ page }) => {
  // 把打包模块掐掉。季节仍然正确，说明是 <head> 里那段内联脚本算的，
  // 也就是不会先闪一下默认配色再跳到当季。
  await page.route('**/_astro/*.js', (route) => route.abort());
  await page.clock.install({ time: new Date('2026-06-01T12:00:00+08:00') });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-season', 'summer');
  expect(await bgOf(page)).toBe(BG.summer.light);
});

test('服务端烘焙的季节过期后，首屏脚本会自己纠正', async ({ page }) => {
  // 静态站点可能很久不重新构建，HTML 里带的是构建当天的季节。
  // 这里把服务端值改成一个必然错误的值，验证客户端会覆盖掉它。
  await page.route(
    (url) => url.pathname === '/',
    async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/data-season="[a-z]+"/, 'data-season="winter"');
      await route.fulfill({ response, body });
    },
  );
  await page.clock.install({ time: new Date('2026-06-01T12:00:00+08:00') });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-season', 'summer');
});

test.describe('禁用 JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('仍带有服务端烘焙的季节与配色', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-season', /^(spring|summer|autumn|winter)$/);
    const season = (await seasonOf(page)) as Season;
    expect(await bgOf(page)).toBe(BG[season].light);
  });
});

test('?season= 可以预览某一季，但不会写进本地存储', async ({ page }) => {
  for (const season of SEASONS) {
    await page.goto(`/?season=${season}`);
    await expect(page.locator('html')).toHaveAttribute('data-season', season);
    expect(await bgOf(page)).toBe(BG[season].light);
    expect(await page.evaluate(() => localStorage.getItem('mori-season'))).toBeNull();
  }

  // 参数只作用于当次加载，回到干净的地址就恢复自动判定。
  await page.goto(`/?season=${SEASONS[0]}`);
  await page.goto('/');
  const auto = (await seasonOf(page)) as Season;
  expect(SEASONS).toContain(auto);
});

test('手动锁定一季后跨页面、刷新都保持，选回自动就跟随节气', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-06-01T12:00:00+08:00') });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-season', 'summer');

  await page.getByRole('button', { name: /^季节主题/ }).click();
  await page.getByRole('menuitemradio', { name: '冬季' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
  await expect(page.locator('html')).toHaveAttribute('data-season-mode', 'manual');
  expect(await bgOf(page)).toBe(BG.winter.light);

  await page.goto('/about/');
  await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');

  // 换回自动：存储清掉，并且按冻住的时间应该回到夏天。
  await page.getByRole('button', { name: /^季节主题/ }).click();
  await page.getByRole('menuitemradio', { name: '跟随节气' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-season', 'summer');
  await expect(page.locator('html')).toHaveAttribute('data-season-mode', 'auto');
  expect(await page.evaluate(() => localStorage.getItem('mori-season'))).toBeNull();

  // 选项在菜单里，选完菜单会收起来（隐藏元素 getByRole 找不到），所以重新打开看选中态。
  await page.getByRole('button', { name: /^季节主题/ }).click();
  await expect(page.getByRole('menuitemradio', { name: '跟随节气' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('menuitemradio', { name: '夏季' })).toHaveAttribute('aria-checked', 'false');
});

test('季节菜单可以只用键盘操作', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /^季节主题/ });
  const menu = page.getByRole('menu', { name: '季节主题' });
  await expect(menu).toBeHidden();

  // 上下键展开并把焦点送进第一个/最后一个选项。
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menuitemradio', { name: '跟随节气' })).toBeFocused();

  await page.keyboard.press('End');
  await expect(page.getByRole('menuitemradio', { name: '冬季' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('menuitemradio', { name: '跟随节气' })).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-season', 'spring');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  // 重新打开（菜单隐藏时里面的选项对 getByRole 不可见），确认选中态跟上了。
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitemradio', { name: '春季' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('menuitemradio', { name: '春季' })).toBeFocused();

  // Esc 关闭并把焦点还给触发按钮。
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('页面开着不关也会在交节后自己换季', async ({ page }) => {
  // 首屏脚本只算一次；标签页长期开着时靠定时重判（和回到前台时补一次）换季。
  await page.clock.install({ time: new Date('2026-02-04T02:00:00+08:00') });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');

  // 往前走一天，越过立春（04:01:51），定时重判应该把季节换成春天。
  await page.clock.fastForward('26:00:00');
  await expect(page.locator('html')).toHaveAttribute('data-season', 'spring');
  await expect(page.locator('html')).toHaveAttribute('data-season-mode', 'auto');
});

test('南半球季节对调', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'Australia/Sydney' });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-01-15T12:00:00+08:00') });
  await page.goto('/');
  // 一月在北半球是冬天，在悉尼是夏天。
  await expect(page.locator('html')).toHaveAttribute('data-season', 'summer');
  await context.close();
});

test('页头按钮上的季节图标跟着当季走', async ({ page }) => {
  for (const season of SEASONS) {
    await page.goto(`/?season=${season}`);
    await expect(page.locator(`[data-season-icon='${season}']`)).toBeVisible();
    for (const other of SEASONS.filter((value) => value !== season)) {
      await expect(page.locator(`[data-season-icon='${other}']`)).toBeHidden();
    }
  }
});

test('季节图标和明暗主题的图标不能重样', async ({ page }) => {
  // 夏季用太阳，而明暗主题按钮曾经也是太阳：两个按钮紧挨着，分不清哪个是哪个。
  // 所以主题按钮换成了「对比度」图标，这里把它钉住。
  await page.goto('/');
  const themeIcon = await page.locator('.theme-toggle path').first().getAttribute('d');
  expect(themeIcon).toBeTruthy();
  for (const season of SEASONS) {
    const seasonIcon = await page.locator(`[data-season-icon='${season}'] path`).getAttribute('d');
    expect(seasonIcon, `${season} 季的图标不能和主题按钮的图标相同`).not.toBe(themeIcon);
  }
});

test('季节菜单展开后不会越出视口', async ({ page }) => {
  // 页头靠右，菜单向左展开；窄屏上最容易顶出屏幕。
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: /^季节主题/ }).click();
    const menu = page.getByRole('menu', { name: '季节主题' });
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.x, `宽度 ${width}`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `宽度 ${width}`).toBeLessThanOrEqual(width);
  }
});

// 每个季节都把明暗两种配色跑一遍 WCAG AA。对比度是这套配色最容易翻车的地方，
// 所以顺便断言 --bg 真的是当季的值，避免参数失效导致同一个配色被测了八遍。
for (const season of SEASONS) {
  test(`${season} 季在明暗两套主题下都通过 WCAG AA`, async ({ page }) => {
    for (const path of ['/', '/projects/year-calendar/']) {
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme });
        await page.goto(path === '/' ? `/?season=${season}` : `${path}?season=${season}`);
        await expect(page.locator('html')).toHaveAttribute('data-season', season);
        expect(await bgOf(page)).toBe(BG[season][colorScheme]);

        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(results.violations).toEqual([]);
      }
    }
  });
}
