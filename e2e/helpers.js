import { expect } from '@playwright/test';

export async function setIdentity(page, name) {
  await page.goto('/');
  await page.getByLabel('昵称').fill(name);
}

export async function createTwoPlayerRoom(browser) {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await setIdentity(host, '河岸房主');
  await host.getByRole('button', { name: '创建好友房' }).click();
  const code = (await host.getByTestId('room-code').textContent()).trim();
  while (await host.getByRole('button', { name: /移除电脑玩家/ }).count()) {
    const buttons = host.getByRole('button', { name: /移除电脑玩家/ });
    const previous = await buttons.count();
    await buttons.first().dispatchEvent('click');
    await expect(buttons).toHaveCount(previous - 1);
  }

  await setIdentity(guest, '河岸朋友');
  await guest.getByLabel('房间码或邀请链接').fill(code);
  await guest.getByRole('button', { name: '加入房间' }).click();
  await expect(host.getByText('河岸朋友')).toBeVisible();
  return { hostContext, guestContext, host, guest, code };
}

export async function finishByFolding(host, guest) {
  for (let step = 0; step < 120; step += 1) {
    if (await host.getByRole('heading', { name: '十手牌，落定。' }).count()) return;
    const hostFold = host.getByRole('button', { name: /弃牌 Fold/ });
    const guestFold = guest.getByRole('button', { name: /弃牌 Fold/ });
    if (await hostFold.isVisible().catch(() => false) && await hostFold.isEnabled().catch(() => false)) await hostFold.dispatchEvent('click');
    else if (await guestFold.isVisible().catch(() => false) && await guestFold.isEnabled().catch(() => false)) await guestFold.dispatchEvent('click');
    await host.waitForTimeout(250);
  }
  await expect(host.getByRole('heading', { name: '十手牌，落定。' })).toBeVisible({ timeout: 20_000 });
}
