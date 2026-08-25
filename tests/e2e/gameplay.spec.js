import { test, expect } from '@playwright/test';

// The sequence generator always starts with a fixed, deterministic tutorial:
// round 0 = "PRESS" (must press), round 1 = "DO NOT PRESS" (must not press).
// We rely on that fixed opening to keep these assertions deterministic despite
// the rest of the 240-prompt sequence being randomized.

test.describe('classic mode gameplay', () => {
  test('pressing on "PRESS" succeeds and increases the score', async ({ page }) => {
    await page.goto('/');
    await page.click('.diffBtn[data-mode="classic"]');

    await expect(page.locator('#hud')).not.toHaveClass(/hidden/);
    await expect(page.locator('#promptText')).toHaveText('PRESS', { timeout: 3000 });

    await page.click('#btn');

    await expect(page.locator('#banner')).toHaveClass(/ok/);
    await expect(page.locator('#score')).toHaveText('12');
    await expect(page.locator('#hearts')).toHaveText('❤️❤️❤️');
  });

  test('pressing on "DO NOT PRESS" fails and costs a life', async ({ page }) => {
    await page.goto('/');
    await page.click('.diffBtn[data-mode="classic"]');

    await expect(page.locator('#promptText')).toHaveText('PRESS', { timeout: 3000 });
    await page.click('#btn'); // resolve round 0 correctly first

    await expect(page.locator('#promptText')).toHaveText('DO NOT PRESS', { timeout: 3000 });
    await page.click('#btn'); // wrong press

    await expect(page.locator('#banner')).toHaveClass(/bad/);
    await expect(page.locator('#streak')).toHaveText('×0');
    await expect(page.locator('#hearts')).toHaveText('❤️❤️🖤');
  });

  test('classic mode never shows the category tag (fixed accent, no chaos mechanics)', async ({ page }) => {
    await page.goto('/');
    await page.click('.diffBtn[data-mode="classic"]');
    await expect(page.locator('#promptText')).toHaveText('PRESS', { timeout: 3000 });
    await expect(page.locator('#catTag')).toHaveClass(/hidden/);
  });
});

test.describe('modern modes gameplay', () => {
  for (const mode of ['explorer', 'challenger', 'mastermind']) {
    test(`${mode} mode shows a category tag and responds to input`, async ({ page }) => {
      await page.goto('/');
      await page.click('#gradeSelectBtn');
      await page.click(`.diffBtn[data-mode="${mode}"]`);

      await expect(page.locator('#promptText')).toHaveText('PRESS', { timeout: 3000 });
      await expect(page.locator('#catTag')).not.toHaveClass(/hidden/);
      await expect(page.locator('#catTag')).toContainText('REFLEX');

      await page.click('#btn');
      await expect(page.locator('#banner')).toHaveClass(/ok/);
    });
  }
});

test.describe('keyboard controls', () => {
  test('Space on the start screen launches Random mode', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Space');
    await expect(page.locator('#hud')).not.toHaveClass(/hidden/);
    await expect(page.locator('#promptText')).toHaveText('PRESS', { timeout: 3000 });
    await expect(page.locator('#catTag')).toHaveClass(/hidden/);
  });

  test('Space presses the button during a live prompt', async ({ page }) => {
    await page.goto('/');
    await page.click('.diffBtn[data-mode="classic"]');
    await expect(page.locator('#promptText')).toHaveText('PRESS', { timeout: 3000 });

    await page.keyboard.press('Space');

    await expect(page.locator('#banner')).toHaveClass(/ok/);
    await expect(page.locator('#score')).toHaveText('12');
  });
});
