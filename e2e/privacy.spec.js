import { expect, test } from '@playwright/test';
import { createTwoPlayerRoom } from './helpers.js';

function captureFrames(page) {
  const frames = [];
  page.on('websocket', socket => socket.on('framereceived', event => {
    try { frames.push(JSON.parse(event.payload)); } catch { /* ignore non-JSON frames */ }
  }));
  return frames;
}

test('recipient views never expose the other player cards or session token', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const hostFrames = captureFrames(host);
  const guestFrames = captureFrames(guest);

  await host.goto('/');
  await host.getByLabel('昵称').fill('隐私房主');
  await host.getByRole('button', { name: '创建好友房' }).click();
  const code = (await host.getByTestId('room-code').textContent()).trim();
  while (await host.getByRole('button', { name: /移除电脑玩家/ }).count()) {
    const buttons = host.getByRole('button', { name: /移除电脑玩家/ });
    const previous = await buttons.count();
    await buttons.first().dispatchEvent('click');
    await expect(buttons).toHaveCount(previous - 1);
  }
  await guest.goto('/');
  await guest.getByLabel('昵称').fill('隐私朋友');
  await guest.getByLabel('房间码或邀请链接').fill(code);
  await guest.getByRole('button', { name: '加入房间' }).click();
  await host.getByRole('button', { name: '开始牌局' }).click();
  await expect(guest.getByTestId('self-hole-cards')).toBeVisible();

  const hostSession = hostFrames.find(frame => frame.type === 'session.ready');
  const guestSession = guestFrames.find(frame => frame.type === 'session.ready');
  const hostState = [...hostFrames].reverse().find(frame => frame.type === 'room.state' && frame.payload.phase === 'playing');
  const guestState = [...guestFrames].reverse().find(frame => frame.type === 'room.state' && frame.payload.phase === 'playing');
  expect(hostState.payload.game.players[guestSession.payload.playerId].holeCards).toBeUndefined();
  expect(guestState.payload.game.players[hostSession.payload.playerId].holeCards).toBeUndefined();
  expect(JSON.stringify(hostFrames)).not.toContain(guestSession.payload.token);
  expect(JSON.stringify(guestFrames)).not.toContain(hostSession.payload.token);

  await hostContext.close();
  await guestContext.close();
});

test('spectator role has no action controls', async ({ browser }) => {
  const game = await createTwoPlayerRoom(browser);
  await game.host.getByRole('button', { name: '开始牌局' }).click();
  const spectatorContext = await browser.newContext();
  const spectator = await spectatorContext.newPage();
  await spectator.goto('/');
  await spectator.getByLabel('昵称').fill('河岸观众');
  await spectator.getByLabel('房间码或邀请链接').fill(game.code);
  await spectator.getByRole('button', { name: '加入房间' }).click();
  await expect(spectator.getByText('观战模式')).toBeVisible();
  await expect(spectator.getByLabel('牌局操作')).toHaveCount(0);
  await game.hostContext.close();
  await game.guestContext.close();
  await spectatorContext.close();
});
