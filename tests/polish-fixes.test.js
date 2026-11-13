// Regression tests for the small follow-up fixes after the final review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput, specialButton } from '../src/input.js';
import { createUI, RESULT_GUARD_MS } from '../src/ui.js';
import { roundLabel } from '../src/match.js';

// --- input with a minimal DOM stand-in ---
function fakeInput() {
  const handlers = {};
  const target = { addEventListener: (t, fn) => { handlers[t] = fn; }, removeEventListener: () => {} };
  globalThis.addEventListener ??= () => {};
  globalThis.removeEventListener ??= () => {};
  const layout = { width: 800, height: 400, rotate: false, scale: 150, cx: 400, cy: 200 };
  const input = createInput(target, () => layout, { players: 1 });
  const mouse = (type, x, y, button = 0) => handlers[type]({ clientX: x, clientY: y, button, preventDefault() {} });
  return { input, mouse, layout };
}

test('left-clicking the touch-only ★ spot does not fire a special', () => {
  const { input, mouse, layout } = fakeInput();
  input.setPhase('battle');
  const b = specialButton(0, layout.width, layout.height, 1);
  mouse('mousedown', b.x, b.y);
  assert.equal(input.poll(0).special, false);
});

test('right-click still fires the special', () => {
  const { input, mouse } = fakeInput();
  input.setPhase('battle');
  mouse('mousedown', 100, 100, 2);
  assert.equal(input.poll(0).special, true);
});

// --- ui with a minimal DOM stand-in ---
function fakeUI() {
  let clock = 1000;
  const calls = [];
  const root = {
    innerHTML: '',
    addEventListener: (t, fn) => { root.onclick = fn; },
    querySelector: () => null,
    contains: () => true,
  };
  const ui = createUI(root, { action: (a) => calls.push(a) }, { now: () => clock });
  const click = (action) => root.onclick({ target: { closest: () => ({ dataset: { action } }) } });
  return { ui, click, calls, tick: (ms) => { clock += ms; } };
}

const ROUND = { headline: 'You win round 1!', sub: '', color: '#000', names: ['You', 'CPU'], wins: [1, 0], draw: false };

test('a result screen ignores presses for a moment after it opens', () => {
  const { ui, click, calls, tick } = fakeUI();
  ui.show('round', ROUND);
  click('next-round');
  assert.deepEqual(calls, []);
  tick(RESULT_GUARD_MS + 1);
  click('next-round');
  assert.deepEqual(calls, ['next-round']);
});

test('the match screen is guarded too, other screens are not', () => {
  const { ui, click, calls, tick } = fakeUI();
  ui.show('match', { ...ROUND, rounds: [] });
  click('rematch');
  assert.deepEqual(calls, []);
  tick(RESULT_GUARD_MS + 1);
  ui.show('title', { muted: false });
  click('play-cpu');
  assert.deepEqual(calls, ['play-cpu']);
});

// --- round numbering ---
const W0 = { winner: 0, reason: 'stopped' };
const W1 = { winner: 1, reason: 'tipped' };
const D = { winner: null, reason: 'draw' };

test('round labels count decisive rounds and mark replays', () => {
  assert.equal(roundLabel([], 0), 'Round 1');
  assert.equal(roundLabel([W0], 1), 'Round 2');
  assert.equal(roundLabel([W0, D], 2), 'Round 2 (replay)');
  assert.equal(roundLabel([W0, D], 1), 'Round 2');
  assert.equal(roundLabel([D, D, W1], 3), 'Round 2');
  assert.equal(roundLabel([D, D, W1], 2), 'Round 1 (replay)');
  assert.equal(roundLabel([W0, W1, D, D], 4), 'Round 3 (replay)');
});
