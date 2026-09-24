import { expect, test } from '@playwright/test';

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

for (const viewport of [
  { width: 320, height: 700 },
  { width: 768, height: 900 },
  { width: 1440, height: 900 },
]) {
  test(`learning controls never cover game actions or cards at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByLabel('昵称').fill('布局练习生');
    await page.getByLabel('浅色').check();
    await page.getByLabel('静音').check();
    await page.getByRole('button', { name: '单人练习' }).click();
    const actions = page.getByLabel('牌局操作');
    await expect(actions).toBeVisible({ timeout: 10_000 });
    const toggle = page.getByRole('switch', { name: '显示学习辅助' });
    const toggleBox = await toggle.locator('..').boundingBox();
    expect(overlaps(toggleBox, await actions.boundingBox())).toBe(false);

    await toggle.check();
    const panel = page.getByRole('complementary', { name: '练习估算' });
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    expect(overlaps(panelBox, await actions.boundingBox())).toBe(false);
    for (const card of await page.locator('.poker-card').all()) {
      expect(overlaps(panelBox, await card.boundingBox())).toBe(false);
      expect(overlaps(await actions.boundingBox(), await card.boundingBox())).toBe(false);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (testInfo.project.name === 'chromium' && viewport.width !== 768) {
      await page.screenshot({ path: testInfo.outputPath('learning-expanded.png'), fullPage: true });
    }
    await actions.getByRole('button', { name: /弃牌 Fold|过牌 Check/ }).click({ trial: true });
    await toggle.uncheck();
    await expect(panel).toHaveCount(0);
    // Real pointer interaction, not dispatchEvent: catches another overlay
    // intercepting the Fold/Check target even when its center remains visible.
    await actions.getByRole('button', { name: /弃牌 Fold|过牌 Check/ }).click();
    await expect(actions).toHaveCount(0);
  });
}
