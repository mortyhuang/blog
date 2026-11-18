import { test, expect } from '@playwright/test';

test('游戏首页和控制按钮', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#gameCanvas')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fly.themori.space/');
  await page.locator('#btn-theme-color').click();
  await expect(page.locator('#theme-color-label')).toHaveText('红涨绿跌(A股)');
});
