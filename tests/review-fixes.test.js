// Regression tests for the final-review findings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTop } from '../src/parts.js';
import { LAUNCH, createLaunch, updateLaunch, addStroke, release } from '../src/launch.js';
import { CONST, simulate } from '../src/physics.js';
import { createInput } from '../src/input.js';
import { world2, NO_INTENT } from './helpers.js';

test('release before any twist is ignored (no 0-rpm launch)', () => {
  const s = createLaunch(buildTop('apsara-nondust', 'nataraj-hb'), 0);
  updateLaunch(s, LAUNCH.PLACE_TIME);
  release(s);
  assert.equal(s.phase, 'twist');
  addStroke(s, 1);
  release(s);
  assert.equal(s.phase, 'done');
});

test('a special pressed on a frame too short for a physics step still fires', () => {
  const w = world2({ a: ['nataraj-621', 'nataraj-hb'] });
  let left = simulate(w, CONST.DT * 0.4, [{ steer: { x: 0, y: 0 }, special: true }, NO_INTENT[1]]);
  assert.equal(w.time, 0); // no step ran
  left = simulate(w, left + CONST.DT * 0.7, NO_INTENT);
  assert.ok(w.events.some((e) => e.type === 'special' && e.i === 0));
  assert.equal(w.tops[0].specialUsed, true);
});

// --- minimal DOM stand-in for createInput ---
function fakeInput(players = 1) {
  const handlers = {};
  const target = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    removeEventListener: () => {},
  };
  globalThis.addEventListener ??= () => {};
  globalThis.removeEventListener ??= () => {};
  const layout = { width: 800, height: 400, rotate: false, scale: 150, cx: 400, cy: 200 };
  const input = createInput(target, () => layout, { players });
  const touch = (type, list) => handlers[type]({
    changedTouches: list.map(([id, x, y]) => ({ identifier: id, clientX: x, clientY: y })),
    preventDefault() {},
  });
  return { input, touch };
}

test('a finger lifted while a menu is up is forgotten', () => {
  const { input, touch } = fakeInput();
  input.setPhase('battle');
  touch('touchstart', [[1, 100, 200]]);
  touch('touchmove', [[1, 160, 200]]);
  input.setPhase('menu'); // round ends while steering
  touch('touchend', [[1, 160, 200]]);
  input.setPhase('battle');
  const p = input.poll(0);
  assert.equal(p.touching, false);
  assert.deepEqual(p.steer, { x: 0, y: 0 });
  // and two fresh touches are still accepted
  touch('touchstart', [[2, 100, 200], [3, 140, 200]]);
  input.setPhase('launch');
  assert.equal(input.poll(0).touching, false); // setPhase('launch') from battle does not keep stale state either
});

test('lifting the last finger during launch still releases after the fixes', () => {
  const { input, touch } = fakeInput();
  input.setPhase('launch');
  touch('touchstart', [[1, 100, 200], [2, 140, 200]]);
  touch('touchend', [[1, 100, 200], [2, 140, 200]]);
  assert.equal(input.poll(0).release, true);
});

test('a touch held from launch into battle does not start as a full joystick', () => {
  const { input, touch } = fakeInput();
  input.setPhase('launch');
  touch('touchstart', [[1, 100, 200]]);
  touch('touchmove', [[1, 220, 200]]); // 120 px from where it started
  input.setPhase('battle');
  assert.deepEqual(input.poll(0).steer, { x: 0, y: 0 });
  touch('touchmove', [[1, 280, 200]]); // now steer from the new anchor
  assert.ok(input.poll(0).steer.x > 0.9);
});
