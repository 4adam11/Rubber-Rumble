import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONST, step, simulate } from '../src/physics.js';
import { world2, launch, runUntilOver, NO_INTENT } from './helpers.js';

const steps = (w, seconds, intents = NO_INTENT) => {
  for (let i = 0; i < Math.round(seconds * 120); i++) step(w, intents);
};

test('lone top drifts toward centre', () => {
  const w = world2();
  steps(w, 1);
  const a = w.tops[0];
  assert.ok(Math.hypot(a.x, a.y) < 0.6, `dist ${Math.hypot(a.x, a.y)}`);
});

test('spin drains and round ends stopped', () => {
  const w = world2({ la: launch(0.6, 0, 50), opts: { bowlK: 0 } });
  runUntilOver(w, step);
  assert.deepEqual(w.result, { winner: 1, reason: 'stopped' });
  assert.ok(w.events.some((e) => e.type === 'end'));
});

test('low spin raises wobble until tip', () => {
  const w = world2({ opts: { bowlK: 0 } });
  const a = w.tops[0];
  a.rpm = 0.3 * a.spec.maxRPM;
  a.wobble = 0.9;
  step(w, NO_INTENT);
  assert.ok(a.wobble > 0.9);
  steps(w, 2);
  assert.ok(w.over);
  assert.equal(w.result.winner, 1);
  assert.ok(['tipped', 'stopped'].includes(w.result.reason));
});

test('ring-out', () => {
  const w = world2({ opts: { bowlK: 0 } });
  const a = w.tops[0];
  a.x = 0.98; a.vx = 3;
  steps(w, 0.2);
  assert.deepEqual(w.result, { winner: 1, reason: 'ringout' });
});

test('higher stamina outlasts', () => {
  const w = world2({
    a: ['camlin-dustfree', 'camlin-exam'],
    b: ['nataraj-621', 'apsara-platinum'],
    la: launch(0.6, 0, 800),
    lb: launch(-0.6, 0, 800),
    opts: { bowlK: 0 },
  });
  steps(w, 10);
  assert.ok(w.tops[0].rpm > w.tops[1].rpm, `${w.tops[0].rpm} vs ${w.tops[1].rpm}`);
});

test('steering costs spin', () => {
  const w1 = world2({ opts: { bowlK: 0 } });
  const w2 = world2({ opts: { bowlK: 0 } });
  steps(w1, 0.5);
  steps(w2, 0.5, [{ steer: { x: 0, y: 1 }, special: false }, NO_INTENT[1]]);
  assert.ok(w2.tops[0].rpm < w1.tops[0].rpm - 5);
  assert.ok(w2.tops[0].y > w1.tops[0].y);
});

test('simultaneous end: higher rpm wins', () => {
  const w = world2({ la: launch(0.6, 0, 0.1), lb: launch(-0.6, 0, 0.05), opts: { bowlK: 0 } });
  step(w, NO_INTENT);
  assert.deepEqual(w.result, { winner: 0, reason: 'stopped' });
});

test('simultaneous end: equal rpm is a draw', () => {
  const w = world2({ la: launch(0.6, 0, 0.1), lb: launch(-0.6, 0, 0.1), opts: { bowlK: 0 } });
  step(w, NO_INTENT);
  assert.deepEqual(w.result, { winner: null, reason: 'draw' });
});

test('time limit', () => {
  const w = world2({ la: launch(0.6, 0, 500), lb: launch(-0.6, 0, 400), opts: { bowlK: 0 } });
  w.time = CONST.TIME_LIMIT - CONST.DT / 2;
  step(w, NO_INTENT);
  assert.deepEqual(w.result, { winner: 0, reason: 'time' });
});

test('step on a finished world is a no-op', () => {
  const w = world2({ la: launch(0.6, 0, 0.1), opts: { bowlK: 0 } });
  step(w, NO_INTENT);
  const t = w.time;
  step(w, NO_INTENT);
  assert.equal(w.time, t);
});

test('simulate caps big gaps', () => {
  const w = world2();
  const left = simulate(w, 5, NO_INTENT);
  assert.ok(w.time <= CONST.MAX_ELAPSED + CONST.DT + 1e-9, `time ${w.time}`);
  assert.ok(left >= 0 && left < CONST.DT);
});

test('no tunnelling on big gap', () => {
  const w = world2({ la: launch(-0.3, 0, 900), lb: launch(0.3, 0, 900) });
  w.tops[0].vx = 4; w.tops[1].vx = -4;
  let hits = 0;
  for (let i = 0; i < 4; i++) {
    simulate(w, 0.25, NO_INTENT);
    hits += w.events.filter((e) => e.type === 'hit').length;
    w.events.length = 0;
  }
  assert.ok(hits >= 1);
  assert.ok(w.tops[0].x < w.tops[1].x);
});
