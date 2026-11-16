// The physics with 3–4 tops in the bowl at once (friends mode), and proof 2-top play is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTop } from '../src/parts.js';
import { createWorld, step, simulate, CONST, CLASH } from '../src/physics.js';
import { still } from './helpers.js';
import { fingerprint } from '../tools/fingerprint2.mjs';

// recorded from the 2-top engine before the N-top change. Battles 3, 6 and 9 were re-recorded when
// Fruit-Scented + Absolute gained its "Hard Candy" combo (the engine itself did not change; the other
// six, whose tops kept their stats, still match the original recording).
const BASELINE = ['0,tipped,4.6833,277.037,139.157', '1,tipped,11.1583,124.736,390.569', '0,stopped,8.4917,471.602,0', '0,tipped,4.6583,287.291,166.173', '1,tipped,10.025,85.435,297.81', '0,stopped,12.2667,392.824,0', '0,tipped,4.5583,225.544,63.186', '1,tipped,10.875,121.528,399.159', '0,stopped,11.4917,278.422,0'];

const spec = () => buildTop('apsara-nondust', 'nataraj-hb');
const idle = (n) => Array.from({ length: n }, () => ({ steer: { x: 0, y: 0 }, special: false, mash: 0 }));

function worldN(points, opts = {}) {
  const specs = points.map(() => spec());
  return createWorld(specs, points.map(([x, y], i) => ({ x, y, rpm: specs[i].maxRPM, wobble: 0, spinDir: 1 })), still,
    { bowlK: 0, clash: false, ...opts });
}

test('2-top battles come out exactly as before', () => {
  assert.deepEqual(fingerprint(), BASELINE);
});

test('any touching pair collides, not just tops 0 and 1', () => {
  const w = worldN([[-0.8, 0], [0.1, 0], [0.1 + 0.2, 0]]);
  w.tops[1].vx = 1.5;
  for (let k = 0; k < 30; k++) step(w, idle(3));
  assert.ok(w.tops[2].vx > 0.2, `top 2 was pushed: vx ${w.tops[2].vx}`);
});

test('a top that stops is out: it stays put and the round goes on', () => {
  const w = worldN([[-0.6, 0], [0, 0], [0.6, 0]]);
  w.tops[1].rpm = 0;
  w.events.length = 0;
  step(w, idle(3));
  assert.equal(w.tops[1].out, true);
  assert.equal(w.over, false);
  assert.ok(w.events.some((e) => e.type === 'out' && e.i === 1 && e.reason === 'stopped'));
  // a rival driving straight through its spot does not bump it
  w.tops[0].x = -0.3; w.tops[0].vx = 2;
  for (let k = 0; k < 60; k++) step(w, idle(3));
  assert.deepEqual([w.tops[1].x, w.tops[1].y, w.tops[1].vx], [0, 0, 0]);
});

test('the last top spinning wins, scored by how the last rival went out', () => {
  const w = worldN([[-0.6, 0], [0, 0.6], [0.6, 0]]);
  w.tops[1].rpm = 0;
  step(w, idle(3));
  w.tops[2].wobble = 1.5;
  step(w, idle(3));
  assert.deepEqual(w.result, { winner: 0, reason: 'tipped' });
});

test('two going out on the same step: the survivor wins', () => {
  const w = worldN([[-0.6, 0], [0, 0.6], [0.6, 0]]);
  w.tops[1].rpm = 0;
  w.tops[2].wobble = 1.5;
  step(w, idle(3));
  assert.equal(w.result.winner, 0);
  assert.equal(w.result.reason, 'tipped'); // top 2 had more spin, so it went out "last"
});

test('everyone left going out together: more spin wins, equal spin is a draw', () => {
  const a = worldN([[-0.6, 0], [0, 0.6], [0.6, 0]]);
  a.tops[0].rpm = 0;
  step(a, idle(3));
  a.tops[1].wobble = 1; a.tops[1].rpm = 500;
  a.tops[2].wobble = 1; a.tops[2].rpm = 300;
  step(a, idle(3));
  assert.deepEqual(a.result, { winner: 1, reason: 'tipped' });

  const b = worldN([[-0.6, 0], [0, 0.6], [0.6, 0]]);
  b.tops[0].rpm = 0;
  step(b, idle(3));
  b.tops[1].wobble = 1; b.tops[1].rpm = 400;
  b.tops[2].wobble = 1; b.tops[2].rpm = 400;
  step(b, idle(3));
  assert.deepEqual(b.result, { winner: null, reason: 'draw' });
});

test('at the bell the live top with most spin wins (out tops do not count)', () => {
  const w = worldN([[-0.6, 0], [0, 0.6], [0.6, 0], [0, -0.6]]);
  w.tops[1].rpm = 0;
  step(w, idle(4));
  w.tops[0].rpm = 300; w.tops[2].rpm = 450; w.tops[3].rpm = 200;
  w.time = CONST.TIME_LIMIT;
  step(w, idle(4));
  assert.deepEqual(w.result, { winner: 2, reason: 'time' });
});

test('a Spin Clash between seats 1 and 2: only they mash, and one of them wins', () => {
  const s = spec();
  const gap = s.radius * 2 * 1.05;
  const w = worldN([[-0.8, 0], [0, 0], [gap, 0]], { clash: true });
  let k = 0;
  while (!w.clash && k++ < 400) step(w, idle(3));
  assert.ok(w.clash, 'clash started');
  assert.deepEqual(w.clash.pair, [1, 2]);
  w.events.length = 0;
  const mash = [{ mash: 50 }, { mash: 1 }, { mash: 3 }];
  for (let n = 0; n < Math.ceil(CLASH.duration * 120) + 2; n++) step(w, mash.map((m, i) => (n === 0 ? m : idle(3)[i])));
  const end = w.events.find((e) => e.type === 'clashEnd');
  assert.ok(end, 'clash ended');
  assert.equal(end.winner, 2);
  assert.deepEqual(end.mash, [1, 3]);
});

test("crumbs dropped by top 0 slow every rival", () => {
  const w = worldN([[-0.8, 0], [0, 0.3], [0, -0.3]]);
  w.zones.push({ x: 0, y: 0.3, r: 0.2, drag: 3.2, owner: 0, until: Infinity, kind: 'crumbs' });
  w.zones.push({ x: 0, y: -0.3, r: 0.2, drag: 3.2, owner: 0, until: Infinity, kind: 'crumbs' });
  w.tops[1].vx = 1; w.tops[2].vx = 1;
  step(w, idle(3));
  assert.equal(w.tops[1].inZone, true);
  assert.equal(w.tops[2].inZone, true);
});

test('simulate passes specials for seat 3', () => {
  const w = worldN([[-0.6, 0], [0, 0.6], [0.6, 0], [0, -0.6]], { unlockAt: 1 });
  const intents = idle(4);
  intents[3] = { steer: { x: 0, y: 0 }, special: true };
  simulate(w, 1 / 60, intents);
  assert.equal(w.tops[3].specialUsed, true);
});
