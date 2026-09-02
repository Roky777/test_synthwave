import { test, expect } from '@playwright/test';

const viewports=[
  [320,568],[360,640],[375,667],[390,844],[393,852],[412,915],[430,932],
  [768,1024],[1024,1366],[1024,768],[1366,768],[1440,900],[1920,1080],
  [2560,1440],[540,720],[720,540],
];

const inside=(box,width,height)=>box.left>=-1&&box.top>=-1&&box.right<=width+1&&box.bottom<=height+1;

test('all primary screens adapt across the viewport matrix',async({page})=>{
  test.setTimeout(240_000);
  for(const [width,height] of viewports){
    await page.setViewportSize({width,height});
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-app-ready','true');

    const mode=await page.evaluate(()=>{
      const rect=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();
      return {title:rect('.wordmark'),heading:rect('.modeSelectTitle'),cards:[...document.querySelectorAll('#modeHome .diffBtn')].map(el=>el.getBoundingClientRect().toJSON()),
        sun:rect('#sun'),sunClip:getComputedStyle(document.querySelector('#sun')).clipPath,
        skyline:rect('#skyline'),grid:rect('#grid'),horizon:innerHeight*.66};
    });
    expect(inside(mode.title,width,height),`${width}x${height} mode title`).toBe(true);
    expect(inside(mode.heading,width,height),`${width}x${height} mode heading`).toBe(true);
    for(const card of mode.cards)expect(inside(card,width,height),`${width}x${height} mode card`).toBe(true);
    expect(mode.cards[0].width).toBeCloseTo(mode.cards[1].width,0);
    expect(mode.cards[0].height).toBeCloseTo(mode.cards[1].height,0);
    expect(Math.max(...mode.cards.map(card=>card.bottom)),`${width}x${height} mode cards above horizon`).toBeLessThan(mode.horizon);
    expect(mode.sun.width).toBeCloseTo(mode.sun.height,0);
    expect(mode.sun.width).toBeGreaterThanOrEqual(360);
    expect(mode.sun.width).toBeLessThanOrEqual(680);
    expect(mode.sunClip).not.toBe('none');
    expect(mode.sun.top).toBeLessThan(mode.horizon);
    expect(mode.skyline.bottom).toBeCloseTo(mode.horizon,0);
    expect(mode.grid.top).toBeCloseTo(mode.horizon,0);

    await page.click('#gradeSelectBtn');
    const challenge=await page.evaluate(()=>{
      const title=document.querySelector('.gradeHeading').getBoundingClientRect().toJSON();
      const cards=[...document.querySelectorAll('#gradeView .diffBtn')].map(el=>el.getBoundingClientRect().toJSON());
      return {title,cards,skylineBottom:document.querySelector('#skyline').getBoundingClientRect().bottom,horizon:innerHeight*.66};
    });
    expect(inside(challenge.title,width,height),`${width}x${height} challenge title`).toBe(true);
    for(const card of challenge.cards)expect(inside(card,width,height),`${width}x${height} challenge card`).toBe(true);
    expect(new Set(challenge.cards.map(card=>Math.round(card.width))).size).toBe(1);
    expect(new Set(challenge.cards.map(card=>Math.round(card.height))).size).toBe(1);
    expect(Math.max(...challenge.cards.map(card=>card.bottom)),`${width}x${height} challenge cards above horizon`).toBeLessThan(challenge.horizon);
    expect(challenge.skylineBottom).toBeCloseTo(mode.skyline.bottom,0);

    await page.click('#gradeBackBtn');
    await page.click('.diffBtn[data-mode="classic"]');
    await expect(page.locator('#promptText')).toHaveText('PRESS',{timeout:3000});
    const gameplay=await page.evaluate(()=>{
      const rect=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();
      const machine=rect('#machine');
      return {hud:rect('#hud'),machine,exit:rect('#exitBtn'),music:rect('#musicBtn'),
        skylineBottom:document.querySelector('#skyline').getBoundingClientRect().bottom,horizon:innerHeight*.66};
    });
    for(const [name,box] of Object.entries(gameplay).filter(([,value])=>typeof value==='object'))
      expect(inside(box,width,height),`${width}x${height} gameplay ${name}`).toBe(true);
    expect(gameplay.machine.width).toBeCloseTo(gameplay.machine.height,0);
    expect(gameplay.machine.bottom).toBeCloseTo(gameplay.horizon,0);
    expect(gameplay.skylineBottom).toBeCloseTo(mode.skyline.bottom,0);
  }
});
