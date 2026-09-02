import { test, expect } from '@playwright/test';

const viewports=[
  [320,568],[360,640],[360,780],[375,667],[375,812],[390,844],[393,852],
  [393,873],[412,915],[430,932],[844,390],[932,430],
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
      const title=document.querySelector('.wordmark');
      const cardEls=[...document.querySelectorAll('#modeHome .diffBtn')];
      const app=rect('#app');
      return {app,appBorder:getComputedStyle(document.querySelector('#app')).borderWidth,title:rect('.wordmark'),group:rect('#modeHome'),titleSize:parseFloat(getComputedStyle(title).fontSize),heading:rect('.modeSelectTitle'),
        cards:cardEls.map(el=>el.getBoundingClientRect().toJSON()),
        cardTitleSizes:cardEls.map(el=>parseFloat(getComputedStyle(el.querySelector('.modeText')).fontSize)),
        cardDescSizes:cardEls.map(el=>parseFloat(getComputedStyle(el.querySelector('small')).fontSize)),
        iconSizes:cardEls.map(el=>el.querySelector('.modeIcon').getBoundingClientRect().width),
        sun:rect('#sun'),sunClip:getComputedStyle(document.querySelector('#sun')).clipPath,
        skyline:rect('#skyline'),grid:rect('#grid'),horizon:innerHeight*.66};
    });
    expect(mode.app.height,`${width}x${height} app tracks visible viewport`).toBeCloseTo(height,0);
    expect(mode.appBorder,`${width}x${height} outer screen remains frameless`).toBe('0px');
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
    expect(mode.horizon/height).toBeGreaterThanOrEqual(.62);
    expect(mode.horizon/height).toBeLessThanOrEqual(.68);
    if(width<=480&&height>width){
      const horizonGap=mode.horizon-mode.group.bottom;
      const expectedGap=height<=620?[47,49]:height<=700?[59,79]:[104,151];
      expect(mode.titleSize,`${width}x${height} title remains prominent`).toBeGreaterThanOrEqual(36);
      expect(mode.group.top,`${width}x${height} title and mode group do not overlap`).toBeGreaterThanOrEqual(mode.title.bottom-1);
      expect(horizonGap,`${width}x${height} mode group horizon gap minimum`).toBeGreaterThanOrEqual(expectedGap[0]);
      expect(horizonGap,`${width}x${height} mode group horizon gap maximum`).toBeLessThanOrEqual(expectedGap[1]);
      expect(Math.min(...mode.cards.map(card=>card.height)),`${width}x${height} card touch height`).toBeGreaterThanOrEqual(68);
      expect(Math.min(...mode.cardTitleSizes),`${width}x${height} card title legibility`).toBeGreaterThanOrEqual(15);
      expect(Math.min(...mode.cardDescSizes),`${width}x${height} card description legibility`).toBeGreaterThanOrEqual(11);
      expect(Math.min(...mode.iconSizes),`${width}x${height} mode icon size`).toBeGreaterThanOrEqual(42);
    }

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
      return {app:rect('#app'),hud:rect('#hud'),machine,exit:rect('#exitBtn'),music:rect('#musicBtn'),
        skylineBottom:document.querySelector('#skyline').getBoundingClientRect().bottom,horizon:innerHeight*.66};
    });
    for(const [name,box] of Object.entries(gameplay).filter(([,value])=>typeof value==='object'))
      expect(inside(box,width,height),`${width}x${height} gameplay ${name}`).toBe(true);
    expect(gameplay.machine.width).toBeCloseTo(gameplay.machine.height,0);
    expect(gameplay.machine.bottom).toBeCloseTo(gameplay.horizon,0);
    expect(gameplay.skylineBottom).toBeCloseTo(mode.skyline.bottom,0);
    if(width<=480&&height>width){
      expect(gameplay.machine.width,`${width}x${height} primary gameplay control`).toBeGreaterThanOrEqual(232);
      expect(gameplay.exit.width,`${width}x${height} exit touch target`).toBeGreaterThanOrEqual(44);
      expect(gameplay.music.width,`${width}x${height} music touch target`).toBeGreaterThanOrEqual(44);
    }
  }
});
