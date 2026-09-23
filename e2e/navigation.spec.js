import { expect, test } from '@playwright/test';
import { setIdentity } from './helpers.js';

test('a first-time visitor can join through the shared invitation URL', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    await setIdentity(host, '邀请房主');
    await host.getByRole('button', { name: '创建好友房' }).click();
    const code = (await host.getByTestId('room-code').textContent()).trim();
    await guest.goto(`/room/${code}`);
    await expect(guest.getByLabel('房间码或邀请链接')).toHaveValue(code);
    await guest.getByLabel('昵称').fill('链接朋友');
    await guest.getByRole('button', { name: '加入房间' }).click();
    await expect(host.getByText('链接朋友')).toBeVisible();
    await expect(guest.getByTestId('room-code')).toHaveText(code);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('returning home abandons the old session so a new room can be created', async ({ page }) => {
  await setIdentity(page, '两桌玩家');
  await page.getByRole('button', { name: '创建好友房' }).click();
  const originalCode = await page.getByTestId('room-code').textContent();
  await page.getByRole('link', { name: 'Project River 首页' }).click();
  await page.getByRole('button', { name: '创建好友房' }).click();
  await expect(page.getByTestId('room-code')).toBeVisible();
  await expect(page.getByTestId('room-code')).not.toHaveText(originalCode);
});

test('first-use practice navigation collects an identity before dealing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '练习桌', exact: true }).click();
  await expect(page.getByLabel('昵称')).toBeVisible();
  await page.getByLabel('昵称').fill('首次练习');
  await page.getByRole('button', { name: '单人练习', exact: true }).click();
  await expect(page.getByTestId('self-hole-cards')).toBeVisible();
});
