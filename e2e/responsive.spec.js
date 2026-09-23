import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 320, height: 700 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`home and tutorial remain usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByLabel('昵称').fill('河岸_玩家-123456789012345');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByLabel('浅色').check();
    await page.getByLabel('双色牌').check();
    await page.getByLabel('静音').check();
    await page.getByLabel('减少动态效果').check();
    await page.getByRole('button', { name: '新手教程' }).click();
    await expect(page.getByText('第 1 / 6 步')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-deck', 'twoColor');
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  });
}

test('mobile practice keeps private cards and controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await page.getByLabel('昵称').fill('移动练习生');
  await page.getByRole('button', { name: '单人练习' }).click();
  await expect(page.getByTestId('self-hole-cards')).toBeInViewport({ timeout: 10_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('switch', { name: '显示学习辅助' })).toBeInViewport();
});
