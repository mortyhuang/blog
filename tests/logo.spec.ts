import { test, expect } from '@playwright/test';

test('logo spins quickly then coasts to a stop even after pointer leave', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Hover animation is a mouse interaction');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const logo = page.locator('.site-header .brand');
  const symbol = logo.locator('.brand-symbol');
  await logo.hover();
  const timing = await symbol.evaluate(async (element) => {
    const spin = element.getAnimations().find((animation) => animation.effect instanceof KeyframeEffect && animation.effect.getKeyframes().some((frame) => 'transform' in frame))!;
    await spin.ready;
    spin.pause();
    await spin.ready;
    const effect = spin.effect!;
    const result = { duration: effect.getTiming().duration, easing: effect.getTiming().easing, early: 0, late: 0 };
    spin.currentTime = 300;
    result.early = effect.getComputedTiming().progress!;
    spin.currentTime = 900;
    result.late = effect.getComputedTiming().progress!;
    spin.play();
    return result;
  });
  expect(timing.duration).toBe(1200);
  expect(timing.easing).toBe('cubic-bezier(0.12, 0.7, 0.18, 1)');
  expect(timing.early).toBeGreaterThan(0.65);
  expect(1 - timing.late).toBeLessThan(0.05);
  await page.mouse.move(0, 0);
  await expect.poll(() => symbol.evaluate((element) => element.getAnimations().filter((animation) => animation.effect instanceof KeyframeEffect && animation.effect.getKeyframes().some((frame) => 'transform' in frame)).length)).toBe(0);
  await expect(symbol).toHaveCSS('transform', 'none');
});

test('logo respects reduced motion', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Hover animation is a mouse interaction');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const logo = page.locator('.site-header .brand');
  await logo.hover();
  await expect(logo.locator('.brand-symbol')).toHaveCSS('transform', 'none');
  expect(await logo.locator('.brand-symbol').evaluate((element) => element.getAnimations().filter((animation) => animation.effect instanceof KeyframeEffect && animation.effect.getKeyframes().some((frame) => 'transform' in frame)).length)).toBe(0);
});
