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
  test('timer color shows time urgency identically across instructions', async ({ page }) => {
    await openApp(page);
    await page.click('.diffBtn[data-mode="classic"]');
    await expect(page.locator('#promptText')).toHaveText('PRESS', { timeout: 3000 });

    const timerSnapshot=()=>page.locator('#ringSvg path').evaluateAll(paths=>{
      const active=paths.filter(path=>path.getAttribute('opacity')==='.96');
      return {
        count:active.length,
        treatments:[...new Set(active.map(path=>`${path.getAttribute('stroke')}|${path.getAttribute('opacity')}`))],
        filter:getComputedStyle(document.querySelector('#ringSvg')).filter,
      };
    });

    const pressEarly=await timerSnapshot();
    await expect.poll(async()=>(await timerSnapshot()).count,{timeout:5000}).toBeLessThanOrEqual(16);
    const pressMid=await timerSnapshot();
    await expect.poll(async()=>(await timerSnapshot()).count,{timeout:7000}).toBeLessThanOrEqual(8);
    const pressLate=await timerSnapshot();
    await page.click('#btn');
    await expect(page.locator('#promptText')).toHaveText('DO NOT PRESS', { timeout:3000 });
    const waitEarly=await timerSnapshot();
    await expect.poll(async()=>(await timerSnapshot()).count,{timeout:5000}).toBeLessThanOrEqual(16);
    const waitMid=await timerSnapshot();
    await expect.poll(async()=>(await timerSnapshot()).count,{timeout:7000}).toBeLessThanOrEqual(8);
    const waitLate=await timerSnapshot();

    const colorOf=snapshot=>snapshot.treatments[0].match(/\d+/g).slice(0,3).map(Number);
    for(const snapshot of [pressEarly,pressMid,pressLate,waitEarly,waitMid,waitLate]){
      expect(snapshot.treatments).toHaveLength(1);
      expect(snapshot.treatments[0].endsWith('|.96')).toBe(true);
      expect(snapshot.filter).toContain('/ 0.26');
    }
    const [earlyR,earlyG,earlyB]=colorOf(pressEarly);
    const [midR,,midB]=colorOf(pressMid);
    const [lateR,lateG,lateB]=colorOf(pressLate);
    const [waitEarlyR,waitEarlyG,waitEarlyB]=colorOf(waitEarly);
    const [waitMidR,,waitMidB]=colorOf(waitMid);
    const [waitLateR,waitLateG,waitLateB]=colorOf(waitLate);
    expect(earlyG).toBeGreaterThan(earlyR);
    expect(earlyB).toBeGreaterThan(earlyR);
    expect(midR).toBeGreaterThan(earlyR);
    expect(midR).toBeLessThanOrEqual(lateR);
    expect(midB).toBeLessThan(earlyB);
    expect(midB).toBeGreaterThanOrEqual(lateB);
    expect(lateR).toBeGreaterThan(lateG);
    expect(lateR).toBeGreaterThan(lateB);
    expect(lateB).toBeLessThan(midB);
    expect(waitEarlyG).toBeGreaterThan(waitEarlyR);
    expect(waitEarlyB).toBeGreaterThan(waitEarlyR);
    expect(waitMidR).toBeGreaterThan(waitEarlyR);
    expect(waitMidR).toBeLessThanOrEqual(waitLateR);
    expect(waitMidB).toBeLessThan(waitEarlyB);
    expect(waitMidB).toBeGreaterThanOrEqual(waitLateB);
    expect(waitLateR).toBeGreaterThan(waitLateG);
    expect(waitLateR).toBeGreaterThan(waitLateB);
    expect(waitLateB).toBeLessThan(waitMidB);
    expect(pressEarly.count).toBeGreaterThan(pressLate.count);
    expect(waitEarly.count).toBeGreaterThan(waitLate.count);
  });

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

  test('gameplay keeps the removed category label hidden', async ({ page }) => {
    await openApp(page);
    await page.click('.diffBtn[data-mode="classic"]');
    await expect(page.locator('#promptText')).toHaveText('PRESS', { timeout: 3000 });
    await expect(page.locator('#catTag')).toHaveClass(/hidden/);
  });
});

test.describe('modern modes gameplay', () => {
  for (const mode of ['explorer', 'challenger', 'mastermind']) {
    test(`${mode} mode keeps category chrome hidden and responds to input`, async ({ page }) => {
      await openApp(page);
      await page.click('#gradeSelectBtn');
      await page.click(`.diffBtn[data-mode="${mode}"]`);

      await expect(page.locator('#catTag')).toHaveClass(/hidden/);
      await expect(page.locator('#catTag')).toBeEmpty();
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
