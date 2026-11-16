// Rising difficulty: the level machine, the computer's in-between levels, and what a win pays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RISING, newRising, cleanRising, afterMatch } from '../src/rising.js';
import { profile } from '../src/ai.js';
import { matchCoins } from '../src/economy.js';

test('two wins in a row go up a level, two losses go down, mixed results stay', () => {
  let r = newRising();
  assert.deepEqual(r, { level: 2, streak: 0 });
  r = afterMatch(r, true); assert.equal(r.level, 2); assert.equal(r.moved, 0);
  r = afterMatch(r, true); assert.equal(r.level, 3); assert.equal(r.moved, 1); assert.equal(r.streak, 0);
  r = afterMatch(r, true); r = afterMatch(r, false); r = afterMatch(r, true);
  assert.equal(r.level, 3, 'win, loss, win: no two in a row');
  r = afterMatch(afterMatch(r, false), false);
  assert.equal(r.level, 2); assert.equal(r.moved, -1);
});

test('the level never leaves 1 to 7, and bad saved data is repaired', () => {
  assert.equal(afterMatch({ level: 7, streak: 1 }, true).level, 7);
  assert.equal(afterMatch({ level: 7, streak: 1 }, true).moved, 0);
  assert.equal(afterMatch({ level: 1, streak: -1 }, false).level, 1);
  assert.deepEqual(cleanRising({ level: 99, streak: 'x' }), { level: 7, streak: 0 });
  assert.deepEqual(cleanRising({ level: -4, streak: 9 }), { level: 1, streak: 1 });
  assert.deepEqual(cleanRising({ level: NaN }), { level: 2, streak: 0 });
  assert.deepEqual(cleanRising(null), { level: 2, streak: 0 });
  assert.deepEqual(cleanRising('nonsense'), { level: 2, streak: 0 });
  assert.deepEqual([RISING.MIN, RISING.MAX, RISING.START], [1, 7, 2]);
});

test('levels 1, 4 and 7 are Easy, Medium and Hard; the rest sit in between', () => {
  for (const [lv, name] of [[1, 'easy'], [4, 'medium'], [7, 'hard']]) {
    const a = profile(lv), b = profile(name);
    for (const k of ['rpm', 'spread', 'perfect', 'reaction', 'mash']) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `level ${lv} ${k}`);
  }
  for (let lv = 1; lv < 7; lv++) {
    assert.ok(profile(lv + 1).rpm > profile(lv).rpm, `rpm rises at ${lv}`);
    assert.ok(profile(lv + 1).reaction < profile(lv).reaction, `reaction quickens at ${lv}`);
  }
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((l) => profile(l).smarts), ['easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard']);
  assert.deepEqual(['easy', 'medium', 'hard'].map((n) => profile(n).smarts), ['easy', 'medium', 'hard']);
  assert.equal(profile(99).rpm, profile('hard').rpm, 'out-of-range levels clamp');
  assert.equal(profile(undefined).smarts, 'medium', 'an unknown difficulty plays as medium');
});

test('coins: Rising pays by level, same-device 2P pays nothing, friends need two humans', () => {
  const win = (o) => matchCoins({ won: true, roundsWon: 0, ...o }).total;
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((l) => win({ mode: 'cpu', difficulty: l })), [30, 40, 45, 55, 65, 70, 80]);
  assert.deepEqual(['easy', 'medium', 'hard'].map((d) => win({ mode: 'cpu', difficulty: d })), [30, 50, 80]);
  assert.match(matchCoins({ mode: 'cpu', difficulty: 3, won: true }).lines.at(-1).label, /Rising level 3/);
  assert.deepEqual(matchCoins({ mode: '2p', won: true, roundsWon: 3, rubberality: true, flawless: 1 }), { lines: [], total: 0 });
  assert.equal(win({ mode: 'friends', humans: 2 }), 20);
  assert.equal(matchCoins({ mode: 'friends', humans: 3, won: true, roundsWon: 2 }).total, 40);
  assert.deepEqual(matchCoins({ mode: 'friends', humans: 1, won: true, roundsWon: 3 }), { lines: [], total: 0 });
});
