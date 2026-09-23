import { expect, test } from '@playwright/test';
import { createTwoPlayerRoom, finishByFolding } from './helpers.js';

test('two humans finish ten hands, reconnect, and return to a rematch room', async ({ browser }) => {
  test.setTimeout(45_000);
  const game = await createTwoPlayerRoom(browser);
  await game.host.getByRole('button', { name: '开始牌局' }).click();
  await expect(game.host.getByTestId('self-hole-cards')).toBeVisible();
  await expect(game.guest.getByTestId('self-hole-cards')).toBeVisible();

  await game.guestContext.setOffline(true);
  await game.guest.waitForTimeout(700);
  await game.guestContext.setOffline(false);
  await expect(game.guest.getByTestId('self-hole-cards')).toBeVisible({ timeout: 8_000 });
  await finishByFolding(game.host, game.guest);
  await game.host.getByRole('button', { name: '再来一局' }).click();
  await expect(game.guest.getByRole('heading', { name: '等大家入座' })).toBeVisible();

  await game.hostContext.close();
  await game.guestContext.close();
});
