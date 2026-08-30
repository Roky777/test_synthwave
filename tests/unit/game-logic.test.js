import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import gameData from '../../src/data/game-data.json' with { type: 'json' };
import {
  FACTS, FLAGS, MODES, TOTAL,
  rnd, shuffle, isBandAllowed, computePoints, getBaseDuration, buildSequence, loadGameData,
} from '../../src/game-logic.js';

beforeAll(async () => {
  await loadGameData(gameData);
});

describe('data pools', () => {
  it('every fact entry has the shape [text, isTrue(0/1), emoji, band(0/1/2)]', () => {
    for (const f of FACTS) {
      expect(f).toHaveLength(4);
      expect(typeof f[0]).toBe('string');
      expect([0, 1]).toContain(f[1]);
      expect(typeof f[2]).toBe('string');
      expect([0, 1, 2]).toContain(f[3]);
    }
  });

  it('every flag entry has the shape [emoji, country, isTrue(0/1), band(0/1/2)]', () => {
    for (const g of FLAGS) {
      expect(g).toHaveLength(4);
      expect([0, 1]).toContain(g[2]);
      expect([0, 1, 2]).toContain(g[3]);
    }
  });

  it('has facts covering all three bands', () => {
    const bands = new Set(FACTS.map(f => f[3]));
    expect(bands).toEqual(new Set([0, 1, 2]));
  });
});

describe('MODES config', () => {
  it('defines classic, explorer, challenger and mastermind', () => {
    expect(Object.keys(MODES).sort()).toEqual(['challenger', 'classic', 'explorer', 'mastermind']);
  });

  it('classic has bandFilter null and every feature disabled', () => {
    const classic = MODES.classic;
    expect(classic.bandFilter).toBeNull();
    expect(Object.values(classic.features).every(v => v === false)).toBe(true);
  });

  it('explorer/challenger/mastermind have every feature enabled', () => {
    for (const key of ['explorer', 'challenger', 'mastermind']) {
      const m = MODES[key];
      expect(Object.values(m.features).every(v => v === true)).toBe(true);
    }
  });
});

describe('isBandAllowed', () => {
  it('classic (bandFilter null) allows every band', () => {
    for (const b of [0, 1, 2]) {
      expect(isBandAllowed(MODES.classic, b)).toBe(true);
    }
  });

  it('explorer (bandFilter 0) allows only band 0', () => {
    expect(isBandAllowed(MODES.explorer, 0)).toBe(true);
    expect(isBandAllowed(MODES.explorer, 1)).toBe(false);
    expect(isBandAllowed(MODES.explorer, 2)).toBe(false);
  });

  it('challenger (bandFilter 1) allows bands 0 and 1, not 2', () => {
    expect(isBandAllowed(MODES.challenger, 0)).toBe(true);
    expect(isBandAllowed(MODES.challenger, 1)).toBe(true);
    expect(isBandAllowed(MODES.challenger, 2)).toBe(false);
  });

  it('mastermind (bandFilter 2) allows bands 1 and 2, not 0', () => {
    expect(isBandAllowed(MODES.mastermind, 0)).toBe(false);
    expect(isBandAllowed(MODES.mastermind, 1)).toBe(true);
    expect(isBandAllowed(MODES.mastermind, 2)).toBe(true);
  });
});

describe('computePoints', () => {
  it('awards 10 + 2 per streak point, capped at streak 10', () => {
    expect(computePoints(1, false)).toBe(12);
    expect(computePoints(5, false)).toBe(20);
    expect(computePoints(10, false)).toBe(30);
    expect(computePoints(50, false)).toBe(30); // capped
  });

  it('doubles points for boss rounds', () => {
    expect(computePoints(1, true)).toBe(24);
    expect(computePoints(10, true)).toBe(60);
  });
});

describe('countdown difficulty curve', () => {
  it('gets progressively faster without reaching an impossible one-second timer', () => {
    const opening=getBaseDuration(0);
    const middle=getBaseDuration(Math.floor(TOTAL/2));
    const final=getBaseDuration(TOTAL-1);
    expect(opening).toBeCloseTo(5.2);
    expect(opening).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(final);
    expect(final).toBeCloseTo(2.7);
  });

  it('preserves the mode timing multiplier', () => {
    expect(getBaseDuration(100,1.3)).toBeGreaterThan(getBaseDuration(100,1));
    expect(getBaseDuration(100,.85)).toBeLessThan(getBaseDuration(100,1));
  });
});

describe('shuffle', () => {
  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it('returns an array with the same elements', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect([...out].sort()).toEqual([...input].sort());
  });
});

describe('rnd', () => {
  it('always returns an element from the given array', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(rnd(arr));
    }
  });
});

describe('buildSequence', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('always produces exactly TOTAL prompts, for every mode', () => {
    for (const key of Object.keys(MODES)) {
      const seq = buildSequence(MODES[key]);
      expect(seq).toHaveLength(TOTAL);
    }
  });

  it('starts with the fixed tutorial opening regardless of mode', () => {
    for (const key of Object.keys(MODES)) {
      const seq = buildSequence(MODES[key]);
      expect(seq[0]).toMatchObject({ type: 'simple', text: 'PRESS', expected: 'press' });
      expect(seq[1]).toMatchObject({ type: 'simple', text: 'DO NOT PRESS', expected: 'wait' });
      expect(seq[2].type).toBe('fact');
      expect(seq[3]).toMatchObject({ type: 'simple', text: 'SAME AS LAST' });
    }
  });

  it('classic mode never generates boss/fun/scare/hold prompts', () => {
    // Run several times since generation is randomized.
    for (let run = 0; run < 5; run++) {
      const seq = buildSequence(MODES.classic);
      const types = new Set(seq.map(it => it.type));
      expect(types.has('boss')).toBe(false);
      expect(types.has('fun')).toBe(false);
      expect(types.has('scare')).toBe(false);
      expect(types.has('hold')).toBe(false);
    }
  });

  it('classic mode only pulls facts/flags tagged for its allowed bands (all of them)', () => {
    const seq = buildSequence(MODES.classic);
    const factTexts = new Set(FACTS.map(f => f[0]));
    for (const it of seq) {
      if (it.type === 'fact' || it.type === 'boss') {
        expect(factTexts.has(it.text)).toBe(true);
      }
    }
  });

  it('explorer mode only uses band-0 facts/flags', () => {
    const band0FactTexts = new Set(FACTS.filter(f => f[3] === 0).map(f => f[0]));
    const seq = buildSequence(MODES.explorer);
    for (const it of seq) {
      if (it.type === 'fact' || it.type === 'boss') {
        expect(band0FactTexts.has(it.text)).toBe(true);
      }
    }
  });

  it('explorer/challenger/mastermind can generate hold prompts (feature enabled)', () => {
    // Force the RNG branch that leads to a 'hold' prompt to avoid flakiness.
    const values = [];
    for (let i = 0; i < 5000; i++) values.push(0.61, 0.85); // r<0.63 branch, pick>=0.8 -> hold
    let idx = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => values[idx++ % values.length]);
    const seq = buildSequence(MODES.challenger);
    expect(seq.some(it => it.type === 'hold')).toBe(true);
  });

  it('respects mode time multiplier: mastermind durations are shorter than explorer for the tutorial PRESS prompt', () => {
    const explorerSeq = buildSequence(MODES.explorer);
    const mastermindSeq = buildSequence(MODES.mastermind);
    expect(explorerSeq[0].dur).toBeGreaterThan(mastermindSeq[0].dur);
  });

  it('keeps multi-press and hold prompts achievable', () => {
    for (let run=0;run<10;run++) {
      const seq=buildSequence(MODES.challenger);
      for (const item of seq) {
        if(item.type==='multi')expect(item.dur).toBeGreaterThanOrEqual(3.4);
        if(item.type==='hold')expect(item.dur).toBeGreaterThanOrEqual(4.2);
      }
    }
  });
});
