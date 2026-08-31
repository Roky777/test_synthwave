import { test, expect } from '@playwright/test';

test('uses the reduced renderer only on phone-sized viewports', async ({ page }) => {
  await page.goto('/');

  const rendering = await page.evaluate(() => ({
    width: window.innerWidth,
    gridAnimation: getComputedStyle(document.querySelector('#grid'), '::before').animationName,
    ringFilter: getComputedStyle(document.querySelector('#ringSvg')).filter,
  }));

  if (rendering.width <= 600) {
    expect(rendering.gridAnimation).toBe('gridMoveMobile');
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
  await expect(page.locator('#promptText')).toHaveText('GET READY');

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

test('fits every prompt typography class inside the button face', async ({ page }) => {
  await page.goto('/');
  await page.click('.diffBtn[data-mode="classic"]');
  const results=await page.evaluate(()=>{
    const btn=document.querySelector('#btn');
    const text=document.querySelector('#promptText');
    const emoji=document.querySelector('#promptEmoji');
    const sub=document.querySelector('#promptSub');
    const cases=[
      {text:'PRESS'},
      {text:'DO NOT PRESS'},
      {text:'SAME AS LAST'},
      {text:'THE SUN RISES IN THE WEST',emoji:'🌅',sub:'PRESS IF TRUE'},
      {text:'PRESS IF THE NUMBER WAS 47',emoji:'🧠'},
      {text:'NEW RULE: ALWAYS PRESS WHEN YOU SEE A RAT',emoji:'🐀',sub:'REMEMBER THIS RULE'},
      {text:'PRESS WHEN STARS ARE EVEN',emoji:'⭐️⭐️⭐️⭐️'},
      {text:'PRESS EXACTLY 5 TIMES'},
      {text:'PRESS IF THIS IS INDIA',emoji:'🇮🇳'},
      {text:'HOLD THE BUTTON FOR 2 SECONDS',emoji:'✊',sub:'PRESS AND KEEP HOLDING'},
      {text:"BRAINS…? NOT YOURS. DON'T PRESS!",emoji:'🧟'},
      {text:'IT IS VERY QUIET IN HERE…',emoji:'🕯️',sub:'JUST WAIT. NOTHING WILL HAPPEN. PROBABLY.'},
      {text:'FREE 1000 POINTS IF YOU PRESS',emoji:'😏',sub:'(THIS IS A LIE)'},
      {text:'DOWNLOADING MORE GK… 99%',emoji:'📥',sub:'ALMOST THERE. HANDS OFF.'},
      {text:'REMEMBER THIS NUMBER',big:'47',sub:'JUST REMEMBER. DO NOT PRESS.'},
    ];
    return cases.map(item=>{
      const length=item.text.length;
      btn.className='';
      btn.classList.toggle('shortPrompt',length<=12&&!item.emoji&&!item.big);
      btn.classList.toggle('longPrompt',length>18);
      btn.classList.toggle('veryLongPrompt',length>30);
      btn.classList.toggle('withPromptDetails',Boolean(item.emoji||item.big||item.sub));
      btn.classList.toggle('numericPrompt',Boolean(item.big));
      text.textContent=item.text;emoji.textContent=item.big||item.emoji||'';sub.textContent=item.sub||'';
      const stageEl=btn.querySelector('.promptStage');
      stageEl.style.setProperty('--prompt-half-height',`${text.getBoundingClientRect().height/2}px`);
      const stage=stageEl.getBoundingClientRect();
      const textBox=text.getBoundingClientRect();
      const visible=[emoji,text,sub,document.querySelector('#holdBar')].filter(el=>getComputedStyle(el).display!=='none');
      const overflow=visible.reduce((amount,el)=>{
        const box=el.getBoundingClientRect();
        return Math.max(amount,stage.top-box.top,box.bottom-stage.bottom,stage.left-box.left,box.right-stage.right);
      },0);
      return {text:item.text,overflow,font:parseFloat(getComputedStyle(text).fontSize),centerDelta:Math.abs((textBox.top+textBox.bottom-stage.top-stage.bottom)/2)};
    });
  });
  for(const result of results){
    expect(result.overflow,result.text).toBeLessThanOrEqual(1);
    expect(result.font).toBeGreaterThanOrEqual(11);
    expect(result.centerDelta).toBeLessThanOrEqual(2);
  }
});

test('keeps the complete start UI inside a phone viewport', async ({ page }) => {
  await page.goto('/');
  const boxes=await page.evaluate(() => {
    const overlay=document.querySelector('#startOverlay').getBoundingClientRect();
    const title=document.querySelector('.wordmark').getBoundingClientRect();
    const orb=document.querySelector('.heroOrb').getBoundingClientRect();
    const actions=document.querySelector('#modeHome .diffRow').getBoundingClientRect();
    const cardElements=[...document.querySelectorAll('#modeHome .diffBtn')];
    const cards=cardElements.map(el=>el.getBoundingClientRect());
    return {
      viewportWidth:innerWidth,overlayTop:overlay.top,overlayBottom:overlay.bottom,
      titleTop:title.top,orbWidth:orb.width,actionsWidth:actions.width,actionsBottom:actions.bottom,
      cardHeights:cards.map(card=>card.height),labels:cardElements.map(card=>({scroll:card.querySelector('.modeText').scrollWidth,width:card.querySelector('.modeText').clientWidth})),
    };
  });
  expect(boxes.titleTop).toBeGreaterThanOrEqual(boxes.overlayTop-1);
  expect(boxes.actionsBottom).toBeLessThanOrEqual(boxes.overlayBottom+1);
  if(boxes.viewportWidth<=480){
    // The exported SVG has horizontal transparent padding: its visible 238px
    // orb sits inside a 320px canvas. Phone layouts preserve the SE ratios.
    const visibleOrbWidth=boxes.orbWidth*(238/320);
    expect(boxes.actionsWidth/visibleOrbWidth).toBeGreaterThanOrEqual(1.36);
    expect(boxes.actionsWidth/visibleOrbWidth).toBeLessThanOrEqual(1.4);
    expect(boxes.cardHeights[0]/visibleOrbWidth).toBeGreaterThanOrEqual(.28);
    expect(boxes.cardHeights[0]/visibleOrbWidth).toBeLessThanOrEqual(.31);
  }
  expect(Math.abs(boxes.cardHeights[0]-boxes.cardHeights[1])).toBeLessThanOrEqual(1);
  for(const label of boxes.labels)expect(label.scroll).toBeLessThanOrEqual(label.width);
});

test('requests haptic feedback after a wrong answer', async ({ page }) => {
  await page.addInitScript(() => {
    window.__vibratePattern=null;
    Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{
      window.__vibratePattern=pattern;
      return true;
    }});
  });
  await page.goto('/');
  await page.click('.diffBtn[data-mode="classic"]');
  await expect(page.locator('#promptText')).toHaveText('PRESS',{timeout:3000});
  await page.click('#btn');
  await expect(page.locator('#promptText')).toHaveText('DO NOT PRESS',{timeout:3000});
  await page.click('#btn');
  await expect.poll(()=>page.evaluate(()=>window.__vibratePattern)).toEqual([90,45,180]);
});

test('dims the scenery and keeps music below feedback volume during play', async ({ page }) => {
  await page.goto('/');
  await page.click('.diffBtn[data-mode="classic"]');
  const state=await page.evaluate(() => ({
    active:document.body.classList.contains('game-active'),
    musicVolume:document.querySelector('#themeMusic').volume,
  }));
  expect(state.active).toBe(true);
  expect(state.musicVolume).toBeLessThanOrEqual(.02);
  await expect.poll(()=>page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('#sun')).opacity)
  )).toBeLessThan(.7);
});

test('opens a responsive music slider and applies its volume', async ({ page }) => {
  await page.goto('/');
  await page.click('.diffBtn[data-mode="classic"]');
  await page.click('#musicBtn');
  await expect(page.locator('#volumePanel')).toBeVisible();
  await expect(page.locator('#musicBtn')).toHaveAttribute('aria-expanded','true');
  const placement=await page.evaluate(()=>{
    const panel=document.querySelector('#volumePanel').getBoundingClientRect();
    const button=document.querySelector('#musicBtn').getBoundingClientRect();
    return {panelRight:panel.right,panelTop:panel.top,panelBottom:panel.bottom,panelHeight:panel.height,buttonLeft:button.left,buttonTop:button.top,buttonBottom:button.bottom};
  });
  expect(placement.panelRight).toBeLessThanOrEqual(placement.buttonLeft+1);
  expect(placement.panelTop).toBeLessThan(placement.buttonBottom);
  expect(placement.panelBottom).toBeGreaterThan(placement.buttonTop);
  expect(placement.panelHeight).toBeLessThanOrEqual(46);
  expect(Math.abs((placement.panelTop+placement.panelBottom)/2-(placement.buttonTop+placement.buttonBottom)/2)).toBeLessThanOrEqual(1);

  await page.locator('#volumeSlider').fill('50');
  await expect(page.locator('#volumeValue')).toHaveText('50%');
  await expect.poll(()=>page.locator('#themeMusic').evaluate(el=>el.volume)).toBeCloseTo(.03);

  await page.locator('#volumeSlider').fill('0');
  await expect(page.locator('#musicBtn')).toHaveClass(/muted/);
  await page.evaluate(()=>document.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await expect(page.locator('#volumePanel')).toHaveClass(/hidden/);
});
