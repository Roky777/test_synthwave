/* ============================================================
   PRESS TO KNOW — DOM wiring & game loop
   ============================================================ */
import {
  CAT_META, MODES, TOTAL, rnd, computePoints, buildSequence, OVER_FACTS, loadGameData,
} from './game-logic.js';

const AUDIO_BUNDLE_URL=new URL('assets/theme-audio.wasm',document.baseURI).href;
// Where the tracks live when the WASM bundle isn't there to unpack.
const SOURCE_TRACKS={
  synthwave:new URL('src/assets/audio/echoes.mp3',document.baseURI).href,
  nebula:new URL('src/assets/audio/Cornfieldchase.mp3',document.baseURI).href,
};
async function loadThemeTracks(){
  let response;
  try{response=await fetch(AUDIO_BUNDLE_URL);}
  catch(error){
    console.warn('Could not reach the theme audio bundle; using source audio files.',error);
    return SOURCE_TRACKS;
  }
  // Only `vite build` emits assets/theme-audio.wasm (and vite dev serves it from middleware).
  // Opening the source tree on a plain static server has no such file — that's the documented
  // fallback path, not a fault, so it shouldn't log like one.
  if(response.status===404)return SOURCE_TRACKS;
  try{
    if(!response.ok)throw new Error(`Unable to load theme audio (${response.status})`);
    let module;
    try{module=await WebAssembly.compileStreaming(Promise.resolve(response.clone()));}
    catch{module=await WebAssembly.compile(await response.arrayBuffer());}
    const track=name=>{
      const bytes=WebAssembly.Module.customSections(module,name)[0];
      if(!bytes)throw new Error(`Missing audio track in WASM bundle: ${name}`);
      return URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));
    };
    return {
      synthwave:track('echoes.mp3'),
      nebula:track('Cornfieldchase.mp3'),
    };
  }catch(error){
    // The bundle was served but is unreadable — that IS worth surfacing.
    console.warn('Theme audio bundle could not be unpacked; using source audio files.',error);
    return SOURCE_TRACKS;
  }
}

async function main(){
await loadGameData();
const THEME_TRACKS=await loadThemeTracks();

/* ------------------- AUDIO ------------------- */
let AC=null;
function beep(freq,t=0.09,type='square',gain=0.05,when=0){
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    const o=AC.createOscillator(),g=AC.createGain();
    o.type=type;o.frequency.value=freq;
    g.gain.setValueAtTime(gain,AC.currentTime+when);
    g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+when+t);
    o.connect(g).connect(AC.destination);
    o.start(AC.currentTime+when);o.stop(AC.currentTime+when+t+0.02);
  }catch(e){}
}
const sOk=()=>{beep(660,.08,'square',.05);beep(990,.12,'square',.05,.08);};
const sBad=()=>{beep(160,.28,'sawtooth',.07);beep(110,.3,'sawtooth',.06,.05);};
const sTick=()=>beep(1200,.03,'square',.03);
const sTap=()=>beep(440,.04,'square',.04);
const sScare=()=>{beep(70,.5,'sawtooth',.12);beep(55,.6,'sawtooth',.1,.05);beep(900,.15,'square',.06,.02);};

/* ------------------- GAME ------------------- */
const $=id=>document.getElementById(id);
const els={app:$('app'),hud:$('hud'),machine:$('machine'),btn:$('btn'),ring:$('ringSvg'),
 text:$('promptText'),emoji:$('promptEmoji'),sub:$('promptSub'),
 holdBar:$('holdBar'),holdFill:$('holdFill'),
 score:$('score'),streak:$('streak'),hearts:$('hearts'),banner:$('banner'),rules:$('rules'),
 catTag:$('catTag'),scareEl:$('scare'),scareEmoji:$('scareEmoji'),scareText:$('scareText'),
 start:$('startOverlay'),over:$('overOverlay'),exitBtn:$('exitBtn'),
 musicBtn:$('musicBtn'),themeMusic:$('themeMusic'),startAudioBtn:$('startAudioBtn'),
 startVolumePanel:$('startVolumePanel'),startMuteToggle:$('startMuteToggle'),startVolumeSlider:$('startVolumeSlider'),
 startVolumeValue:$('startVolumeValue'),quitDialog:$('quitDialog'),
 stayBtn:$('stayBtn'),quitBtn:$('quitBtn'),modeHome:$('modeHome'),gradeView:$('gradeView'),
 gradeSelectBtn:$('gradeSelectBtn'),gradeBackBtn:$('gradeBackBtn'),overMenuBtn:$('overMenuBtn')};

const hyperspace=$('hyperspace');
for(let i=0;i<32;i++){
  const trail=document.createElement('i');
  trail.style.setProperty('--trail-angle',`${(i*137.5+(i%4)*7)%360}deg`);
  trail.style.setProperty('--trail-start',`${4+(i%6)*2}vmin`);
  trail.style.setProperty('--trail-length',`clamp(24px,${5+(i%5)*1.2}vmin,92px)`);
  trail.style.setProperty('--trail-width',`${1+(i%3)*.55}px`);
  trail.style.setProperty('--trail-duration',`${1.35+(i%7)*.12}s`);
  trail.style.setProperty('--trail-delay',`${-(i%16)*.11}s`);
  hyperspace.appendChild(trail);
}

/* ------------------- BACKGROUND THEME ------------------- */
const BG_THEME_KEY='wyp-bg-theme';
const MUSIC_VOLUME_KEY='wyp-music-volume';
const MUSIC_MUTED_KEY='wyp-music-muted';
const themeBtns=document.querySelectorAll('.themeBtn');
const THEME_TRACK_START={synthwave:0,nebula:32};
// Background music is intentionally atmospheric; gameplay cues and countdown ticks stay dominant.
const MAX_MUSIC_VOLUME=.025;
let musicLevel=.2;
try{
  const savedLevel=Number(localStorage.getItem(MUSIC_VOLUME_KEY)??.2);
  if(Number.isFinite(savedLevel))musicLevel=Math.max(0,Math.min(1,savedLevel));
}catch{}
let musicMuted=false;
try{musicMuted=localStorage.getItem(MUSIC_MUTED_KEY)==='1';}catch{}
if(musicLevel===0)musicMuted=true;
let musicSource=null,musicFilter=null,musicGain=null,pendingMusicFade=false,musicPauseTO=0;
function syncMusicControls(){
  const percent=Math.round(musicLevel*100);
  els.startVolumeSlider.value=String(percent);
  els.startVolumeValue.textContent=`${percent}%`;
  els.startMuteToggle.textContent=musicMuted?'PLAY':'MUTE';
  els.startAudioBtn.classList.toggle('muted',musicMuted);
}
function applyMusicLevel(level,unmute=true){
  musicLevel=Math.max(0,Math.min(1,level));
  if(musicLevel===0)musicMuted=true;
  else if(unmute)musicMuted=false;
  els.themeMusic.volume=MAX_MUSIC_VOLUME*musicLevel;
  els.themeMusic.muted=musicMuted;
  syncMusicControls();
  try{
    localStorage.setItem(MUSIC_VOLUME_KEY,String(musicLevel));
    localStorage.setItem(MUSIC_MUTED_KEY,musicMuted?'1':'0');
  }catch{}
  syncMusicButton();
}
applyMusicLevel(musicLevel,false);
function toggleMusicPlayback(){
  clearTimeout(musicPauseTO);
  if(musicMuted){
    if(musicLevel===0)musicLevel=.2;
    musicMuted=false;
    applyMusicLevel(musicLevel,false);
    playThemeMusic();
    if(musicGain&&AC){
      const now=AC.currentTime;
      musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setValueAtTime(.001,now);
      musicGain.gain.exponentialRampToValueAtTime(1,now+.12);
    }
    return;
  }
  musicMuted=true;
  syncMusicControls();syncMusicButton();
  try{localStorage.setItem(MUSIC_MUTED_KEY,'1');}catch{}
  if(musicGain&&AC&&!els.themeMusic.paused){
    // Fade to near-silence before pausing. An immediate media-element cut can create an audible
    // discontinuity (the brief "hangup" pop heard on some phone audio stacks).
    const now=AC.currentTime;
    els.themeMusic.muted=false;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(Math.max(.001,musicGain.gain.value),now);
    musicGain.gain.exponentialRampToValueAtTime(.001,now+.07);
    musicPauseTO=setTimeout(()=>{
      if(!musicMuted)return;
      els.themeMusic.pause();els.themeMusic.muted=true;
    },90);
  }else{
    els.themeMusic.pause();els.themeMusic.muted=true;
  }
}
function ensureMusicAudioGraph(){
  if(musicFilter)return;
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    musicSource=AC.createMediaElementSource(els.themeMusic);
    musicFilter=AC.createBiquadFilter();
    musicFilter.type='lowpass';
    musicFilter.frequency.value=18000;
    musicFilter.Q.value=.7;
    musicGain=AC.createGain();
    musicSource.connect(musicFilter).connect(musicGain).connect(AC.destination);
  }catch(e){}
}
function playThemeMusic(){
  const theme=document.documentElement.dataset.theme;
  if(!THEME_TRACKS[theme])return;
  ensureMusicAudioGraph();
  if(AC?.state==='suspended')AC.resume().catch(()=>{});
  const start=THEME_TRACK_START[theme]||0;
  if(els.themeMusic.readyState>0&&els.themeMusic.currentTime<start)els.themeMusic.currentTime=start;
  if(pendingMusicFade&&musicGain){
    const now=AC.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(.001,now);
    musicGain.gain.exponentialRampToValueAtTime(1,now+1.2);
    pendingMusicFade=false;
  }
  els.themeMusic.muted=musicMuted;
  els.themeMusic.play().catch(()=>{});
}
function distortThemeMusic(){
  if(!musicFilter||els.themeMusic.paused||musicMuted)return;
  const now=AC.currentTime,duration=1.45,curve=new Float32Array(61);
  // One smooth crest → trough → crest cycle: open, muffled, then fully recovered.
  for(let i=0;i<curve.length;i++){
    const phase=i/(curve.length-1);
    const wave=(1+Math.cos(phase*Math.PI*2))/2;
    curve[i]=500+17500*Math.pow(wave,1.7);
  }
  musicFilter.frequency.cancelScheduledValues(now);
  musicFilter.Q.cancelScheduledValues(now);
  musicFilter.frequency.setValueCurveAtTime(curve,now,duration);
  musicFilter.Q.setValueAtTime(7,now);
  musicFilter.Q.exponentialRampToValueAtTime(.7,now+duration);
}
function duckThemeMusic(duration=.9){
  if(!musicGain||els.themeMusic.paused||musicMuted)return;
  const now=AC.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(Math.max(.001,musicGain.gain.value),now);
  musicGain.gain.exponentialRampToValueAtTime(.1,now+.035);
  musicGain.gain.exponentialRampToValueAtTime(1,now+duration);
}
function vibrate(pattern){
  try{
    if(typeof navigator.vibrate!=='function')return false;
    navigator.vibrate(0);
    return navigator.vibrate(pattern);
  }catch{return false;}
}
const tapHaptic=()=>vibrate(16);
const correctAnswerHaptic=()=>vibrate([25,18,45]);
const wrongAnswerHaptic=()=>vibrate([80,35,160]);
const gameOverHaptic=()=>vibrate([120,50,180,60,260]);
const holdCompleteHaptic=()=>vibrate([30,20,65]);
function syncMusicButton(){
  const inGame=!els.hud.classList.contains('hidden');
  els.musicBtn.classList.toggle('hidden',!inGame);
  els.musicBtn.classList.toggle('muted',musicMuted);
  els.musicBtn.setAttribute('aria-label',musicMuted?'Play music':'Mute music');
  els.musicBtn.title=musicMuted?'Play music':'Mute music';
}
function applyBgTheme(theme,userInitiated=false){
  document.documentElement.dataset.theme=theme;
  themeBtns.forEach(b=>b.classList.toggle('active', b.dataset.themeBtn===theme));
  const track=THEME_TRACKS[theme];
  if(track&&els.themeMusic.getAttribute('src')!==track){
    els.themeMusic.pause();
    els.themeMusic.setAttribute('src',track);
    els.themeMusic.load();
    pendingMusicFade=true;
  }
  if(userInitiated)playThemeMusic();
  syncMusicButton();
  try{localStorage.setItem(BG_THEME_KEY,theme);}catch{}
}
themeBtns.forEach(b=>b.addEventListener('click',()=>applyBgTheme(b.dataset.themeBtn,true)));
els.musicBtn.addEventListener('click',event=>{
  event.stopPropagation();
  toggleMusicPlayback();
});
els.startAudioBtn.addEventListener('click',event=>{
  event.stopPropagation();
  els.startVolumePanel.classList.toggle('hidden');
  els.startAudioBtn.setAttribute('aria-expanded',String(!els.startVolumePanel.classList.contains('hidden')));
});
els.startVolumePanel.addEventListener('click',event=>event.stopPropagation());
els.startVolumeSlider.addEventListener('input',()=>{
  applyMusicLevel(Number(els.startVolumeSlider.value)/100);
  if(!musicMuted)playThemeMusic();
});
els.startMuteToggle.addEventListener('click',event=>{event.stopPropagation();toggleMusicPlayback();});
document.addEventListener('click',()=>{
  if(els.startVolumePanel.classList.contains('hidden'))return;
  els.startVolumePanel.classList.add('hidden');
  els.startAudioBtn.setAttribute('aria-expanded','false');
});
els.themeMusic.addEventListener('loadedmetadata',()=>{
  const start=THEME_TRACK_START[document.documentElement.dataset.theme]||0;
  if(els.themeMusic.currentTime<start)els.themeMusic.currentTime=start;
});
els.themeMusic.addEventListener('ended',()=>{
  els.themeMusic.currentTime=THEME_TRACK_START[document.documentElement.dataset.theme]||0;
  playThemeMusic();
});
// Derived from the markup so parking/unparking a theme is just the `disabled` attribute.
const enabledThemes=[...themeBtns].filter(b=>!b.disabled).map(b=>b.dataset.themeBtn);
let savedTheme='synthwave';
try{savedTheme=localStorage.getItem(BG_THEME_KEY)||'synthwave';}catch{}
// A previously-saved pick can point at a theme that's since been disabled — that would strand the
// player there with no enabled button to switch back.
if(!enabledThemes.includes(savedTheme))savedTheme=enabledThemes[0]||'synthwave';
applyBgTheme(savedTheme);
// No playback attempt before a gesture: browsers block autoplay anyway, and reaching for the
// AudioContext this early is what triggers Chrome's "was not allowed to start" warning. These
// handlers start the music on the first interaction, which is the earliest it could have played.
document.addEventListener('pointerdown',playThemeMusic,{once:true});
document.addEventListener('keydown',playThemeMusic,{once:true});

const SEGS=30; let segEls=[];
// The timer runs at the display refresh rate, but its 30 segments only visibly change
// a few times per second. Avoid rewriting every SVG path on every frame: on some mobile
// GPUs those redundant mutations repeatedly invalidate the filtered ring and can flicker.
let lastRingLit=-1,lastRingColor='';
(function buildRing(){
  // Countdown ring: ~30 chunky dashes clear of the orb's static cyan bezel. Butt caps (not round) keep the
  // ticks squared off; round caps add RING_W/2 of length at each end, which is what made them read
  // as lozenges. gap is per-side in degrees -- at this radius it leaves each tick ~1.3:1.
  // RING_R/RING_W are in the 100-unit viewBox that spans --size.
  const NS='http://www.w3.org/2000/svg',cx=50,cy=50,RING_R=45.8,RING_W=3.4,gap=2.9;
  for(let i=0;i<SEGS;i++){
    const a0=(i/SEGS)*2*Math.PI+gap*Math.PI/180,a1=((i+1)/SEGS)*2*Math.PI-gap*Math.PI/180;
    const p=document.createElementNS(NS,'path');
    const x=a=>cx+RING_R*Math.cos(a),y=a=>cy+RING_R*Math.sin(a);
    p.setAttribute('d',`M${x(a0)},${y(a0)} A${RING_R},${RING_R} 0 0 1 ${x(a1)},${y(a1)}`);
    p.setAttribute('fill','none');
    p.setAttribute('stroke-width',RING_W);
    p.setAttribute('stroke-linecap','butt');
    els.ring.appendChild(p);segEls.push(p);
  }
})();
let curAccent='#FF3E9A';
function mixTimerColor(from,to,amount){
  const channel=index=>Math.round(from[index]+(to[index]-from[index])*amount);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}
function paintRing(frac){
  const lit=Math.ceil(frac*SEGS);
  // Quantize the continuous time gradient to 60 visually smooth steps. This preserves the
  // ring's low-mutation mobile renderer while making color depend on time remaining only.
  const urgency=Math.round((1-frac)*60)/60;
  // Timer color communicates time only. Interpolate through the warm synthwave ramp without
  // borrowing cyan from the surrounding UI or changing treatment based on the instruction.
  const stops=[
    {at:0,color:[168,85,247]},   // purple — plenty of time
    {at:.25,color:[217,70,239]}, // magenta
    {at:.5,color:[244,63,158]},  // hot pink
    {at:.7,color:[251,95,112]},  // coral
    {at:.85,color:[255,138,43]}, // orange — urgent
    {at:1,color:[255,138,43]},
  ];
  const upper=stops.findIndex(stop=>urgency<=stop.at);
  const to=stops[Math.max(1,upper)],from=stops[Math.max(0,upper-1)];
  const col=mixTimerColor(from.color,to.color,(urgency-from.at)/(to.at-from.at||1));
  if(lit===lastRingLit&&col===lastRingColor)return;
  lastRingLit=lit;lastRingColor=col;
  els.ring.style.setProperty('--timer-color',col);
  segEls.forEach((p,i)=>{
    const active=i<lit;
    // Active tiles are colour-filled; spent tiles retain a dark, low-contrast silhouette.
    p.setAttribute('stroke',active?col:'rgba(15,4,22,.76)');
    p.setAttribute('opacity',active?'.96':'.42');
  });
}
function setAccent(hex,label){
  curAccent=hex;
  document.documentElement.style.setProperty('--accent',hex);
  document.documentElement.style.setProperty('--accent-soft',hex+'CC');
  els.catTag.textContent='';
}

const RESULTS_KEY='wyp-results-v1';
const EMPTY_BESTS={classic:0,explorer:0,challenger:0,mastermind:0};
let BESTS={...EMPTY_BESTS};
try{
  const saved=JSON.parse(localStorage.getItem(RESULTS_KEY)||'null');
  if(saved?.version===1&&saved.bestByMode)BESTS={...EMPTY_BESTS,...saved.bestByMode};
}catch{}
function saveBests(){
  try{localStorage.setItem(RESULTS_KEY,JSON.stringify({version:1,bestByMode:BESTS}));}catch{}
}

let G=null;
// Screen 3 shows lives as filled hearts plus hollow outlines for the ones spent.
function setHearts(lives){
  const n=Math.max(0,Math.min(3,lives));
  els.hearts.innerHTML='<span class="heart">\u2665</span>'.repeat(n)
    +'<span class="heart gone">\u2665</span>'.repeat(3-n);
}

function newGame(mode){
  G={mode, seq:buildSequence(mode), i:0, score:0, streak:0, bestStreak:0, lives:3, solved:0,
     presses:0, holdStart:0, holdDone:false, t0:0, dur:0, raf:0, scareTO:0, nextTO:0, endTO:0, phase:'idle'};
  els.score.textContent='0';els.streak.textContent='×0';
  setHearts(3);els.rules.innerHTML='';
}

function applyFx(fx){
  els.machine.classList.toggle('tiny', fx==='tiny');
  els.machine.style.transform = els.machine.classList.contains('tiny') ? '' : 'translate(0,0)';
  if(fx==='runaway'){
    let hops=0;
    const hop=()=>{ if(G.phase!=='live'||hops>=2) {els.machine.style.transform='translate(0,0)';return;}
      hops++;
      const dx=(Math.random()*36-18), dy=(Math.random()*24-12);
      els.machine.style.transform=`translate(${dx}vw ,${dy}vh)`.replace('vw ,','vw,');
      setTimeout(hop, 750);
    };
    setTimeout(hop, 500);
  }
}

function countGraphemes(value){
  if(!value)return 0;
  try{return [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)].filter(x=>x.segment.trim()).length;}
  catch{return Array.from(value).filter(x=>x.trim()).length;}
}

// Prompt copy lives in editable JSON, so character-count buckets alone can never guarantee a fit --
// a 29-char prompt sits under the >16 bucket boundary yet still needs three lines. This shrinks the
// whole stack until it actually clears the button face, whatever the copy turns out to be.
function fitPromptToFace(){
  const b=els.btn;
  const stage=b.querySelector('.promptStage');
  b.classList.remove('breakWords');
  b.style.setProperty('--prompt-scale','1');
  const syncOffsets=()=>stage.style.setProperty('--prompt-half-height',`${els.text.getBoundingClientRect().height/2}px`);
  // Details are absolutely anchored around the centred instruction, so inspect their
  // rendered bounds rather than reserving permanent rows for content that may not exist.
  const overflows=()=>{
    syncOffsets();
    const bounds=stage.getBoundingClientRect();
    const visible=[els.emoji,els.text,els.sub,els.holdBar].filter(el=>getComputedStyle(el).display!=='none');
    return els.text.scrollWidth>els.text.clientWidth+1||visible.some(el=>{
      const box=el.getBoundingClientRect();
      return box.top<bounds.top-1||box.bottom>bounds.bottom+1||box.left<bounds.left-1||box.right>bounds.right+1;
    });
  };
  let scale=1;
  while(scale>0.45 && overflows()){
    scale-=0.07;
    b.style.setProperty('--prompt-scale',scale.toFixed(3));
  }
  // Shrinking is always preferable to snapping a word in half, so this only ever applies to copy
  // that still doesn't fit at the floor.
  if(overflows())b.classList.add('breakWords');
  syncOffsets();
}

function showPrompt(){
  const it=G.seq[G.i];
  if(!it){endGame(true);return;}
  els.btn.classList.remove('readyPrompt');
  if(G.mode.features.dynamicAccent){
    const meta=CAT_META[it.type]||CAT_META.simple;
    setAccent(meta[0],meta[1]);
  } else {
    setAccent('#B24BF3','CLASSIC');
  }
  G.presses=0;G.holdStart=0;G.holdDone=false;G.phase='live';
  G.dur=it.dur*1000;G.t0=performance.now();G.lastTick=-1;
  const promptLength=(it.text||'').trim().length;
  els.btn.classList.toggle('shortPrompt',promptLength<=12&&!it.emoji&&!it.big);
  els.btn.classList.toggle('longPrompt',promptLength>18);
  els.btn.classList.toggle('veryLongPrompt',promptLength>30);
  els.btn.classList.toggle('withPromptDetails',Boolean(it.emoji||it.big||it.sub));
  els.btn.classList.toggle('numericPrompt',Boolean(it.big));
  els.btn.classList.toggle('countPrompt',it.type==='count');
  if(it.type==='count'){
    const match=it.text.match(/^PRESS WHEN (.+)$/);
    const lead=document.createElement('span');
    const condition=document.createElement('span');
    lead.className='countLine';condition.className='countLine';
    lead.textContent='PRESS WHEN';condition.textContent=match?match[1]:it.text;
    els.text.replaceChildren(lead,condition);
  }else els.text.textContent=it.text;
  const emojiValue=it.big||it.emoji||'';
  const emojiCount=it.big?1:countGraphemes(emojiValue);
  els.btn.classList.toggle('denseContentPrompt',emojiCount>4&&promptLength>18);
  els.emoji.textContent=emojiValue;
  els.emoji.classList.toggle('manyEmoji',emojiCount>4);
  els.emoji.classList.toggle('denseEmoji',emojiCount>7);
  els.emoji.style.fontSize='';
  els.sub.textContent=it.sub||'';
  els.btn.classList.toggle('holdPrompt',it.type==='hold');
  els.holdFill.style.width='0%';
  fitPromptToFace();
  applyFx(it.fx||null);
  // jumpscare scheduling
  clearTimeout(G.scareTO);
  if(it.type==='scare'){
    G.scareTO=setTimeout(()=>{
      if(G.phase!=='live')return;
      els.scareEmoji.textContent=it.scare.emoji;
      els.scareText.textContent=it.scare.text;
      els.scareEl.classList.add('show');sScare();
      els.app.classList.add('shake');setTimeout(()=>els.app.classList.remove('shake'),380);
      setTimeout(()=>els.scareEl.classList.remove('show'),1100);
    }, G.dur*(0.35+Math.random()*0.25));
  }
  paintRing(1);
  cancelAnimationFrame(G.raf);
  const loop=now=>{
    if(G.phase!=='live')return;
    const left=1-(now-G.t0)/G.dur;
    paintRing(Math.max(0,left));
    if(G.holdStart&&!G.holdDone){
      const held=now-G.holdStart;
      els.holdFill.style.width=Math.min(100,held/20)+'%';
      if(held>=2000){G.holdDone=true;holdCompleteHaptic();succeed('ROCK-SOLID GRIP',false);return;}
    }
    const secLeft=Math.ceil(left*G.dur/1000);
    if(left<0.32&&secLeft!==G.lastTick){G.lastTick=secLeft;sTick();}
    if(left<=0){onTimeout();return;}
    G.raf=requestAnimationFrame(loop);
  };
  G.raf=requestAnimationFrame(loop);
}

function onPressDown(){
  if(G.phase!=='live')return;
  els.btn.classList.add('pressed');setTimeout(()=>els.btn.classList.remove('pressed'),70);
  tapHaptic();
  const it=G.seq[G.i];
  if(it.expected==='hold'){ if(!G.holdStart){G.holdStart=performance.now();els.btn.classList.add('holding');sTap();} return; }
  if(it.expected==='multi'){G.presses++;sTap();return;}
  if(it.expected==='press') succeed(it.type==='boss'?'BOSS DOWN!':'PRESSED IN TIME');
  else fail(it.type==='remember'?'IT SAID JUST REMEMBER!':
            it.type==='scare'?'THE GHOST GOT YOU! IT SAID DON\'T PRESS!':
            it.type==='sticky'?'THE SNAKE RULE! 🐍 = NEVER PRESS':
            it.type==='fact'||it.type==='flag'||it.type==='recall'||it.type==='boss'?'THAT WAS FALSE!':
            "IT SAID DON'T PRESS!");
}
function onPressUp(){
  if(!G||G.phase!=='live')return;
  const it=G.seq[G.i];
  if(it.expected==='hold'&&G.holdStart&&!G.holdDone){
    els.btn.classList.remove('holding');
    fail('RELEASED TOO EARLY! HOLD FOR 2 SECONDS');
  }
}
function onTimeout(){
  const it=G.seq[G.i];
  if(it.expected==='multi'){
    const ok=it.mode==='more'?G.presses>it.n:G.presses===it.n;
    ok?succeed('PERFECT COUNT'):fail(it.mode==='more'?`NEEDED MORE THAN ${it.n} PRESSES!`:`NEEDED EXACTLY ${it.n} PRESSES!`);
    return;
  }
  if(it.expected==='hold'){fail(G.holdStart?'ALMOST! HOLD THE FULL 2 SECONDS':'YOU NEVER GRABBED IT!');return;}
  if(it.expected==='wait') succeed(it.type==='remember'?'NUMBER STORED 🧠':it.type==='scare'?'FEARLESS. RESPECT.':'NERVES OF STEEL');
  else fail(it.type==='sticky'?'THE RAT RULE! 🐀 = ALWAYS PRESS':
            it.type==='fact'||it.type==='flag'||it.type==='recall'||it.type==='boss'?'THAT WAS TRUE — PRESS NEXT TIME!':
            'TOO SLOW!');
}

function succeed(msg,withHaptic=true){
  G.phase='fb';cancelAnimationFrame(G.raf);clearTimeout(G.scareTO);
  els.btn.classList.remove('holding');
  const it=G.seq[G.i];
  if(it.rule){const c=document.createElement('div');c.className='chip';c.textContent=it.rule.label;els.rules.appendChild(c);}
  G.streak++;G.bestStreak=Math.max(G.bestStreak,G.streak);G.solved++;
  const pts=computePoints(G.streak, !!it.double);
  G.score+=pts;
  let extra='';
  if(G.mode.features.lifeRegen && G.solved%12===0&&G.lives<3){
    G.lives++;extra=' • ❤ RESTORED!';
    setHearts(G.lives);
    beep(880,.1,'triangle',.06,.2);
  }
  els.score.textContent=G.score;els.streak.textContent='×'+G.streak;
  flash(true,`+${pts} • ${msg}${extra}`);duckThemeMusic(.7);if(withHaptic)correctAnswerHaptic();sOk();
  next(620);
}
function fail(reason){
  G.phase='fb';cancelAnimationFrame(G.raf);clearTimeout(G.scareTO);
  els.btn.classList.remove('holding');els.scareEl.classList.remove('show');
  G.streak=0;G.lives--;els.streak.textContent='×0';
  setHearts(G.lives);
  flash(false,reason);duckThemeMusic(1.1);distortThemeMusic();
  if(G.lives<=0)gameOverHaptic();else wrongAnswerHaptic();
  sBad();
  els.app.classList.add('shake');setTimeout(()=>els.app.classList.remove('shake'),380);
  if(G.lives<=0){G.endTO=setTimeout(()=>{if(G.phase==='fb')endGame(false,reason);},750);}
  else next(1050);
}
function flash(ok,msg){
  els.btn.classList.add(ok?'flashOk':'flashBad');
  els.banner.textContent=msg;els.banner.className='show '+(ok?'ok':'bad');
  setTimeout(()=>{els.btn.classList.remove('flashOk','flashBad');els.banner.className='';},ok?520:950);
}
function next(delay){
  G.nextTO=setTimeout(()=>{
    if(G.phase!=='fb')return;
    G.i++;els.machine.style.transform='translate(0,0)';els.machine.classList.remove('tiny');
    if(G.lives>0)showPrompt();},delay);
}

function endGame(won,reason){
  G.phase='over';
  document.body.classList.remove('game-active');
  const previousBest=BESTS[G.mode.key]||0;
  const isNewBest=G.score>previousBest;
  if(isNewBest){BESTS[G.mode.key]=G.score;saveBests();}
  els.quitDialog.classList.add('hidden');
  els.machine.classList.add('hidden');els.hud.classList.add('hidden');
  els.rules.classList.add('hidden');els.catTag.classList.add('hidden');
  els.musicBtn.classList.add('hidden');
  els.exitBtn.classList.add('hidden');
  $('overTitle').textContent=won?'YOU WIN':'MACHINE WINS';
  $('modeBadge').textContent=(G.mode.key==='classic'?'RANDOM':G.mode.label)+' MODE';
  $('failReason').textContent=won?'FAST REFLEXES. PERFECT TIMING.':(reason||'');
  $('finalScore').textContent=G.score;$('finalSolved').textContent=G.solved+'/'+TOTAL;
  $('finalStreak').textContent=G.bestStreak;$('bestScore').textContent=previousBest;
  const recordStatus=$('recordStatus');
  recordStatus.classList.toggle('newBest',isNewBest);
  recordStatus.textContent=isNewBest
    ?`NEW PERSONAL BEST · +${G.score-previousBest}`
    :G.score===previousBest&&G.score>0
      ?'PERSONAL BEST MATCHED'
      :`${previousBest-G.score} POINTS BELOW YOUR BEST`;
  $('funFact').innerHTML='<b>DID YOU KNOW?</b> '+rnd(OVER_FACTS);
  els.over.classList.remove('hidden');
}

function openQuitDialog(){
  if(!G||G.phase==='over'||G.phase==='confirm')return;
  G.quitPhase=G.phase;
  G.phase='confirm';
  cancelAnimationFrame(G.raf);
  clearTimeout(G.scareTO);clearTimeout(G.nextTO);clearTimeout(G.endTO);
  els.scareEl.classList.remove('show');
  els.btn.classList.remove('holding','pressed');
  els.quitDialog.classList.remove('hidden');
  els.stayBtn.focus();
}
function closeQuitDialog(){
  if(!G||G.phase!=='confirm')return;
  els.quitDialog.classList.add('hidden');
  const previous=G.quitPhase;
  if(previous==='live')showPrompt();
  else if(previous==='fb'){
    G.phase='fb';
    if(G.lives>0)next(250);
    else G.endTO=setTimeout(()=>endGame(false,'RUN ENDED'),250);
  }else{
    G.phase='idle';
    G.nextTO=setTimeout(showPrompt,300);
  }
}
function showModeHome(){
  els.modeHome.classList.remove('hidden');
  els.gradeView.classList.add('hidden');
  els.gradeSelectBtn.focus();
}
function showGradeModes(){
  els.modeHome.classList.add('hidden');
  els.gradeView.classList.remove('hidden');
  els.gradeView.querySelector('[data-mode]')?.focus();
}
// Return to mode select after confirmation in the in-game dialog.
function quitToMenu(){
  if(!G||G.phase!=='confirm')return;
  G.phase='over';
  document.body.classList.remove('game-active');
  cancelAnimationFrame(G.raf);
  clearTimeout(G.scareTO);clearTimeout(G.nextTO);clearTimeout(G.endTO);
  els.scareEl.classList.remove('show');
  els.btn.classList.remove('holding','pressed','flashOk','flashBad');
  els.banner.className='';
  els.machine.classList.add('hidden');els.hud.classList.add('hidden');
  els.rules.classList.add('hidden');els.catTag.classList.add('hidden');els.exitBtn.classList.add('hidden');
  els.musicBtn.classList.add('hidden');
  els.quitDialog.classList.add('hidden');
  els.over.classList.add('hidden');
  els.start.classList.remove('hidden');
  showModeHome();
}
els.exitBtn.addEventListener('click',openQuitDialog);
els.stayBtn.addEventListener('click',closeQuitDialog);
els.quitBtn.addEventListener('click',quitToMenu);
els.gradeSelectBtn.addEventListener('click',showGradeModes);
els.gradeBackBtn.addEventListener('click',showModeHome);

let lastMode='classic';
function startGame(modeKey){
  const mode = MODES[modeKey] || MODES.challenger;
  lastMode = mode.key;
  document.body.classList.add('game-active');
  els.start.classList.add('hidden');els.over.classList.add('hidden');
  newGame(mode);
  els.machine.classList.remove('hidden');els.hud.classList.remove('hidden');
  els.rules.classList.remove('hidden');els.exitBtn.classList.remove('hidden');
  playThemeMusic();syncMusicButton();
  els.catTag.classList.add('hidden');
  els.btn.classList.remove('shortPrompt','longPrompt','veryLongPrompt','withPromptDetails','numericPrompt','denseContentPrompt','countPrompt','holdPrompt','breakWords');
  els.btn.classList.add('readyPrompt');
  els.btn.style.setProperty('--prompt-scale','1');
  els.emoji.classList.remove('manyEmoji','denseEmoji');
  els.text.textContent='GET READY';els.emoji.textContent=mode.emoji;els.sub.textContent='';
  els.btn.classList.add('withPromptDetails');
  fitPromptToFace();
  setAccent(mode.features.dynamicAccent?'#FF3E9A':'#B24BF3','WARM-UP');paintRing(1);
  beep(520,.1);beep(660,.1,'square',.05,.15);
  G.nextTO=setTimeout(showPrompt,900);
}
function returnToMainMenu(){
  document.body.classList.remove('game-active');
  els.over.classList.add('hidden');
  els.start.classList.remove('hidden');
  showModeHome();
}

els.btn.addEventListener('pointerdown',e=>{
  e.preventDefault();
  // Keep receiving pointerup/move on this element even if the finger drifts off it mid-hold.
  try{els.btn.setPointerCapture(e.pointerId);}catch{}
  onPressDown();
});
els.btn.addEventListener('pointerup',e=>{e.preventDefault();onPressUp();});
els.btn.addEventListener('pointercancel',()=>onPressUp());
els.btn.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'&&!els.quitDialog.classList.contains('hidden')){closeQuitDialog();return;}
  if(e.code==='Escape'&&!els.gradeView.classList.contains('hidden')){showModeHome();return;}
  if((e.code==='Space'||e.code==='Enter')&&!e.repeat){
    if(!els.start.classList.contains('hidden')){
      startGame(els.gradeView.classList.contains('hidden')?'classic':'challenger');return;
    }
    if(!els.over.classList.contains('hidden')){startGame(lastMode);return;}
    e.preventDefault();onPressDown();
  }
});
window.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter')onPressUp();});
document.querySelectorAll('.diffBtn[data-mode]').forEach(b=>b.addEventListener('click',()=>startGame(b.dataset.mode)));
$('againBtn').addEventListener('click',()=>startGame(lastMode));
els.overMenuBtn.addEventListener('click',returnToMainMenu);
document.documentElement.dataset.appReady='true';
}

main().catch(error=>{
  console.error('Failed to start PRESS TO KNOW:',error);
});
