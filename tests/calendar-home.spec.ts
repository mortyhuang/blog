import { test, expect } from '@playwright/test';

test('独立日历首页和主站链接', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-holiday-calendar]')).toBeVisible();
  await expect(page.locator('.site-header')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '返回主站' })).toHaveAttribute('href', 'https://themori.space/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://calendar.themori.space/');
});
