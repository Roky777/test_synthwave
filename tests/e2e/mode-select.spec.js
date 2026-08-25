import { test, expect } from '@playwright/test';

test.describe('mode select screen', () => {
  test('shows Random and Grade-Specific as the primary choices', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#startOverlay .wordmark')).toHaveAttribute('alt', /Press the Button/i);
    await expect(page.locator('#startOverlay')).toBeVisible();
    await expect(page.locator('.diffBtn[data-mode="classic"]')).toContainText('RANDOM');
    await expect(page.locator('#gradeSelectBtn')).toContainText('GRADE-SPECIFIC');
    await expect(page.locator('#gradeView')).toHaveClass(/hidden/);
  });

  test('opens grade modes in a separate view and returns', async ({ page }) => {
    await page.goto('/');
    await page.click('#gradeSelectBtn');
    await expect(page.locator('#modeHome')).toHaveClass(/hidden/);
    for (const mode of ['explorer', 'challenger', 'mastermind']) {
      await expect(page.locator(`.diffBtn[data-mode="${mode}"]`)).toBeVisible();
    }
    await page.click('#gradeBackBtn');
    await expect(page.locator('#modeHome')).not.toHaveClass(/hidden/);
    await expect(page.locator('#gradeView')).toHaveClass(/hidden/);
  });

  test('HUD and machine are hidden before a mode is picked', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hud')).toHaveClass(/hidden/);
    await expect(page.locator('#machine')).toHaveClass(/hidden/);
  });
});
