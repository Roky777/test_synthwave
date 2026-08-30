/* ============================================================
   PRESS TO KNOW — pure game logic (data + sequence generator)
   No DOM access here so this file can run in Node (unit tests)
   and in the browser (classic <script>, no bundler required).

   All content pools (facts, flags, fun prompts, modes, ...) live in
   ./data/game-data.json so the prompt pool can be edited/expanded
   without touching this file. Call loadGameData() once before using
   buildSequence() — see loadGameData() below.
   ============================================================ */

// Kept outside the JavaScript bundle so deployments can replace prompt data independently.
const DEFAULT_DATA_URL = 'src/data/game-data.json';

/* ------------------- CONTENT POOLS (populated by loadGameData) ------------------- */
export let FACTS = [];
export let FLAGS = [];
export let COUNT_EMOJIS = [];
export let FLAVOR_WAITS = [];
export let FUN_PROMPTS = [];
export let SCARES = [];
export let OVER_FACTS = [];
export let CAT_META = {};
export let MODES = {};

let dataLoaded = false;

export function isGameDataLoaded() {
  return dataLoaded;
}

// Loads the editable prompt-pool JSON and populates the pools above.
// `source` may be omitted (fetches ./data/game-data.json next to this file),
// a URL/string to fetch, or an already-parsed data object (used by unit tests).
export async function loadGameData(source = DEFAULT_DATA_URL) {
  const data =
    typeof source === 'string' || source instanceof URL
      ? await (await fetch(source)).json()
      : source;

  FACTS = data.facts;
  FLAGS = data.flags;
  COUNT_EMOJIS = data.countEmojis;
  FLAVOR_WAITS = data.flavorWaits;
  FUN_PROMPTS = data.funPrompts;
  SCARES = data.scares;
  OVER_FACTS = data.overFacts;
  CAT_META = data.catMeta;
  MODES = data.modes;
  dataLoaded = true;
  return data;
}

/* ------------------- SEQUENCE GENERATOR ------------------- */
export const TOTAL = 240;
export const rnd = a => a[Math.floor(Math.random()*a.length)];
export const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

// Whether a fact/flag tagged with `band` is allowed under this mode's bandFilter.
export function isBandAllowed(mode, band){
  return mode.bandFilter===null ? true
    : mode.bandFilter===0 ? band===0
    : mode.bandFilter===1 ? band<=1 : band>=1;
}

// Score awarded for solving one prompt at the given streak length.
export function computePoints(streak, isDouble){
  let pts = 10 + Math.min(streak,10)*2;
  if(isDouble) pts*=2;
  return pts;
}

// A smooth difficulty curve for the visible countdown. The opening is forgiving,
// the middle settles into a brisk rhythm, and the final rounds remain challenging
// without dropping into one-second guesses. Mode multipliers still distinguish the
// grade levels; prompt-specific minimums below protect multi-press and hold rounds.
export function getBaseDuration(index, timeMultiplier=1){
  const progress=Math.max(0,Math.min(1,index/(TOTAL-1)));
  const seconds=5.2-2.5*Math.sqrt(progress);
  return seconds*timeMultiplier;
}

export function buildSequence(mode){
  if(!dataLoaded) throw new Error('Game data not loaded — call loadGameData() before buildSequence().');
  const F = mode.features;
  const facts = shuffle(FACTS.filter(f=>isBandAllowed(mode, f[3])));
  const flags = shuffle(FLAGS.filter(f=>isBandAllowed(mode, f[3])));
  const funs  = shuffle(FUN_PROMPTS);
  const tMul  = mode.tMul;
  const seq=[];
  let fi=0, gi=0, fu=0;
  let lastBinary='press';
  let ratIntroDone=false, snakeIntroDone=false;
  let pendingRecall=null, sinceMemory=0, sinceFun=0, sinceScare=0, sinceBoss=0;

  const dur = i => getBaseDuration(i,tMul);
  const pushBinary=(item,expected)=>{item.expected=expected;lastBinary=expected;seq.push(item);};

  // tutorial opening
  pushBinary({type:'simple', text:'PRESS', dur:6*tMul}, 'press');
  pushBinary({type:'simple', text:'DO NOT PRESS', dur:5*tMul}, 'wait');
  { const f=facts[fi++%facts.length];
    pushBinary({type:'fact', text:f[0], emoji:f[2], sub:'PRESS IF TRUE', dur:6.5*tMul}, f[1]?'press':'wait'); }
  pushBinary({type:'simple', text:'SAME AS LAST', dur:5*tMul}, lastBinary);

  while(seq.length < TOTAL){
    const i=seq.length, d=dur(i);
    sinceMemory++; sinceFun++; sinceScare++; sinceBoss++;

    if(pendingRecall && i>=pendingRecall.at){
      const {num,askNum}=pendingRecall; pendingRecall=null;
      pushBinary({type:'recall', text:`PRESS IF THE NUMBER WAS ${askNum}`, emoji:'🧠', dur:d+0.8},
        askNum===num?'press':'wait');
      continue;
    }
    if(!ratIntroDone && i>=6){ ratIntroDone=true;
      seq.push({type:'intro', text:'NEW RULE: ALWAYS PRESS WHEN YOU SEE A RAT', emoji:'🐀',
        dur:5.5*tMul, expected:'wait', rule:{label:'🐀 = PRESS'}}); lastBinary='wait'; continue; }
    if(!snakeIntroDone && i>=18){ snakeIntroDone=true;
      seq.push({type:'intro', text:'NEW RULE: NEVER PRESS WHEN YOU SEE A SNAKE', emoji:'🐍',
        dur:5.5*tMul, expected:'wait', rule:{label:'🐍 = NEVER'}}); lastBinary='wait'; continue; }
    // memory pair
    if(sinceMemory>=12 && !pendingRecall && i<TOTAL-8){
      sinceMemory=0;
      const num=10+Math.floor(Math.random()*90);
      let askNum=num;
      if(Math.random()>=0.6){ do{askNum=10+Math.floor(Math.random()*90);}while(askNum===num); }
      pendingRecall={at:i+3+Math.floor(Math.random()*4), num, askNum};
      pushBinary({type:'remember', text:'REMEMBER THIS NUMBER', big:String(num),
        sub:'JUST REMEMBER. DO NOT PRESS.', dur:3.6*tMul}, 'wait');
      continue;
    }
    // jumpscare (spaced, min gap 28, ~4 per run) — modern modes only
    if(F.scare && sinceScare>=28 && i>14 && Math.random()<0.16){
      sinceScare=0;
      pushBinary({type:'scare', text:'IT IS VERY QUIET IN HERE…', sub:'JUST WAIT. NOTHING WILL HAPPEN. PROBABLY.',
        emoji:'🕯️', dur:Math.max(3.4,d), scare:rnd(SCARES)}, 'wait');
      continue;
    }
    // boss round every ~55 — modern modes only
    if(F.boss && sinceBoss>=55){
      sinceBoss=0;
      const f=facts[fi++%facts.length];
      pushBinary({type:'boss', text:f[0], emoji:f[2], sub:'⚡ BOSS ROUND · 2× POINTS · HALF TIME ⚡',
        dur:Math.max(2.2,(d+1.1)*0.55), double:true}, f[1]?'press':'wait');
      continue;
    }
    // fun chaos (spaced) — modern modes only
    if(F.fun && sinceFun>=9 && Math.random()<0.35){
      sinceFun=0;
      const p=funs[fu++%funs.length];
      pushBinary({type:'fun', text:p.text, sub:p.sub, emoji:p.emoji, fx:p.fx||null, dur:Math.max(3.2,d)}, p.action);
      continue;
    }

    const r=Math.random();
    if(r<0.32){ const f=facts[fi++%facts.length];
      pushBinary({type:'fact', text:f[0], emoji:f[2], sub:'PRESS IF TRUE', dur:d+1.1}, f[1]?'press':'wait');
    } else if(r<0.44){ const g=flags[gi++%flags.length];
      pushBinary({type:'flag', text:`PRESS IF THIS IS ${g[1]}`, emoji:g[0], dur:d+0.6}, g[2]?'press':'wait');
    } else if(r<0.55){
      const [em,name]=rnd(COUNT_EMOJIS);
      const n=2+Math.floor(Math.random()*6);
      const wantEven=Math.random()<0.5;
      let emStr=em.repeat(n);
      if(i>60 && Math.random()<0.5){
        const [d2]=rnd(COUNT_EMOJIS.filter(c=>c[0]!==em));
        const extra=1+Math.floor(Math.random()*3);
        emStr=shuffle((em.repeat(n)+d2.repeat(extra)).match(/../gu)||[emStr]).join('');
      }
      pushBinary({type:'count', text:`PRESS WHEN ${name} ARE ${wantEven?'EVEN':'ODD'}`, emoji:emStr, dur:d+0.9},
        (n%2===0)===wantEven?'press':'wait');
    } else if(r<0.63 && i>8){
      const pick=Math.random();
      if(pick<0.4){ const n=3+Math.floor(Math.random()*4);
        seq.push({type:'multi', text:`PRESS MORE THAN ${n} TIMES`, n, mode:'more', dur:Math.max(3.4,d), expected:'multi'});
      } else if(pick<0.8 || !F.hold){ const n=2+Math.floor(Math.random()*4);
        seq.push({type:'multi', text:`PRESS EXACTLY ${n} TIMES`, n, mode:'exact', dur:Math.max(3.4,d), expected:'multi'});
      } else {
        seq.push({type:'hold', text:'HOLD THE BUTTON FOR 2 SECONDS', sub:'PRESS AND KEEP HOLDING ✊',
          emoji:'✊', dur:Math.max(4.2,d+1), expected:'hold'});
      }
      lastBinary='press';
    } else if(r<0.71 && (ratIntroDone||snakeIntroDone) && i>10){
      const useRat = snakeIntroDone ? Math.random()<0.5 : true;
      if(useRat && ratIntroDone){
        const trick=i>30&&Math.random()<0.4;
        pushBinary({type:'sticky', text:trick?'DO NOT PRESS':'', emoji:'🐀', dur:d}, 'press');
      } else if(snakeIntroDone){
        const trick=i>30&&Math.random()<0.4;
        pushBinary({type:'sticky', text:trick?'PRESS':'', emoji:'🐍', dur:d}, 'wait');
      } else pushBinary({type:'simple', text:'PRESS', dur:d}, 'press');
    } else {
      const pick=Math.random();
      if(pick<0.26) pushBinary({type:'simple', text:'PRESS', dur:d}, 'press');
      else if(pick<0.48) pushBinary({type:'simple', text:'DO NOT PRESS', dur:d}, 'wait');
      else if(pick<0.62) pushBinary({type:'simple', text:'SAME AS LAST', dur:d}, lastBinary);
      else if(pick<0.74) pushBinary({type:'simple', text:'OPPOSITE OF LAST', dur:d}, lastBinary==='press'?'wait':'press');
      else if(pick<0.82) pushBinary({type:'simple', text:'QUICKLY PRESS!!!', dur:Math.max(1.8,d*0.55)}, 'press');
      else if(pick<0.90) pushBinary({type:'simple', text:"QUICKLY DON'T PRESS!!!", dur:Math.max(1.8,d*0.55)}, 'wait');
      else pushBinary({type:'simple', text:rnd(FLAVOR_WAITS), sub:"(DON'T PRESS)", dur:d}, 'wait');
    }
  }
  return seq;
}

