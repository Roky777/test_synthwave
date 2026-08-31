import { test, expect } from '@playwright/test';

async function openApp(page){
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-app-ready','true');
}

// The sequence generator always starts with a fixed, deterministic tutorial:
// round 0 = "PRESS" (must press), round 1 = "DO NOT PRESS" (must not press).
// We rely on that fixed opening to keep these assertions deterministic despite
// the rest of the 240-prompt sequence being randomized.

async function pressPrompt(page,text){
  await expect.poll(()=>page.evaluate(expected=>{
    if(document.querySelector('#promptText').textContent!==expected)return false;
    document.querySelector('#btn').dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,bubbles:true}));
    return true;
  },text)).toBe(true);
}

test.describe('classic mode gameplay', () => {
  test('pressing on "PRESS" succeeds and increases the score', async ({ page }) => {
    await openApp(page);
    await page.click('.diffBtn[data-mode="classic"]');

    await expect(page.locator('#hud')).not.toHaveClass(/hidden/);
    await pressPrompt(page,'PRESS');

    await expect(page.locator('#score')).toHaveText('12');
    await expect(page.locator('#hearts .heart')).toHaveCount(3);
    await expect(page.locator('#hearts .heart.gone')).toHaveCount(0);
  });

  test('pressing on "DO NOT PRESS" fails and costs a life', async ({ page }) => {
    await openApp(page);
    await page.click('.diffBtn[data-mode="classic"]');

    await pressPrompt(page,'PRESS'); // resolve round 0 correctly first
    await pressPrompt(page,'DO NOT PRESS'); // wrong press

    await expect(page.locator('#streak')).toHaveText('×0');
    await expect(page.locator('#hearts .heart')).toHaveCount(3);
    await expect(page.locator('#hearts .heart.gone')).toHaveCount(1);
  });

  test('classic mode never shows the category tag (fixed accent, no chaos mechanics)', async ({ page }) => {
    await openApp(page);
    await page.click('.diffBtn[data-mode="classic"]');
    await expect(page.locator('#promptText')).toHaveText('PRESS', { timeout: 3000 });
    await expect(page.locator('#catTag')).toHaveClass(/hidden/);
  });
});

test.describe('modern modes gameplay', () => {
  for (const mode of ['explorer', 'challenger', 'mastermind']) {
    test(`${mode} mode shows a category tag and responds to input`, async ({ page }) => {
      await openApp(page);
      await page.click('#gradeSelectBtn');
      await page.click(`.diffBtn[data-mode="${mode}"]`);

      await expect(page.locator('#catTag')).not.toHaveClass(/hidden/);
      await expect(page.locator('#catTag')).toContainText('REFLEX');
      await pressPrompt(page,'PRESS');
      await expect(page.locator('#score')).toHaveText('12');
    });
  }
});

test.describe('keyboard controls', () => {
  test('Space on the start screen launches Random mode', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#startOverlay')).not.toHaveClass(/hidden/);
    await expect.poll(async()=>{
      await page.keyboard.press('Space');
      return page.locator('#hud').evaluate(el=>!el.classList.contains('hidden'));
    }).toBe(true);
    await expect(page.locator('#catTag')).toHaveClass(/hidden/);
  });

  test('Space presses the button during a live prompt', async ({ page }) => {
    await openApp(page);
    await page.click('.diffBtn[data-mode="classic"]');
    await expect(page.locator('#promptText')).toHaveText('PRESS', { timeout: 3000 });

    await page.keyboard.press('Space');

    await expect(page.locator('#score')).toHaveText('12');
  });
});
