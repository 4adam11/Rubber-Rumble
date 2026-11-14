import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTop } from '../src/parts.js';
import { LAUNCH, createLaunch, updateLaunch, keyStroke, addStroke, release } from '../src/launch.js';
import { createWorld, step, simulate, CLASH } from '../src/physics.js';
import { createCpu } from '../src/ai.js';
import { launch, still, NO_INTENT } from './helpers.js';

const spec = () => buildTop('apsara-nondust', 'nataraj-hb');
const twisting = () => { const s = createLaunch(spec(), 0); updateLaunch(s, LAUNCH.PLACE_TIME); return s; };

test('the first twist key sets the spin direction', () => {
  const a = twisting();
  keyStroke(a, 'L'); keyStroke(a, 'R'); keyStroke(a, 'L');
  release(a);
  assert.equal(a.result.spinDir, -1);
  const b = twisting();
  keyStroke(b, 'R'); keyStroke(b, 'L');
  release(b);
  assert.equal(b.result.spinDir, 1);
});

test('the first flick sets the spin direction for touch and mouse strokes', () => {
  const a = twisting();
  addStroke(a, 1, -1); addStroke(a, 1, 1);
  release(a);
  assert.equal(a.result.spinDir, -1);
  const b = twisting();
  addStroke(b, 1); // no direction given: clockwise by default
  release(b);
  assert.equal(b.result.spinDir, 1);
});

function pair(dirA, dirB, opts = {}) {
  const sa = spec(), sb = spec();
  return createWorld([sa, sb], [
    { ...launch(-0.25, 0, 800), spinDir: dirA },
    { ...launch(0.25, 0, 800), spinDir: dirB },
  ], still, { bowlK: 0, clash: false, ...opts });
}

test('tops turn the way they were spun', () => {
  const w = pair(1, -1);
  for (let i = 0; i < 30; i++) step(w, NO_INTENT);
  assert.ok(w.tops[0].angle > 0);
  assert.ok(w.tops[1].angle < 0);
});

test('opposite spins hit harder than matching spins', () => {
  const hit = (dirB) => {
    const w = pair(1, dirB);
    w.tops[0].vx = 1.5;
    for (let i = 0; i < 40; i++) step(w, NO_INTENT);
    return 800 - w.tops[1].rpm;
  };
  assert.ok(hit(-1) > hit(1) * 1.15, `${hit(-1)} vs ${hit(1)}`);
});

// two tops shoved into each other so they grind
function grinding(extra = {}) {
  const w = pair(1, 1, { clash: true, ...extra });
  w.tops[0].x = -0.11; w.tops[1].x = 0.11;
  return w;
}
const PUSH = [{ steer: { x: 1, y: 0 }, special: false }, { steer: { x: -1, y: 0 }, special: false }];

test('sustained grinding starts a spin clash and freezes the tops', () => {
  const w = grinding();
  let started = false;
  for (let i = 0; i < 120 && !started; i++) {
    step(w, PUSH);
    started = w.events.some((e) => e.type === 'clashStart');
  }
  assert.ok(started, 'clash started');
  assert.ok(w.clash);
  const x = w.tops[0].x, rpm = w.tops[0].rpm;
  for (let i = 0; i < 30; i++) step(w, PUSH);
  assert.equal(w.tops[0].x, x, 'frozen during the clash');
  assert.equal(w.tops[0].rpm, rpm, 'no drain during the clash');
});

test('the player who mashes more wins the clash and steals spin', () => {
  const w = grinding();
  while (!w.clash) step(w, PUSH);
  const before = w.tops.map((t) => t.rpm);
  let end;
  for (let i = 0; i < CLASH.duration * 120 + 5 && !end; i++) {
    step(w, [{ steer: { x: 0, y: 0 }, special: false, mash: i % 10 === 0 ? 1 : 0 }, NO_INTENT[1]]);
    end = w.events.find((e) => e.type === 'clashEnd');
  }
  assert.ok(end, 'clash ended');
  assert.equal(end.winner, 0);
  assert.ok(w.tops[0].rpm > before[0]);
  assert.ok(w.tops[1].rpm < before[1] - 0.08 * w.tops[1].spec.maxRPM);
  assert.equal(w.clash, null);
});

test('clashes have a cooldown', () => {
  const w = grinding();
  while (!w.clash) step(w, PUSH);
  for (let i = 0; i < CLASH.duration * 120 + 5; i++) step(w, NO_INTENT);
  assert.equal(w.clash, null);
  w.tops[0].x = -0.11; w.tops[1].x = 0.11;
  w.tops[0].vx = w.tops[1].vx = 0;
  for (let i = 0; i < 120 * 2; i++) step(w, PUSH);
  assert.equal(w.clash, null, 'no second clash straight away');
});

test('mashes from one frame count once even if the frame runs several steps', () => {
  const w = grinding();
  while (!w.clash) step(w, PUSH);
  simulate(w, 0.1, [{ steer: { x: 0, y: 0 }, special: false, mash: 3 }, NO_INTENT[1]]);
  assert.equal(w.clash.mash[0], 3);
});

test('the computer mashes during a clash, harder on Hard', () => {
  const taps = (diff) => {
    const w = grinding();
    while (!w.clash) step(w, PUSH);
    const cpu = createCpu(diff, 1, () => 0.5);
    let n = 0;
    for (let i = 0; i < 120; i++) n += cpu.think(w, 1 / 120).mash || 0;
    return n;
  };
  assert.ok(taps('hard') > taps('easy'));
  assert.ok(taps('easy') >= 2);
});
