import { test, expect } from '@playwright/test';

async function openApp(page){
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-app-ready','true');
}

test.describe('mode select screen', () => {
  test('shows Random and Grade-Specific as the primary choices', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#startOverlay .wordmark')).toContainText('PRESS THE BUTTON');
    await expect(page.locator('#startOverlay')).toBeVisible();
    await expect(page.locator('.diffBtn[data-mode="classic"]')).toContainText('RANDOM');
    await expect(page.locator('#gradeSelectBtn')).toContainText('GRADE-SPECIFIC');
    const borders=await page.locator('#modeHome .diffBtn').evaluateAll(cards=>cards.map(card=>getComputedStyle(card).borderColor));
    expect(new Set(borders).size).toBe(1);
    expect(borders[0]).toBe('rgb(180, 76, 255)');
    await expect(page.locator('#gradeView')).toHaveClass(/hidden/);
  });

  test('opens grade modes in a separate view and returns', async ({ page }) => {
    await openApp(page);
    await page.click('#gradeSelectBtn');
    await expect(page.locator('#modeHome')).toHaveClass(/hidden/);
    for (const mode of ['explorer', 'challenger', 'mastermind']) {
      await expect(page.locator(`.diffBtn[data-mode="${mode}"]`)).toBeVisible();
    }
    const gradeBorders=await page.locator('#gradeView .diffBtn').evaluateAll(cards=>cards.map(card=>getComputedStyle(card).borderColor));
    expect(new Set(gradeBorders).size).toBe(1);
    expect(gradeBorders[0]).toBe('rgb(180, 76, 255)');
    await page.click('#gradeBackBtn');
    await expect(page.locator('#modeHome')).not.toHaveClass(/hidden/);
    await expect(page.locator('#gradeView')).toHaveClass(/hidden/);
  });

  test('HUD and machine are hidden before a mode is picked', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#hud')).toHaveClass(/hidden/);
    await expect(page.locator('#machine')).toHaveClass(/hidden/);
  });
});
