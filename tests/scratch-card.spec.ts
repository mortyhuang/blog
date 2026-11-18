import { test, expect } from '@playwright/test';
import { createScratchTicket, scratchGames, ticketAward, zoneAward, type ScratchZone } from '../src/lib/scratch-card';

const zone = (kind: ScratchZone['kind'], values: string[], prize = 10): ScratchZone => ({ id: 'test', label: '', group: '', kind, values, prize });

test('all official rule branches and cumulative awards', () => {
  expect(zoneAward('dragon', zone('number', ['12']), ['12'])).toBe(10);
  expect(zoneAward('dragon', zone('number', ['13']), ['12'])).toBe(0);
  expect(zoneAward('dragon', zone('number', ['龙']), [])).toBe(10);
  expect(zoneAward('five', zone('number', ['5']), [])).toBe(50);
  expect(zoneAward('five', zone('number', ['18']), ['12', '18'])).toBe(10);
  expect(zoneAward('arena', zone('duel', ['8', '7']), [])).toBe(10);
  expect(zoneAward('arena', zone('duel', ['7', '7']), [])).toBe(0);
  expect(zoneAward('arena', zone('duel', ['6', '7']), [])).toBe(0);
  expect(zoneAward('arena', zone('duel', ['擂鼓', '7']), [])).toBe(50);
  expect(zoneAward('six', zone('cash', ['¥20'], 20), [])).toBe(20);
  expect(zoneAward('six', zone('cash', ['谢谢参与'], 0), [])).toBe(0);
  expect(zoneAward('six', zone('triple', ['元宝', '元宝', '元宝']), [])).toBe(10);
  expect(zoneAward('six', zone('triple', ['元宝', '元宝', '灯笼']), [])).toBe(0);
  for (const values of [['6', '元宝', '灯笼'], ['元宝', '6', '灯笼'], ['元宝', '灯笼', '6']]) {
    expect(zoneAward('six', zone('triple', values), [])).toBe(60);
  }
  expect(zoneAward('six', zone('thumb', ['赞']), [])).toBe(60);
  expect(zoneAward('six', zone('thumb', ['花']), [])).toBe(0);
  expect(ticketAward({ game: 'six', winning: [], zones: [zone('cash', ['¥20'], 20), zone('triple', ['6', '元宝', '灯笼']), zone('thumb', ['赞'])] })).toBe(140);
});

test('seeded demonstration tickets stay within advertised prize tiers', () => {
  let seed = 2026;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const branches = new Set<string>();
  for (const definition of scratchGames) {
    const totals = new Set<number>();
    for (let i = 0; i < 1500; i++) {
      const ticket = createScratchTicket(definition.id, random);
      const amount = ticketAward(ticket);
      if (![0, ...definition.tiers].includes(amount)) throw new Error(`${definition.id}: invalid total ${amount}`);
      totals.add(amount);
      if (new Set(ticket.zones.map((item) => item.id)).size !== ticket.zones.length) throw new Error('Duplicate zone ID');
      for (const item of ticket.zones) {
        if (item.prize < 0 || !Number.isInteger(item.prize)) throw new Error('Invalid printed prize');
        if (zoneAward(ticket.game, item, ticket.winning)) branches.add(`${ticket.game}:${item.kind}:${item.values.includes('6') ? '6' : item.values[0]}`);
      }
    }
    expect(totals.size).toBe(definition.tiers.length + 1);
  }
  expect(branches.has('dragon:number:龙')).toBe(true);
  expect(branches.has('five:number:5')).toBe(true);
  expect(branches.has('arena:duel:擂鼓')).toBe(true);
  expect(branches.has('six:triple:6')).toBe(true);
  expect(branches.has('six:thumb:赞')).toBe(true);
});

for (const definition of scratchGames) {
  test(`${definition.name}: switch, reveal, tally and reset`, async ({ page }) => {
    await page.goto('/toys/scratch-card/');
    const game = page.locator('.scratch-game');
    const picker = game.locator(`[data-game="${definition.id}"]`);
    await expect(picker).toBeEnabled();
    await picker.click();
    await expect(picker).toHaveAttribute('aria-pressed', 'true');
    await expect(game.locator('.ticket-name')).toHaveText(definition.name);
    const expectedZones = definition.id === 'arena' ? 4 : definition.id === 'six' ? 8 : 9;
    await expect(game.locator('.scratch-area')).toHaveCount(expectedZones);
    await expect(game.locator('.progress-text')).toHaveText('0%');
    await game.locator('.zone-overlay').first().focus();
    await page.keyboard.press('Enter');
    await expect(game.locator('.zone-overlay:disabled')).toHaveCount(1);
    await expect(game.getByRole('status')).toContainText(`1 / ${expectedZones}`);
    await game.getByRole('button', { name: '直接揭晓' }).click();
    await expect(game.locator('.progress-text')).toHaveText('100%');
    await expect(game.getByRole('status')).toContainText('本张');
    const awards = await game.locator('.is-win .zone-value small:last-child').allTextContents();
    const total = awards.reduce((sum, value) => sum + Number(value.replace(/[^\d]/g, '')), 0);
    if (total) await expect(game.getByRole('status')).toContainText(`¥${total.toLocaleString()}`);
    else await expect(game.getByRole('status')).toContainText('未中奖');
    await expect(game.getByRole('button', { name: '直接揭晓' })).toBeDisabled();
    const oldSerial = await game.locator('.ticket-number').textContent();
    await game.getByRole('button', { name: '再来一张' }).click();
    await expect(game.locator('.ticket-number')).not.toHaveText(oldSerial!);
    await expect(game.locator('.progress-text')).toHaveText('0%');
    await expect(game.locator('.zone-overlay:disabled')).toHaveCount(0);
    await expect(game.locator('.is-win')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('pointer scratching reveals only the touched region', async ({ page, isMobile }) => {
  await page.goto('/toys/scratch-card/');
  await expect(page.locator('[data-reveal]')).toBeEnabled();
  const canvas = page.locator('.scratch-game canvas').first();
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  if (isMobile) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 5, y: box.y + 10 }] });
    for (let row = 0; row < 4; row++) {
      const y = box.y + 10 + row * 14;
      for (let step = 0; step <= 12; step++) {
        const fraction = row % 2 ? 1 - step / 12 : step / 12;
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 5 + fraction * (box.width - 10), y }] });
      }
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    for (let y = 8; y < box.height; y += 14) {
      await page.mouse.move(box.x + 5, box.y + y);
      await page.mouse.move(box.x + box.width - 5, box.y + y, { steps: 12 });
    }
    await page.mouse.up();
  }
  await expect(page.locator('.zone-overlay:disabled')).toHaveCount(1);
  await expect(canvas).toHaveClass('revealed');
  await expect(page.locator('.progress-text')).not.toHaveText('100%');
  await expect(page.locator('.game-status')).toContainText('1 / 9');
});
