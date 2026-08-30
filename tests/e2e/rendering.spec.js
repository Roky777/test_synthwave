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
