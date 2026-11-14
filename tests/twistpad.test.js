// The phone twist pad: two stacked grips rubbed past each other to spin the top.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, THALI_OUTER } from '../src/layout.js';
import { twistPad, gripAt, gripX, drawTwistPad, PAD, HUD_BUTTONS_W } from '../src/twistpad.js';
import { createInput } from '../src/input.js';

const SCREENS = [[375, 812], [375, 667], [360, 640], [812, 375], [667, 375], [1024, 768]];

test('every pad sits fully on screen, one grip row above the other', () => {
  for (const [w, h] of SCREENS) {
    const L = computeLayout(w, h);
    for (const players of [1, 2]) {
      for (let i = 0; i < players; i++) {
        const p = twistPad(i, L, players);
        assert.ok(p.cx - p.w / 2 >= 0 && p.cx + p.w / 2 <= w, `${w}x${h} p${i} x`);
        assert.ok(p.cy - p.h / 2 >= 0 && p.cy + p.h / 2 <= h, `${w}x${h} p${i} y`);
        assert.ok(p.w >= 180, `${w}x${h} wide enough for two thumbs`);
      }
    }
  }
});

test('on a tall phone the pad sits below the thali, clear of it', () => {
  const L = computeLayout(375, 812);
  const p = twistPad(0, L, 1);
  assert.ok(p.cy - p.h / 2 > L.cy + THALI_OUTER * L.scale, 'below the rim');
  assert.equal(p.flip, 1);
});

test('portrait 2P: player 2 gets a mirrored pad at the top', () => {
  const L = computeLayout(375, 812);
  const p0 = twistPad(0, L, 2), p1 = twistPad(1, L, 2);
  assert.equal(p1.flip, -1);
  assert.ok(p1.cy < p0.cy);
  assert.ok(p1.cx + p1.w / 2 + 8 <= L.width - HUD_BUTTONS_W, 'leaves the pause button free');
});

test('landscape 2P: one pad on each side', () => {
  const L = computeLayout(812, 375);
  const p0 = twistPad(0, L, 2), p1 = twistPad(1, L, 2);
  assert.ok(p0.cx < L.cx && p1.cx > L.cx);
});

test('touches find the right grip, mirrored for the far player', () => {
  const pad = { cx: 200, cy: 600, w: 300, h: 112, flip: 1 };
  assert.equal(gripAt(pad, 200, 570), 'top');
  assert.equal(gripAt(pad, 200, 630), 'bottom');
  assert.equal(gripAt(pad, 200, 400), null);
  assert.equal(gripAt(pad, 20, 600), null);
  const far = { ...pad, cy: 70, flip: -1 };
  assert.equal(gripAt(far, 200, 100), 'top'); // their top row is nearer the screen centre
  assert.equal(gripAt(far, 200, 40), 'bottom');
  assert.ok(Math.abs(gripX(pad, 9999)) < pad.w / 2, 'grips stay on their track');
});

function fakeCtx() {
  const calls = [];
  const grad = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s) => ({ width: String(s).length * 7 });
      if (prop.startsWith('create')) return () => grad;
      return () => { calls.push(prop); };
    },
    set() { return true; },
  });
}

test('the pad draws idle, dimmed, held and flashing', () => {
  const pad = { cx: 200, cy: 600, w: 300, h: 112, flip: -1 };
  for (const [st, opt] of [[{}, {}], [{}, { dim: true }], [{ top: 30, bottom: -30, flash: 0.6 }, {}]]) {
    const ctx = fakeCtx();
    drawTwistPad(ctx, pad, st, { clock: 1.3, ...opt });
    assert.ok(ctx.calls.includes('fill'));
    assert.equal(ctx.calls.includes('fillText'), !opt.dim, 'caption only once the twist is on');
  }
});

// --- input: rubbing the grips makes twist strokes ---
function touchRig(players = 1) {
  const handlers = {};
  const target = { addEventListener: (t, fn) => { handlers[t] = fn; }, removeEventListener: () => {} };
  globalThis.addEventListener ??= () => {};
  globalThis.removeEventListener ??= () => {};
  const layout = computeLayout(375, 812);
  const pad = twistPad(0, layout, players);
  const input = createInput(target, () => layout, { players, getPad: (p) => (p === 0 ? pad : null) });
  const ev = (type, list) => handlers[type]({
    changedTouches: list.map(([id, x, y]) => ({ identifier: id, clientX: x, clientY: y })),
    preventDefault() {},
  });
  return { input, ev, pad };
}

// swing: how far the gap between the thumbs changes on each swipe (each thumb moves a quarter of it)
function rub(ev, pad, swipes, swing = 120) {
  const ty = pad.cy - PAD.ROW_H / 2, by = pad.cy + PAD.ROW_H / 2;
  ev('touchstart', [[1, pad.cx, ty]]);
  ev('touchstart', [[2, pad.cx, by]]);
  for (let k = 0; k < swipes; k++) {
    const d = (k % 2 === 0 ? 1 : -1) * swing / 4;
    ev('touchmove', [[1, pad.cx + d, ty], [2, pad.cx - d, by]]);
  }
}

test('two thumbs rubbing the grips past each other give one stroke per swipe', () => {
  const { input, ev, pad } = touchRig();
  input.setPhase('launch');
  rub(ev, pad, 6);
  const { strokes, placeAngle } = input.poll(0);
  assert.equal(strokes.length, 6);
  assert.ok(strokes[0] > 0, 'top grip swiped right first: clockwise');
  assert.equal(placeAngle, null, 'grabbing the grips does not move the top');
  const st = input.padState(0);
  assert.ok(st.top !== null && st.bottom !== null && st.flash > 0);
});

test('swiping the top grip left first spins the other way', () => {
  const { input, ev, pad } = touchRig();
  input.setPhase('launch');
  const ty = pad.cy - PAD.ROW_H / 2, by = pad.cy + PAD.ROW_H / 2;
  ev('touchstart', [[1, pad.cx, ty], [2, pad.cx, by]]);
  ev('touchmove', [[1, pad.cx - 45, ty], [2, pad.cx + 45, by]]);
  assert.ok(input.poll(0).strokes[0] < 0);
});

test('one thumb alone on a grip does nothing', () => {
  const { input, ev, pad } = touchRig();
  input.setPhase('launch');
  const ty = pad.cy - PAD.ROW_H / 2;
  ev('touchstart', [[1, pad.cx, ty]]);
  for (let k = 0; k < 6; k++) ev('touchmove', [[1, pad.cx + (k % 2 ? -60 : 60), ty]]);
  assert.equal(input.poll(0).strokes.length, 0);
});

test('a second thumb on the same grip is ignored', () => {
  const { input, ev, pad } = touchRig();
  input.setPhase('launch');
  const ty = pad.cy - PAD.ROW_H / 2;
  ev('touchstart', [[1, pad.cx - 40, ty], [2, pad.cx + 40, ty]]);
  assert.equal(input.padState(0).bottom, null);
});

test('lifting both thumbs lets go', () => {
  const { input, ev, pad } = touchRig();
  input.setPhase('launch');
  rub(ev, pad, 4);
  input.poll(0);
  ev('touchend', [[1, 0, 0], [2, 0, 0]]);
  assert.equal(input.poll(0).release, true);
});

test('tiny jiggles are not strokes', () => {
  const { input, ev, pad } = touchRig();
  input.setPhase('launch');
  rub(ev, pad, 6, PAD.STROKE_PX - 6);
  assert.equal(input.poll(0).strokes.length, 0);
});
