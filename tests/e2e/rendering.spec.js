import { test, expect } from '@playwright/test';

test('uses the reduced renderer only on phone-sized viewports', async ({ page }) => {
  await page.goto('/');

  const rendering = await page.evaluate(() => ({
    width: window.innerWidth,
    gridAnimation: getComputedStyle(document.querySelector('#grid'), '::before').animationName,
    ringFilter: getComputedStyle(document.querySelector('#ringSvg')).filter,
  }));

  if (rendering.width <= 600) {
    expect(rendering.gridAnimation).toBe('none');
    expect(rendering.ringFilter).toBe('none');
  } else {
    expect(rendering.gridAnimation).toBe('gridMove');
    expect(rendering.ringFilter).not.toBe('none');
  }
});

test('keeps the GET READY label on one line inside the button', async ({ page }) => {
  await page.goto('/');
  await page.click('.diffBtn[data-mode="classic"]');
  await expect(page.locator('#btn')).toHaveClass(/readyPrompt/);
  await expect(page.locator('#promptText')).toHaveText('GET READY…');

  const fit=await page.locator('#promptText').evaluate(el => ({
    width:el.getBoundingClientRect().width,
    scrollWidth:el.scrollWidth,
    height:el.getBoundingClientRect().height,
    lineHeight:parseFloat(getComputedStyle(el).lineHeight),
    whiteSpace:getComputedStyle(el).whiteSpace,
  }));
  expect(fit.whiteSpace).toBe('nowrap');
  expect(fit.scrollWidth).toBeLessThanOrEqual(Math.ceil(fit.width));
  expect(fit.height).toBeLessThanOrEqual(fit.lineHeight+1);
});
