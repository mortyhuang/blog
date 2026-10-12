import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicPages = ['/', '/posts/', '/posts/shader-landscape/', '/projects/', '/projects/noise-landscape/', '/projects/trefoil-knot/', '/projects/year-calendar/', '/about/'];

test('首页显示文章、作品与真实导航', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/mori/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('保持好奇');
  await expect(page.locator('.post-card')).toHaveCount(0);
  await expect(page.locator('[data-post-row]:visible')).toHaveCount(6);
  await expect(page.locator('[data-project-preview]')).toHaveCount(2);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '关于' }).click();
  await expect(page).toHaveURL('/about/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('你好');
  expect(errors).toEqual([]);
});

test('首次遵循系统主题，手动选择持久化且导航后保留', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '切换到浅色主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto('/projects/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '切换到深色主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('文章不再区分开发与设计分类，卡片与列表不显示分类标签', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-category-filter]')).toHaveCount(0);
  await expect(page.locator('.post-card .category-label')).toHaveCount(0);
  await expect(page.locator('.post-row .post-row-category')).toHaveCount(0);
  await expect(page.locator('.post-card')).toHaveCount(0);
  await expect(page.locator('[data-post-row]')).toHaveCount(6);

  await page.goto('/posts/');
  await expect(page.locator('[data-category-filter]')).toHaveCount(0);
  await expect(page.locator('.post-row .post-row-category')).toHaveCount(0);
});

test('标签 URL、话题筛选、空状态及重置可用', async ({ page }) => {
  await page.goto('/posts/?tag=Astro');
  await expect(page.locator('[data-post-row]:visible')).toHaveCount(2);
  await expect(page.locator('[data-active-tag-name]')).toHaveText('Astro');
  await page.locator('[data-tag-filter="CSS"]').click();
  await expect(page.locator('[data-post-row]:visible')).toHaveCount(2);
  await expect(page.locator('[data-active-tag-name]')).toHaveText('CSS');
  await expect(page).toHaveURL(/tag=CSS/);
  await page.getByRole('button', { name: '清除话题筛选' }).click();
  await expect(page.locator('[data-post-row]:visible')).toHaveCount(6);
  await expect(page.locator('[data-active-tag]')).toBeHidden();
  await expect(page).toHaveURL('/posts/');
  await page.goto('/posts/?tag=NonExistentTag');
  await expect(page.locator('[data-filter-empty]')).toBeVisible();
  await page.getByRole('button', { name: '查看全部文章' }).click();
  await expect(page.locator('[data-post-row]:visible')).toHaveCount(6);
  await page.locator('[data-tag-filter="CSS"]').click();
  await expect(page.locator('[data-post-row]:visible')).toHaveCount(2);
  await page.goBack();
  await expect(page.locator('[data-post-row]:visible')).toHaveCount(6);
});

test('搜索支持快捷键、键盘选择及跳转', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#search-dialog')).toBeVisible();
  await expect(page.locator('#search-input')).toBeFocused();
  await page.locator('#search-input').fill('Astro');
  await expect(page.locator('.search-result')).toHaveCount(2);
  await expect(page.locator('.search-result.is-selected')).toContainText('Astro Islands');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.search-result.is-selected')).toContainText('Markdown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/posts/markdown-as-interface/');
});

test('搜索无结果与 Escape 关闭，焦点回到入口', async ({ page }) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: '搜索文章', exact: true });
  await opener.click();
  await page.locator('#search-input').fill('<script>not-a-post</script>');
  await expect(page.locator('#search-status')).toContainText('没有找到');
  await expect(page.locator('.search-result')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#search-dialog')).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expect(page.locator('body')).not.toHaveClass(/dialog-open/);
});

test('搜索加载失败时说明错误并允许重试', async ({ page }) => {
  await page.route('**/search-index.json', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: '搜索文章', exact: true }).click();
  await expect(page.locator('#search-status')).toContainText('暂时不可用');
  await page.keyboard.press('Escape');
  await page.unroute('**/search-index.json');
  await page.getByRole('button', { name: '搜索文章', exact: true }).click();
  await expect(page.locator('.search-result')).toHaveCount(6);
});

test('MDX 渲染、地形滑块、代码与链接复制可用', async ({ page }) => {
  await page.goto('/posts/shader-landscape/');
  await expect(page.locator('#article-content h2')).toHaveCount(5);
  const copy = page.getByRole('button', { name: '复制代码' }).first();
  await copy.click();
  await expect(copy).toHaveText('已复制 ✓');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('float height');
  const canvas = page.locator('.terrain-canvas');
  const before = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  await page.locator('[data-frequency]').evaluate((element: HTMLInputElement) => {
    element.value = '5.4';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('[data-frequency-output]')).toHaveText('5.4');
  const after = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  expect(after).not.toEqual(before);
  await page.getByRole('button', { name: '复制文章链接' }).click();
  await expect(page.locator('[data-copy-link]')).toContainText('已复制链接');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/posts\/shader-landscape\//);
  await expect(page.locator('.related-section')).toHaveCount(0);
});

test('文章不显示副标题、感谢区和推荐区，底部标签保留并可筛选文章', async ({ page, request }) => {
  const entries: { url: string; tags: string[]; description: string }[] = await (await request.get('/search-index.json')).json();
  for (const entry of entries) {
    await page.goto(entry.url);
    await expect(page.locator('.post-detail-header .eyebrow, .post-detail-header .category-label')).toHaveCount(0);
    await expect(page.locator('.post-detail-header h1')).toBeVisible();
    await expect(page.locator('.post-detail-header p, .post-lead')).toHaveCount(0);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', entry.description);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', entry.description);
    await expect(page.getByText('谢谢你读到这里', { exact: false })).toHaveCount(0);
    await expect(page.getByText('为你的下一次探索种下了一点灵感', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '继续你的探索', exact: true })).toHaveCount(0);
    await expect(page.locator('.related-section, .article-end')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '复制文章链接', exact: true })).toBeVisible();
    if (entry.tags.length === 0) continue;
    const tags = page.getByRole('navigation', { name: '文章标签', exact: true }).getByRole('link');
    await expect(tags).toHaveText(entry.tags.map((tag) => `#${tag}`));
    for (let index = 0; index < entry.tags.length; index++) {
      await expect(tags.nth(index)).toHaveAttribute('href', `/posts/?tag=${encodeURIComponent(entry.tags[index])}`);
    }
    await tags.first().click();
    await expect(page).toHaveURL(`/posts/?tag=${encodeURIComponent(entry.tags[0])}`);
    await expect(page.locator('[data-post-row]:visible').first()).toBeVisible();
  }
});

test('单作者博客只显示日期与阅读时长，不显示头像或作者署名', async ({ page }) => {
  for (const path of ['/posts/shader-landscape/', '/posts/css-design-tokens/']) {
    await page.goto(path);
    const metadata = page.locator('.post-detail-meta');
    await expect(metadata).toHaveText(/^\d{4}年\d+月\d+日\s*·\s*\d+\s*分钟阅读$/);
    await expect(metadata.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
    await expect(metadata.locator('.meta-dot')).toHaveCount(1);
    await expect(page.locator('.author-avatar')).toHaveCount(0);
    const structuredData = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() || '{}');
    expect(structuredData.author).toMatchObject({ '@type': 'Person' });
    expect(structuredData.author.name).toBeTruthy();
  }
});

test('文章标题、封面与正文共享最大 640px 的居中阅读栏', async ({ page }) => {
  for (const path of ['/posts/shader-landscape/', '/posts/astro-islands/']) {
    await page.goto(path);
    const layout = await page.evaluate(() => {
      const body = document.querySelector('#article-content')!.getBoundingClientRect();
      const header = document.querySelector('.post-detail-header')!.getBoundingClientRect();
      const cover = document.querySelector('.post-detail-cover')!.getBoundingClientRect();
      return {
        width: body.width,
        center: body.left + body.width / 2,
        viewport: innerWidth,
        headerWidth: header.width,
        headerLeft: header.left,
        coverWidth: cover.width,
        coverLeft: cover.left,
        bodyLeft: body.left,
      };
    });
    expect(layout.width).toBeLessThanOrEqual(640);
    expect(Math.abs(layout.center - layout.viewport / 2)).toBeLessThan(1);
    expect(layout.headerWidth).toBeCloseTo(layout.width, 0);
    expect(layout.coverWidth).toBeCloseTo(layout.width, 0);
    expect(layout.headerLeft).toBeCloseTo(layout.bodyLeft, 0);
    expect(layout.coverLeft).toBeCloseTo(layout.bodyLeft, 0);
    if (layout.viewport >= 1160) {
      await expect(page.locator('.toc')).toBeVisible();
    } else {
      await expect(page.locator('.toc')).toBeHidden();
    }
  }
});

test('阅读宽度不会随大屏增长，目录在平板断点不挤占正文', async ({ page, isMobile }) => {
  test.skip(isMobile, '额外的阅读断点在桌面项目中覆盖');
  for (const width of [320, 390, 640, 760, 768, 1000, 1050, 1159, 1160, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/posts/shader-landscape/');
    const layout = await page.evaluate(() => {
      const body = document.querySelector('#article-content')!.getBoundingClientRect();
      const toc = document.querySelector('.toc')!.getBoundingClientRect();
      return {
        width: body.width,
        center: body.left + body.width / 2,
        bodyRight: body.right,
        tocLeft: toc.left,
        tocRight: toc.right,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(layout.width, `${width}px`).toBeLessThanOrEqual(640);
    expect(Math.abs(layout.center - width / 2), `${width}px`).toBeLessThan(1);
    expect(layout.overflow, `${width}px`).toBe(false);
    if (width >= 1160) {
      await expect(page.locator('.toc')).toBeVisible();
      expect(layout.width).toBe(640);
      expect(layout.tocLeft - layout.bodyRight).toBeGreaterThanOrEqual(40);
      expect(layout.tocRight).toBeLessThanOrEqual(width);
    } else {
      await expect(page.locator('.toc')).toBeHidden();
    }
  }
  await page.locator('.toc').evaluate((element) => element.remove());
  const body = await page.locator('#article-content').boundingBox();
  expect(body?.width).toBe(640);
  expect(body!.x + body!.width / 2).toBe(960);
});

test('阅读进度、目录定位与高亮可用', async ({ page, isMobile }) => {
  test.skip(isMobile, '移动端为阅读正文隐藏侧栏目录');
  await page.goto('/posts/shader-landscape/');
  const link = page.locator('.toc').getByRole('link', { name: '让参数变得可见', exact: true });
  await link.click();
  await expect(page).toHaveURL(/#/);
  await expect(link).toHaveAttribute('aria-current', 'location');
  const transform = await page.locator('#reading-progress-bar').evaluate((element) => getComputedStyle(element).transform);
  expect(transform).not.toEqual('matrix(0, 0, 0, 1, 0, 0)');
});

test('减少动态效果时默认暂停，仍可主动播放与暂停', async ({ page }) => {
  await page.goto('/projects/trefoil-knot/');
  await expect(page.locator('[data-art-pause]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-art-pause]')).toContainText('PAUSED');
  await page.getByRole('button', { name: '播放图形动画' }).click();
  await expect(page.locator('[data-art-pause]')).toContainText('LIVE');
  await page.getByRole('button', { name: '暂停图形动画' }).click();
  await expect(page.locator('[data-art-pause]')).toContainText('PAUSED');
});

test('作品详情页不显示星号、英文标语、示例标记和标签', async ({ page }) => {
  for (const path of publicPages.filter((path) => path.startsWith('/projects/') && path !== '/projects/')) {
    await page.goto(path);
    const header = page.locator('.project-detail > header');
    await expect(header.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(header.getByRole('link', { name: '回到作品', exact: true })).toBeVisible();
    await expect(header.locator('.project-detail-lead')).toBeVisible();
    await expect(header.locator('.eyebrow, .tiny-star, .project-example, .project-detail-tags')).toHaveCount(0);
    for (const text of ['✳', 'A LITTLE TOOL', 'A CREATIVE EXPERIMENT', '站内示例', '展示页']) {
      await expect(header).not.toContainText(text);
    }
    await expect(page.locator('.project-stage')).toBeVisible();
  }
});

test('页面不显示持续更新或不断更新等标语及突兀的英文小标', async ({ page }) => {
  for (const path of ['/', '/posts/', '/projects/', '/about/']) {
    await page.goto(path);
    for (const slogan of ['持续更新中', '不断更新中', '持续学习中', 'THE COLLECTION', 'SELECTED WRITING', 'THE LATEST', 'THINGS I\'VE BUILT', 'THE ARCHIVE', 'THE HUMAN BEHIND', 'ALWAYS A WORK IN PROGRESS', '展示页', '站内示例']) {
      await expect(page.locator('body')).not.toContainText(slogan);
    }
  }
  await page.goto('/projects/');
  await expect(page.locator('.page-count')).not.toContainText('更新');
  await page.goto('/posts/');
  await expect(page.locator('.page-intro, .archive-summary, .archive-search')).toHaveCount(0);
});

test('作品入口、项目卡片与三个独立展示页可以直接体验', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('[data-project-preview]')).toHaveCount(2);
  await expect(page.locator('.project-preview-meta, .project-preview-kind, .project-preview-arrow, .project-card-tags, .project-card-meta')).toHaveCount(0);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '作品', exact: true }).click();
  await expect(page).toHaveURL('/projects/');
  await expect(page.locator('[data-project-card]')).toHaveCount(3);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('作品');
  await expect(page.locator('.project-card-meta, .project-card-tags')).toHaveCount(0);
  for (const card of await page.locator('[data-project-card]').all()) {
    expect((await request.get((await card.getAttribute('href'))!)).ok()).toBeTruthy();
  }
  await page.locator('[data-project-card="noise-landscape"]').click();
  await expect(page).toHaveURL('/projects/noise-landscape/');
  await expect(page.locator('.terrain-canvas')).toBeVisible();
  await page.locator('[data-amplitude]').evaluate((element: HTMLInputElement) => {
    element.value = '60';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('[data-amplitude-output]')).toHaveText('60');
  await page.getByRole('link', { name: '回到作品' }).click();
  await page.locator('[data-project-card="trefoil-knot"]').click();
  await expect(page).toHaveURL('/projects/trefoil-knot/');
  await expect(page.locator('#generative-art')).toBeVisible();
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '作品', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: '播放图形动画' }).click();
  await expect(page.locator('[data-art-pause]')).toContainText('LIVE');
  await page.getByRole('button', { name: '暂停图形动画' }).click();
  await expect(page.locator('[data-art-pause]')).toContainText('PAUSED');
});

test('月历默认当月，全年视图渲染农历、假期标记与两组倒计时，并可切换年份', async ({ page }) => {
  await page.goto('/projects/year-calendar/');
  const label = page.locator('[data-year-output]');
  const root = page.locator('[data-holiday-calendar]');
  const yearPanels = page.locator('[data-months-year]');
  const monthPanel = page.locator('[data-months-month]');
  const currentYear = new Date().getFullYear();
  const initialYear = Number((await root.getAttribute('data-year')) ?? '0');

  // 默认就是当月视图，全年 12 个月此时是隐藏的。
  await expect(monthPanel).toBeVisible();
  await expect(monthPanel.locator('.hc-month')).toHaveCount(1);
  await expect(yearPanels).toBeHidden();

  await page.getByRole('button', { name: '全年', exact: true }).click();
  await expect(yearPanels).toBeVisible();
  await expect(monthPanel).toBeHidden();
  await expect(yearPanels.locator('.hc-month')).toHaveCount(12);
  await expect(yearPanels.locator('.hc-day.is-holiday').first()).toBeVisible();
  await expect(yearPanels.locator('.hc-day.is-work').first()).toBeVisible();
  await expect(yearPanels.locator('.hc-day.is-today')).toHaveCount(initialYear === currentYear ? 1 : 0);
  await expect(page.locator('.hc-rows').first().locator('.hc-row')).not.toHaveCount(0);
  await expect(page.locator('[data-progress-output]')).toContainText('已过');

  // 假期统计：三个汇总数字 + 每个假期一行，且汇总与明细一致。
  const statsOutput = page.locator('[data-stats-output]');
  await expect(page.locator('[data-stats-year]')).toHaveText(String(initialYear));
  const statNumbers = (await statsOutput.locator('.hc-stats strong').allTextContents()).map(Number);
  expect(statNumbers).toHaveLength(3);
  const rowInfos = await statsOutput.locator('.hc-stat-rows .hc-row > .hc-row-info').allTextContents();
  const holidaySum = rowInfos.reduce((sum, text) => sum + Number(text.match(/(\d+) 天$/)?.[1] ?? 0), 0);
  expect(holidaySum).toBeGreaterThan(0);
  expect(statNumbers[0]).toBe(holidaySum);
  expect(statNumbers[2]).toBe(holidaySum - statNumbers[1]);
  // 一天一个圆点：实心是法定假期，空心是调休上班，总数与汇总一致；行内不再列调休日期。
  const statRows = statsOutput.locator('.hc-stat-rows .hc-row');
  await expect(statsOutput.locator('.hc-row-sub')).toHaveCount(0);
  await expect(statsOutput.locator('.hc-stat.is-holiday .hc-dot.is-holiday')).toHaveCount(1);
  await expect(statsOutput.locator('.hc-stat.is-comp .hc-dot.is-comp')).toHaveCount(1);
  await expect(statRows.locator('.hc-dot.is-holiday')).toHaveCount(statNumbers[0]);
  await expect(statRows.locator('.hc-dot.is-comp')).toHaveCount(statNumbers[1]);
  for (const row of await statRows.all()) {
    const days = Number(((await row.locator('.hc-row-info').textContent()) ?? '').match(/· (\d+) 天$/)?.[1] ?? 0);
    await expect(row.locator('.hc-dot.is-holiday')).toHaveCount(days);
  }

  await page.getByRole('button', { name: '上一年' }).click();
  await expect(label).toHaveText(`${initialYear - 1} 年`);
  await expect(yearPanels.locator('.hc-month')).toHaveCount(12);
  await expect(yearPanels.locator(`.hc-day[data-date="${initialYear - 1}-01-01"]`)).toHaveCount(1);
  await expect(yearPanels.locator('.hc-day.is-today')).toHaveCount(0);
  // 统计跟着年份走。
  await expect(page.locator('[data-stats-year]')).toHaveText(String(initialYear - 1));
  const prevStatNumbers = (await statsOutput.locator('.hc-stats strong').allTextContents()).map(Number);
  expect(prevStatNumbers).not.toEqual(statNumbers);

  await page.getByRole('button', { name: '回到今年' }).click();
  await expect(label).toHaveText(`${initialYear} 年`);
  await expect(yearPanels.locator('.hc-day.is-today')).toHaveCount(initialYear === currentYear ? 1 : 0);
  await expect(page.locator('[data-stats-year]')).toHaveText(String(initialYear));
  await expect(statsOutput.locator('.hc-stats strong').first()).toHaveText(String(statNumbers[0]));
});

test('月历支持全年与当月两种视图，并可记住选择', async ({ page }) => {
  await page.goto('/projects/year-calendar/');
  const yearPanels = page.locator('[data-months-year]');
  const monthPanel = page.locator('[data-months-month]');
  const label = page.locator('[data-year-output]');
  const root = page.locator('[data-holiday-calendar]');
  const initialYear = Number((await root.getAttribute('data-year')) ?? '0');
  const currentMonth = new Date().getMonth() + 1;

  // 默认打开当月视图。
  await expect(monthPanel).toBeVisible();
  await expect(monthPanel.locator('.hc-month')).toHaveCount(1);
  await expect(monthPanel.locator('.hc-day-note').first()).toBeVisible();
  await expect(label).toHaveText(`${initialYear} 年 ${currentMonth} 月`);
  await expect(monthPanel.locator('.hc-day.is-today')).toHaveCount(1);
  await expect(yearPanels).toBeHidden();

  await page.getByRole('button', { name: '全年', exact: true }).click();
  await expect(yearPanels).toBeVisible();
  await expect(yearPanels.locator('.hc-month')).toHaveCount(12);
  await expect(monthPanel).toBeHidden();
  await page.getByRole('button', { name: '当月', exact: true }).click();
  await expect(monthPanel).toBeVisible();

  // 「回到本月」在视图切换按钮左边，而且不可用时也占位，所以页头不会跳。
  const viewSwitch = page.locator('[data-view-switch]');
  await expect(page.getByRole('button', { name: '回到本月' })).toHaveCount(0);
  const switchBefore = (await viewSwitch.boundingBox()) ?? { x: 0, width: 0 };

  // 当月视图里箭头换月份，跳年时同步更新年度进度。
  const previous = new Date(initialYear, currentMonth - 2, 1);
  await page.getByRole('button', { name: '上一月' }).click();
  await expect(page.getByRole('button', { name: '回到本月' })).toBeVisible();
  const resetBox = (await page.locator('[data-year-reset]').boundingBox()) ?? { x: 0, width: 0 };
  expect(resetBox.x + resetBox.width).toBeLessThanOrEqual(switchBefore.x + 0.5);
  expect(Math.abs(((await viewSwitch.boundingBox())?.x ?? 0) - switchBefore.x)).toBeLessThan(1);
  await expect(label).toHaveText(`${previous.getFullYear()} 年 ${previous.getMonth() + 1} 月`);
  await expect(page.locator('[data-progress-year]')).toHaveText(String(previous.getFullYear()));

  await page.getByRole('button', { name: '回到本月' }).click();
  await expect(label).toHaveText(`${initialYear} 年 ${currentMonth} 月`);
  await expect(monthPanel.locator('.hc-day.is-today')).toHaveCount(1);

  // 视图选择存在本地，重新打开还是当月视图。
  await page.reload();
  await expect(page.locator('[data-months-month]')).toBeVisible();
  await expect(page.locator('[data-months-year]')).toBeHidden();

  await page.getByRole('button', { name: '全年', exact: true }).click();
  await expect(yearPanels).toBeVisible();
  await expect(yearPanels.locator('.hc-month')).toHaveCount(12);
  await expect(yearPanels.locator('.hc-day.is-today')).toHaveCount(1);

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.getByRole('button', { name: '当月', exact: true }).click();
    await expect(monthPanel.locator('.hc-month')).toHaveCount(1);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  }
});

test('发薪日可以自己设置并记住选择', async ({ page }) => {
  await page.goto('/projects/year-calendar/');
  const rows = page.locator('[data-wage-output] .hc-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.locator('.hc-row-label')).toHaveText('10号');

  await page.locator('[data-pay-input]').fill('20');
  await page.getByRole('button', { name: '添加' }).click();
  await expect(rows).toHaveCount(2);
  await expect(page.locator('[data-pay-chips] .hc-pay-chip')).toHaveCount(2);

  await page.getByRole('button', { name: '移除每月 10 号发薪日' }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.locator('.hc-row-label')).toHaveText('20号');

  await page.getByRole('button', { name: '+ 最后工作日' }).click();
  await expect(rows).toHaveCount(2);

  await page.reload();
  await expect(page.locator('[data-wage-output] .hc-row')).toHaveCount(2);
  await expect(page.locator('[data-wage-output] .hc-row-label')).toHaveText(['20号', '最后工作日']);
});

test('发薪进度条按上一次发薪到这次发薪的周期计算', async ({ page }) => {
  await page.goto('/projects/year-calendar/');
  const rows = page.locator('[data-wage-output] .hc-row');
  await expect(rows).toHaveCount(1);

  // 分母是上一次发薪到这次发薪的总天数，分子是已经过去的天数。
  const cycleTitle = (await rows.first().getAttribute('title')) ?? '';
  expect(cycleTitle).toMatch(/^本发薪周期已过 \d+ \/ \d+ 天$/);
  const [, passed, total] = cycleTitle.match(/已过 (\d+) \/ (\d+) 天/) ?? [];
  expect(Number(passed)).toBeGreaterThan(0);
  expect(Number(passed)).toBeLessThanOrEqual(Number(total));
  await expect(rows.first().locator('.hc-bar-fill')).toHaveAttribute('style', `width:${Math.round((Number(passed) / Number(total)) * 100)}%`);

  // 把发薪日设成今天：工作日应当算满格并显示「今天发」，撞上周末或假期才顺延。
  const today = new Date();
  const ymd = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const classes = (await page.locator(`.hc-day[data-date="${ymd}"]`).first().getAttribute('class')) ?? '';
  const weekday = today.getDay();
  const isWorkDay = classes.includes('is-work') || (weekday !== 0 && weekday !== 6 && !classes.includes('is-holiday'));

  const day = String(today.getDate());
  await page.locator('[data-pay-input]').fill(day);
  await page.getByRole('button', { name: '添加' }).click();
  const todayRow = page.locator('[data-wage-output] .hc-row').filter({ has: page.locator(`.hc-row-label:text-is("${day}号")`) });
  await expect(todayRow).toHaveCount(1);

  if (isWorkDay) {
    await expect(todayRow.locator('.hc-row-info')).toHaveText('今天发');
    await expect(todayRow.locator('.hc-bar-fill')).toHaveAttribute('style', 'width:100%');
    const todayTitle = (await todayRow.getAttribute('title')) ?? '';
    expect(todayTitle).toMatch(/^本发薪周期已过 \d+ \/ \d+ 天$/);
    const [, todayPassed, todayTotal] = todayTitle.match(/已过 (\d+) \/ (\d+) 天/) ?? [];
    expect(Number(todayPassed)).toBe(Number(todayTotal));
  } else {
    await expect(todayRow.locator('.hc-row-info')).toContainText('顺延至');
  }
});

test('全站页头页脚最大 640px 且居中，导航与操作按钮不越界', async ({ page }) => {
  for (const path of publicPages) {
    await page.goto(path);
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      containers: ['.site-header', '.site-footer'].map((selector) => {
        const element = document.querySelector(selector)!;
        const bounds = element.getBoundingClientRect();
        return {
          selector,
          width: bounds.width,
          left: bounds.left,
          right: bounds.right,
          controls: Array.from(element.querySelectorAll('a, button')).map((control) => {
            const rect = control.getBoundingClientRect();
            return { label: control.getAttribute('aria-label') || control.textContent, left: rect.left, right: rect.right };
          }),
        };
      }),
    }));
    for (const container of layout.containers) {
      const name = `${path} ${container.selector}`;
      expect(container.width, name).toBeLessThanOrEqual(640);
      if (layout.viewport >= 768) expect(container.width, name).toBe(640);
      expect(Math.abs(container.left + container.width / 2 - layout.viewport / 2), name).toBeLessThan(1);
      for (const control of container.controls) {
        expect(control.left, `${name} ${control.label}`).toBeGreaterThanOrEqual(container.left - 1);
        expect(control.right, `${name} ${control.label}`).toBeLessThanOrEqual(container.right + 1);
      }
    }
  }
});

test('作品画廊保持宽版，页头页脚和文章保留窄版布局', async ({ page, isMobile }) => {
  test.skip(isMobile, '桌面测试额外覆盖作品画廊的所有断点');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects/');
  await expect(page.locator('body')).toHaveClass('layout-wide');
  const main = await page.locator('#main-content').boundingBox();
  expect(main!.width).toBeGreaterThan(1280);
  // 作品变多时卡片会变窄，但画廊仍然铺满宽版容器。
  const gallery = await page.locator('.projects-grid').boundingBox();
  expect(gallery!.width).toBeCloseTo(main!.width, 0);
  expect((await page.locator('[data-project-card]').first().boundingBox())!.width).toBeGreaterThan(main!.width / 4);
  expect((await page.locator('.projects-intro').boundingBox())!.height).toBeLessThan(210);
  for (const selector of ['.site-header', '.site-footer']) {
    const box = await page.locator(selector).boundingBox();
    expect(box!.width).toBe(640);
    expect(box!.width).toBeLessThan(main!.width);
    expect(box!.x + box!.width / 2).toBeCloseTo(main!.x + main!.width / 2, 0);
  }

  // 只在测试 DOM 中补足卡片，验证真实清单扩展时的网格；不增加公开示例。
  await page.locator('.projects-grid').evaluate((grid) => {
    const templates = Array.from(grid.children);
    while (grid.children.length < 10) {
      const index = grid.children.length;
      const card = templates[index % templates.length].cloneNode(true) as HTMLElement;
      card.dataset.projectCard = `fixture-${index}`;
      if (index === 2) card.querySelector('h3')!.textContent = '一件带有更长名称的测试作品，用于验证卡片对齐';
      grid.append(card);
    }
  });
  let previousColumns = 0;
  for (const width of [320, 390, 640, 768, 1050, 1280, 1440, 1600, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    // 连续调整视口时，等媒体查询与布局在渲染帧中生效。
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const layout = await page.evaluate(() => {
      const gallery = document.querySelector('.projects-grid')!;
      const bounds = gallery.getBoundingClientRect();
      const cards = Array.from(gallery.children);
      const top = cards[0].getBoundingClientRect().top;
      const firstRow = cards.filter((card) => Math.abs(card.getBoundingClientRect().top - top) < 1);
      const style = getComputedStyle(gallery);
      const header = document.querySelector('.site-header')!.getBoundingClientRect();
      const footer = document.querySelector('.site-footer')!.getBoundingClientRect();
      return {
        width: bounds.width,
        center: bounds.left + bounds.width / 2,
        viewport: document.documentElement.clientWidth,
        gap: parseFloat(style.columnGap),
        trackMin: parseFloat(style.getPropertyValue('--gallery-track-min')) * parseFloat(getComputedStyle(document.documentElement).fontSize),
        columns: style.gridTemplateColumns.split(' ').filter((track) => parseFloat(track) > 0).length,
        actionBottoms: firstRow.map((card) => card.querySelector('.project-card-action')!.getBoundingClientRect().bottom),
        headerWidth: header.width,
        footerWidth: footer.width,
        headerCenter: header.left + header.width / 2,
        footerCenter: footer.left + footer.width / 2,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    // auto-fit：能排下几列就排几列，作品变多时列数只增不减。
    const expectedColumns = Math.max(1, Math.floor((layout.width + layout.gap) / (layout.trackMin + layout.gap)));
    expect(layout.columns, `${width}px`).toBe(expectedColumns);
    expect(layout.columns, `${width}px`).toBeGreaterThanOrEqual(previousColumns);
    previousColumns = layout.columns;
    expect(layout.width, `${width}px`).toBeLessThanOrEqual(1800);
    expect(Math.abs(layout.center - layout.viewport / 2), `${width}px`).toBeLessThan(1);
    expect(Math.max(...layout.actionBottoms) - Math.min(...layout.actionBottoms), `${width}px`).toBeLessThan(1);
    expect(layout.overflow, `${width}px`).toBe(false);
    expect(layout.headerWidth, `${width}px`).toBeCloseTo(layout.footerWidth, 0);
    expect(layout.headerWidth, `${width}px`).toBeLessThanOrEqual(640);
    expect(Math.abs(layout.headerCenter - layout.viewport / 2), `${width}px`).toBeLessThan(1);
    expect(Math.abs(layout.footerCenter - layout.viewport / 2), `${width}px`).toBeLessThan(1);
    if (width >= 768) {
      expect(layout.headerWidth, `${width}px`).toBe(640);
      expect(layout.headerWidth, `${width}px`).toBeLessThan(layout.width);
    }
  }
  expect((await page.locator('#main-content').boundingBox())!.width).toBe(1800);
  await page.goto('/posts/shader-landscape/');
  await expect(page.locator('body')).not.toHaveClass(/layout-wide/);
  expect((await page.locator('#article-content').boundingBox())!.width).toBe(640);
});

test('随记与随想不再公开或收录，旧示例链接返回 404', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '随记', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '随想', exact: true })).toHaveCount(0);
  await page.goto('/posts/');
  await expect(page.locator('[data-category-filter]')).toHaveCount(0);
  for (const path of ['/notes/', '/posts/digital-garden/', '/posts/learning-in-public/']) {
    expect((await request.get(path)).status()).toBe(404);
  }
  for (const path of ['/search-index.json', '/rss.xml', '/sitemap-0.xml']) {
    const response = await request.get(path);
    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    expect(text).not.toContain('digital-garden');
    expect(text).not.toContain('learning-in-public');
    expect(text).not.toContain('/notes/');
  }
});

test('RSS、搜索、站点地图与 SEO 元数据完整且不泄露草稿', async ({ page, request }) => {
  const index = await request.get('/search-index.json');
  expect(index.ok()).toBeTruthy();
  const entries = await index.json();
  expect(entries).toHaveLength(6);
  expect(JSON.stringify(entries)).not.toContain('draft-growth');
  for (const entry of entries) expect((await request.get(entry.url)).ok()).toBeTruthy();
  const rss = await request.get('/rss.xml');
  expect(rss.ok()).toBeTruthy();
  expect(await rss.text()).toContain('<rss');
  expect(await rss.text()).not.toContain('draft-growth');
  const sitemap = await request.get('/sitemap-0.xml');
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).not.toContain('draft-growth');
  expect(await sitemap.text()).toContain('/projects/noise-landscape/');
  expect(await sitemap.text()).toContain('/projects/trefoil-knot/');
  expect(await sitemap.text()).toContain('/projects/year-calendar/');
  expect((await request.get('/robots.txt')).ok()).toBeTruthy();
  expect((await request.get('/og.png')).ok()).toBeTruthy();
  expect((await request.get('/posts/draft-growth/')).status()).toBe(404);
  await page.goto('/posts/astro-islands/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/posts\/astro-islands\//);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('BlogPosting');
});

test('所有主要页面在当前屏幕宽度无横向溢出或运行时错误', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const path of publicPages) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, path).toBe(false);
    if (path !== '/posts/') {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    } else {
      await expect(page.locator('.archive-main')).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test('320px 与 768px 布局仍然没有横向溢出', async ({ page, isMobile }) => {
  test.skip(isMobile, '桌面测试中额外覆盖窄屏与平板断点');
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of publicPages) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `${width}px ${path}`).toBe(false);
    }
  }
});

test('未知页面显示自定义 404 与返回路径', async ({ page }) => {
  const response = await page.goto('/a-path-that-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('未开垦');
  await page.getByRole('link', { name: '回到花园' }).click();
  await expect(page).toHaveURL('/');
});

for (const path of publicPages) {
  test(`深浅主题通过 WCAG AA 自动检查：${path}`, async ({ page }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
    }
  });
}

test('搜索弹窗在深浅主题均通过 WCAG AA 自动检查', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await page.getByRole('button', { name: '搜索文章', exact: true }).click();
    await expect(page.locator('.search-result')).toHaveCount(6);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await page.keyboard.press('Escape');
  }
});
