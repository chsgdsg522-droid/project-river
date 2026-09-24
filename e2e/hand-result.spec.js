import { expect, test } from '@playwright/test';
import { createTwoPlayerRoom } from './helpers.js';

test('practice pauses on real hand results, stays readable on mobile, then continues on demand', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  let state;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
    const message = JSON.parse(payload);
    if (message.type === 'room.state') state = message.payload;
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByLabel('昵称').fill('河岸_玩家-123456789012345');
  await page.getByLabel('浅色').check();
  await page.getByLabel('静音').check();
  await page.getByRole('button', { name: '单人练习' }).click();
  await expect(page.getByTestId('self-hole-cards')).toBeVisible();
  // Play one real hand against production bots, without manufacturing results.
  for (let step = 0; step < 240 && !state?.game?.lastHandResult; step += 1) {
    const action = page.getByRole('button', { name: /过牌 Check|跟注 Call/ });
    if (await action.isVisible().catch(() => false) && await action.isEnabled().catch(() => false)) await action.click();
    await page.waitForTimeout(250);
  }
  const result = page.getByRole('region', { name: '本手结果' });
  await expect(result).toBeVisible();
  const handId = state.handId;
  const expectedPlayers = Object.values(state.game.players).filter(player => !player.folded && (
    state.game.lastHandResult.hands[player.id] || state.game.lastHandResult.winnerIds.includes(player.id)
  ));
  await expect(result.locator('.showdown-player')).toHaveCount(expectedPlayers.length);
  await expect(result.getByLabel('获胜 Winner')).toHaveCount(state.game.lastHandResult.winnerIds.length);
  await expect(page.getByRole('switch', { name: '显示学习辅助' })).toHaveCount(0);
  await expect(page.getByLabel('牌局操作')).toHaveCount(0);
  await page.waitForTimeout(9_000);
  expect(state.handId).toBe(handId);
  await expect(result).toBeVisible();
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: testInfo.outputPath('result-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: testInfo.outputPath('result-mobile.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(result.locator('.hand-winner__icon').first()).toHaveCSS('animation-name', 'none');
  const next = page.getByRole('button', { name: /下一手 Next hand|查看总排名 Results/ });
  await next.click();
  await expect(result).toHaveCount(0);
  if (state.phase !== 'results') expect(state.handId).not.toBe(handId);
  expect(errors).toEqual([]);
});

test('friend showdown reveals both eligible hands, marks winners, and retains results before the next hand', async ({ browser }) => {
  let state;
  const game = await createTwoPlayerRoom(browser, { configurePages: async host => {
    host.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
      const message = JSON.parse(payload);
      if (message.type === 'room.state') state = message.payload;
    }));
  } });
  try {
    await game.host.getByRole('button', { name: '开始牌局' }).click();
    await expect(game.host.getByTestId('self-hole-cards')).toBeVisible();
    for (let step = 0; step < 60 && !state?.game?.lastHandResult; step += 1) {
      for (const page of [game.host, game.guest]) {
        const action = page.getByRole('button', { name: /过牌 Check|跟注 Call/ });
        if (await action.isVisible().catch(() => false) && await action.isEnabled().catch(() => false)) await action.click();
      }
      await game.host.waitForTimeout(100);
    }
    const result = game.host.getByRole('region', { name: '本手结果' });
    await expect(result).toBeVisible();
    expect(state.game.lastHandResult.reason).toBe('showdown');
    await expect(result.locator('.showdown-player')).toHaveCount(2);
    await expect(result.locator('.showdown-player .poker-card:not(.poker-card--back)')).toHaveCount(4);
    await expect(result.getByLabel('获胜 Winner')).toHaveCount(state.game.lastHandResult.winnerIds.length);
    await expect(result.getByText(/秒后下一手/)).toBeVisible();
    const handId = state.handId;
    await game.host.waitForTimeout(3_000);
    expect(state.handId).toBe(handId);
    await expect(result).toHaveCount(0, { timeout: 8_000 });
    expect(state.game.handNumber).toBe(2);
  } finally {
    await game.hostContext.close();
    await game.guestContext.close();
  }
});
