// The phone twist pad: two stacked grips pulled apart and held to charge the spin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, THALI_OUTER } from '../src/layout.js';
import { twistPad, gripAt, gripX, pullOf, idlePull, drawTwistPad, PAD, HUD_BUTTONS_W } from '../src/twistpad.js';
import { LAUNCH, createLaunch, updateLaunch, chargeSpin, twistLeft } from '../src/launch.js';
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

test('the pad draws idle, dimmed, held and charging', () => {
  const pad = { cx: 200, cy: 600, w: 300, h: 112, flip: -1 };
  for (const [st, opt] of [[{}, {}], [{}, { dim: true }], [{ top: 30, bottom: -30, charging: true }, {}], [{ top: 30, bottom: null }, {}]]) {
    const ctx = fakeCtx();
    drawTwistPad(ctx, pad, st, { clock: 1.3, ...opt });
    assert.ok(ctx.calls.includes('fill'));
    assert.equal(ctx.calls.includes('fillText'), !opt.dim, 'caption only once the twist is on');
  }
});

test('pull: 0 at rest, ±1 with the grips at opposite ends', () => {
  const pad = { cx: 200, cy: 600, w: 300, h: 112, flip: 1 };
  assert.equal(pullOf(pad, 0, 0), 0);
  const end = gripX(pad, 9999);
  assert.equal(pullOf(pad, end, -end), 1);
  assert.equal(pullOf(pad, -end, end), -1);
  assert.equal(pullOf(pad, end, 0), 0.5);
});

test('the idle hint pulls apart, holds, and springs back', () => {
  assert.equal(idlePull(0), 0);
  assert.equal(idlePull(1.2), 1);
  assert.ok(idlePull(2.6 - 0.01) < 0.05);
});

// --- charging rules ---
const spec = () => ({ maxRPM: 1000, radius: 0.12 });
const twisting = (opts) => { const s = createLaunch(spec(), 0, opts); updateLaunch(s, LAUNCH.PLACE_TIME); return s; };

test('holding a full pull charges to 80% in CHARGE_TIME, then slower to the top', () => {
  const s = twisting({ twistTime: LAUNCH.PAD_TWIST_TIME });
  const dt = 1 / 60;
  let t = 0;
  while (s.rpm < 800 - 1e-6) { chargeSpin(s, 1, dt); t += dt; }
  assert.ok(Math.abs(t - LAUNCH.CHARGE_TIME) < 0.05, `80% after ${t.toFixed(2)}s`);
  while (s.rpm < 1000 && t < 10) { chargeSpin(s, 1, dt); t += dt; }
  assert.ok(t < LAUNCH.PAD_TWIST_TIME - 0.9, `full in ${t.toFixed(2)}s leaves time to pick the release`);
  assert.equal(chargeSpin(s, 1, dt), 0, 'stops at max');
});

test('a weak pull charges nothing; a half pull charges slower than a full one', () => {
  const a = twisting(), b = twisting(), c = twisting();
  assert.equal(chargeSpin(a, LAUNCH.PULL_MIN - 0.05, 0.5), 0);
  chargeSpin(b, 0.55, 0.5);
  chargeSpin(c, 1, 0.5);
  assert.ok(b.rpm > 0 && b.rpm < c.rpm);
});

test('the first pull sets the spin direction', () => {
  const r = twisting(), l = twisting();
  chargeSpin(r, 0.9, 0.1);
  chargeSpin(l, -0.9, 0.1);
  chargeSpin(l, 0.9, 0.1);
  assert.equal(r.spinDir, 1);
  assert.equal(l.spinDir, -1);
});

test('no charging before the twist starts', () => {
  const s = createLaunch(spec(), 0);
  assert.equal(chargeSpin(s, 1, 0.5), 0);
});

test('phone players get longer to charge', () => {
  const pad = createLaunch(spec(), 0, { twistTime: LAUNCH.PAD_TWIST_TIME });
  const keys = createLaunch(spec(), 1);
  assert.ok(LAUNCH.PAD_TWIST_TIME > LAUNCH.TWIST_TIME);
  updateLaunch(pad, LAUNCH.PLACE_TIME + LAUNCH.TWIST_TIME + 0.1);
  updateLaunch(keys, LAUNCH.PLACE_TIME + LAUNCH.TWIST_TIME + 0.1);
  assert.equal(pad.phase, 'twist');
  assert.equal(keys.phase, 'done');
  assert.ok(Math.abs(twistLeft(pad) - (LAUNCH.PAD_TWIST_TIME - LAUNCH.TWIST_TIME - 0.1)) < 1e-9);
});

// --- input: thumbs on the grips report the pull ---
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
  const ty = pad.cy - PAD.ROW_H / 2, by = pad.cy + PAD.ROW_H / 2;
  return { input, ev, pad, ty, by };
}

test('pulling the grips apart and holding reports a steady pull', () => {
  const { input, ev, pad, ty, by } = touchRig();
  input.setPhase('launch');
  ev('touchstart', [[1, pad.cx, ty], [2, pad.cx, by]]);
  assert.equal(input.poll(0).pull, 0);
  ev('touchmove', [[1, pad.cx + 200, ty], [2, pad.cx - 200, by]]);
  for (let k = 0; k < 3; k++) assert.equal(input.poll(0).pull, 1, 'held = still pulling, frame after frame');
  const st = input.padState(0);
  assert.ok(st.top > 0 && st.bottom < 0);
});

test('pulling the top grip left gives a negative pull (the other spin)', () => {
  const { input, ev, pad, ty, by } = touchRig();
  input.setPhase('launch');
  ev('touchstart', [[1, pad.cx, ty], [2, pad.cx, by]]);
  ev('touchmove', [[1, pad.cx - 60, ty], [2, pad.cx + 60, by]]);
  assert.ok(input.poll(0).pull < -0.3);
});

test('one thumb alone on a grip gives no pull', () => {
  const { input, ev, pad, ty } = touchRig();
  input.setPhase('launch');
  ev('touchstart', [[1, pad.cx, ty]]);
  ev('touchmove', [[1, pad.cx + 200, ty]]);
  const p = input.poll(0);
  assert.equal(p.pull, null);
  assert.equal(p.placeAngle, null, 'grabbing the grips does not move the top');
});

test('a second thumb on the same grip is ignored', () => {
  const { input, ev, pad, ty } = touchRig();
  input.setPhase('launch');
  ev('touchstart', [[1, pad.cx - 40, ty], [2, pad.cx + 40, ty]]);
  assert.equal(input.padState(0).bottom, null);
});

test('letting go of both grips releases', () => {
  const { input, ev, pad, ty, by } = touchRig();
  input.setPhase('launch');
  ev('touchstart', [[1, pad.cx, ty], [2, pad.cx, by]]);
  ev('touchmove', [[1, pad.cx + 200, ty], [2, pad.cx - 200, by]]);
  input.poll(0);
  ev('touchend', [[1, 0, 0], [2, 0, 0]]);
  const p = input.poll(0);
  assert.equal(p.release, true);
  assert.equal(p.pull, null);
});
