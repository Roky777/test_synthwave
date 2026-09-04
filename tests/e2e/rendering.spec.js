import { test, expect } from '@playwright/test';

async function openApp(page){
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-app-ready','true');
}

test('uses the reduced renderer only on phone-sized viewports', async ({ page }) => {
  await openApp(page);

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
  await openApp(page);
  const fit=await page.evaluate(() => {
    document.querySelector('.diffBtn[data-mode="classic"]').click();
    const el=document.querySelector('#promptText');
    return {
    ready:document.querySelector('#btn').classList.contains('readyPrompt'),
    text:el.textContent,
    width:el.getBoundingClientRect().width,
    scrollWidth:el.scrollWidth,
    height:el.getBoundingClientRect().height,
    lineHeight:parseFloat(getComputedStyle(el).lineHeight),
    whiteSpace:getComputedStyle(el).whiteSpace,
    emojiSize:parseFloat(getComputedStyle(document.querySelector('#promptEmoji')).fontSize),
    emojiTop:document.querySelector('#promptEmoji').getBoundingClientRect().top,
    emojiBottom:document.querySelector('#promptEmoji').getBoundingClientRect().bottom,
    textTop:el.getBoundingClientRect().top,
    textBottom:el.getBoundingClientRect().bottom,
    stageTop:document.querySelector('.promptStage').getBoundingClientRect().top,
    stageBottom:document.querySelector('.promptStage').getBoundingClientRect().bottom,
    };
  });
  expect(fit.ready).toBe(true);
  expect(fit.text).toBe('GET READY');
  expect(fit.whiteSpace).toBe('nowrap');
  expect(fit.scrollWidth).toBeLessThanOrEqual(Math.ceil(fit.width));
  expect(fit.height).toBeLessThanOrEqual(fit.lineHeight+1);
  expect(fit.emojiSize).toBeGreaterThanOrEqual(28);
  expect(fit.emojiTop).toBeGreaterThanOrEqual(fit.stageTop-1);
  expect(fit.emojiBottom).toBeLessThanOrEqual(fit.textTop+1);
  expect(fit.textBottom).toBeLessThanOrEqual(fit.stageBottom+1);
  expect(Math.abs((fit.emojiTop+fit.textBottom-fit.stageTop-fit.stageBottom)/2)).toBeLessThanOrEqual(10);
});

test('fits every prompt typography class inside the button face', async ({ page }) => {
  await openApp(page);
  await page.click('.diffBtn[data-mode="classic"]');
  const results=await page.evaluate(()=>{
    const btn=document.querySelector('#btn');
    const text=document.querySelector('#promptText');
    const emoji=document.querySelector('#promptEmoji');
    const sub=document.querySelector('#promptSub');
    const countCases=[
      ['🐱','CATS'],['🐶','DOGS'],['🐭','MICE'],['🐸','FROGS'],
      ['🐵','MONKEYS'],['⭐','STARS'],['🍕','PIZZAS'],['⚽','BALLS'],
      ['🦆','DUCKS'],['🍎','APPLES'],['🚗','CARS'],['🪔','DIYAS'],
    ].flatMap(([symbol,name])=>[5,7,10].flatMap(count=>['EVEN','ODD'].map(parity=>({
      text:`PRESS WHEN ${name} ARE ${parity}`,emoji:symbol.repeat(count),countPrompt:true,
    }))));
    const cases=[
      {text:'PRESS'},
      {text:'DO NOT PRESS'},
      {text:'SAME AS LAST'},
      {text:'THE SUN RISES IN THE WEST',emoji:'🌅',sub:'PRESS IF TRUE'},
      {text:'PRESS IF THE NUMBER WAS 47',emoji:'🧠'},
      {text:'NEW RULE: ALWAYS PRESS WHEN YOU SEE A RAT',emoji:'🐀',sub:'REMEMBER THIS RULE'},
      {text:'PRESS WHEN STARS ARE EVEN',emoji:'⭐️⭐️⭐️⭐️'},
      {text:'PRESS WHEN STARS ARE EVEN',emoji:'⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐'},
      {text:'PRESS EXACTLY 5 TIMES'},
      {text:'PRESS IF THIS IS INDIA',emoji:'🇮🇳'},
      {text:'HOLD THE BUTTON FOR 2 SECONDS',emoji:'✊',sub:'PRESS AND KEEP HOLDING'},
      {text:"BRAINS…? NOT YOURS. DON'T PRESS!",emoji:'🧟'},
      {text:'IT IS VERY QUIET IN HERE…',emoji:'🕯️',sub:'JUST WAIT. NOTHING WILL HAPPEN. PROBABLY.'},
      {text:'FREE 1000 POINTS IF YOU PRESS',emoji:'😏',sub:'(THIS IS A LIE)'},
      {text:'DOWNLOADING MORE GK… 99%',emoji:'📥',sub:'ALMOST THERE. HANDS OFF.'},
      {text:'REMEMBER THIS NUMBER',big:'47',sub:'JUST REMEMBER. DO NOT PRESS.'},
      ...countCases,
    ];
    return cases.map(item=>{
      const length=item.text.length;
      btn.className='';
      btn.classList.toggle('shortPrompt',length<=12&&!item.emoji&&!item.big);
      btn.classList.toggle('longPrompt',length>18);
      btn.classList.toggle('veryLongPrompt',length>30);
      btn.classList.toggle('withPromptDetails',Boolean(item.emoji||item.big||item.sub));
      btn.classList.toggle('numericPrompt',Boolean(item.big));
      btn.classList.toggle('countPrompt',Boolean(item.countPrompt));
      const emojiCount=Array.from(item.big||item.emoji||'').length;
      btn.classList.toggle('denseContentPrompt',emojiCount>4&&length>18);
      if(item.countPrompt){
        const match=item.text.match(/^PRESS WHEN (.+)$/);
        const lead=document.createElement('span');
        const condition=document.createElement('span');
        lead.className='countLine';condition.className='countLine';
        lead.textContent='PRESS WHEN';condition.textContent=match?match[1]:item.text;
        text.replaceChildren(lead,condition);
      }else text.textContent=item.text;
      emoji.textContent=item.big||item.emoji||'';sub.textContent=item.sub||'';
      emoji.classList.toggle('manyEmoji',emojiCount>4);
      emoji.classList.toggle('denseEmoji',emojiCount>7);
      const stageEl=btn.querySelector('.promptStage');
      stageEl.style.setProperty('--prompt-half-height',`${text.getBoundingClientRect().height/2}px`);
      const stage=stageEl.getBoundingClientRect();
      const textBox=text.getBoundingClientRect();
      const visible=[emoji,text,sub,document.querySelector('#holdBar')].filter(el=>getComputedStyle(el).display!=='none');
      const countLineOverflow=item.countPrompt
        ?Math.max(0,...Array.from(text.querySelectorAll('.countLine'),line=>line.scrollWidth-line.clientWidth))
        :0;
      const overflow=visible.reduce((amount,el)=>{
        const box=el.getBoundingClientRect();
        return Math.max(amount,stage.top-box.top,box.bottom-stage.bottom,stage.left-box.left,box.right-stage.right);
      },countLineOverflow);
      const emojiBox=emoji.getBoundingClientRect();
      return {text:item.text,overflow,font:parseFloat(getComputedStyle(text).fontSize),dense:btn.classList.contains('denseContentPrompt'),countPrompt:Boolean(item.countPrompt),
        lines:Math.round(textBox.height/parseFloat(getComputedStyle(text).lineHeight)),
        centerDelta:Math.abs((textBox.top+textBox.bottom-stage.top-stage.bottom)/2),
        groupCenterDelta:Math.abs((emojiBox.top+textBox.bottom-stage.top-stage.bottom)/2)};
    });
  });
  for(const result of results){
    expect(result.overflow,result.text).toBeLessThanOrEqual(1);
    expect(result.font).toBeGreaterThanOrEqual(11);
    expect(result.centerDelta).toBeLessThanOrEqual(result.dense?12:2);
    if(result.dense)expect(result.groupCenterDelta).toBeLessThanOrEqual(9);
    if(result.countPrompt)expect(result.lines,result.text).toBeLessThanOrEqual(2);
  }
});

test('keeps the complete start UI inside a phone viewport', async ({ page }) => {
  await openApp(page);
  const boxes=await page.evaluate(() => {
    const overlay=document.querySelector('#startOverlay').getBoundingClientRect();
    const title=document.querySelector('.wordmark').getBoundingClientRect();
    const actions=document.querySelector('#modeHome .diffRow').getBoundingClientRect();
    const cardElements=[...document.querySelectorAll('#modeHome .diffBtn')];
    const cards=cardElements.map(el=>el.getBoundingClientRect());
    return {
      viewportWidth:innerWidth,overlayTop:overlay.top,overlayBottom:overlay.bottom,
      titleTop:title.top,titleBottom:title.bottom,actionsTop:actions.top,actionsWidth:actions.width,actionsBottom:actions.bottom,
      cardHeights:cards.map(card=>card.height),labels:cardElements.map(card=>({scroll:card.querySelector('.modeText').scrollWidth,width:card.querySelector('.modeText').clientWidth})),
    };
  });
  expect(boxes.titleTop).toBeGreaterThanOrEqual(boxes.overlayTop-1);
  expect(boxes.actionsBottom).toBeLessThanOrEqual(boxes.overlayBottom+1);
  expect(boxes.actionsTop).toBeGreaterThan(boxes.titleBottom);
  expect(boxes.actionsWidth).toBeLessThanOrEqual(Math.min(760,boxes.viewportWidth*.92)+1);
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
  await openApp(page);
  await page.click('.diffBtn[data-mode="classic"]');
  await expect.poll(()=>page.evaluate(()=>{
    if(document.querySelector('#promptText').textContent!=='PRESS')return false;
    document.querySelector('#btn').dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,bubbles:true}));
    return true;
  })).toBe(true);
  await expect.poll(()=>page.evaluate(()=>{
    if(document.querySelector('#promptText').textContent!=='DO NOT PRESS')return false;
    document.querySelector('#btn').dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,bubbles:true}));
    return true;
  })).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__vibratePattern)).toEqual([80,35,160]);
});

test('requests a lighter haptic pattern after a correct answer', async ({ page }) => {
  await page.addInitScript(() => {
    window.__vibratePattern=null;
    Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{
      window.__vibratePattern=pattern;
      return true;
    }});
  });
  await openApp(page);
  await page.click('.diffBtn[data-mode="classic"]');
  await expect.poll(()=>page.evaluate(()=>{
    if(document.querySelector('#promptText').textContent!=='PRESS')return false;
    document.querySelector('#btn').dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,bubbles:true}));
    return true;
  })).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__vibratePattern)).toEqual([25,18,45]);
});

test('keeps the removed category label hidden during dynamic modes', async ({ page }) => {
  await openApp(page);
  await page.click('#gradeSelectBtn');
  await page.click('.diffBtn[data-mode="explorer"]');
  await expect(page.locator('#catTag')).toHaveClass(/hidden/);
  await expect(page.locator('#catTag')).toBeEmpty();
});

test('dims the scenery and keeps music below feedback volume during play', async ({ page }) => {
  await openApp(page);
  await page.click('.diffBtn[data-mode="classic"]');
  const state=await page.evaluate(() => ({
    active:document.body.classList.contains('game-active'),
    musicVolume:document.querySelector('#themeMusic').volume,
  }));
  expect(state.active).toBe(true);
  expect(state.musicVolume).toBeLessThanOrEqual(.008);
  await expect.poll(()=>page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('#sun')).opacity)
  )).toBeLessThan(.7);
});

test('toggles game music directly from the speaker button', async ({ page }) => {
  await openApp(page);
  await page.click('.diffBtn[data-mode="classic"]');
  await page.click('#musicBtn');
  await expect(page.locator('#musicBtn')).toHaveClass(/muted/);
  await expect(page.locator('#musicBtn')).toHaveAttribute('aria-label','Play music');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('wyp-music-muted'))).toBe('1');
  await expect.poll(()=>page.evaluate(()=>document.querySelector('#themeMusic').paused)).toBe(true);
  await page.click('#musicBtn');
  await expect(page.locator('#musicBtn')).not.toHaveClass(/muted/);
  await expect(page.locator('#musicBtn')).toHaveAttribute('aria-label','Mute music');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('wyp-music-muted'))).toBe('0');
});

test('opens a well-aligned front-page slider and persists audio state', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#startAudioControl')).toBeVisible();
  await expect(page.locator('#startVolumePanel')).toHaveClass(/hidden/);
  await page.click('#startAudioBtn');
  await expect(page.locator('#startVolumePanel')).toBeVisible();
  await expect(page.locator('#startAudioBtn')).toHaveAttribute('aria-expanded','true');
  const placement=await page.evaluate(()=>{
    const panel=document.querySelector('#startVolumePanel').getBoundingClientRect();
    const button=document.querySelector('#startAudioBtn').getBoundingClientRect();
    const slider=document.querySelector('#startVolumeSlider').getBoundingClientRect();
    const appStyle=getComputedStyle(document.querySelector('#app'));
    return {panelLeft:panel.left,panelRight:panel.right,panelTop:panel.top,panelWidth:panel.width,panelHeight:panel.height,
      buttonLeft:button.left,buttonRight:button.right,buttonBottom:button.bottom,sliderWidth:slider.width,sliderHeight:slider.height,
      appBorderColor:appStyle.borderColor};
  });
  expect(placement.panelTop).toBeGreaterThanOrEqual(placement.buttonBottom+7);
  expect(Math.abs((placement.panelLeft+placement.panelRight-placement.buttonLeft-placement.buttonRight)/2)).toBeLessThanOrEqual(1);
  expect(placement.panelHeight).toBeGreaterThan(placement.panelWidth*2);
  expect(placement.sliderHeight).toBeGreaterThan(placement.sliderWidth*3);
  expect(placement.appBorderColor).toMatch(/rgba\([^)]*, 0\)|transparent/);
  await page.locator('#startVolumeSlider').fill('42');
  await expect(page.locator('#startVolumeValue')).toHaveText('42%');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('wyp-music-volume'))).toBe('0.42');

  await page.click('#startMuteToggle');
  await expect(page.locator('#startMuteToggle')).toHaveText('PLAY');
  await expect(page.locator('#startAudioBtn')).toHaveClass(/muted/);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('wyp-music-muted'))).toBe('1');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-app-ready','true');
  await expect(page.locator('#startVolumeValue')).toHaveText('42%');
  await expect(page.locator('#startAudioBtn')).toHaveClass(/muted/);

  await page.click('.diffBtn[data-mode="classic"]');
  await page.click('#musicBtn');
  await expect(page.locator('#musicBtn')).not.toHaveClass(/muted/);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('wyp-music-muted'))).toBe('0');
});
