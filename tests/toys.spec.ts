import { test, expect } from '@playwright/test';

test('toys navigation, canonical URLs and legacy redirects', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: 'toys', exact: true }).click();
  await expect(page).toHaveURL('/toys/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('toys.');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/toys\/$/);
  await expect(page.locator('a[href^="/projects/"]')).toHaveCount(0);
  for (const suffix of ['', 'noise-landscape/', 'trefoil-knot/', 'year-calendar/', 'scratch-card/']) {
    await page.goto(`/projects/${suffix}`);
    await expect(page).toHaveURL(`/toys/${suffix}`);
    await expect(page.locator('a[href^="/projects/"]')).toHaveCount(0);
  }
});
