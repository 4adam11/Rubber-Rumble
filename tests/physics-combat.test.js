import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONST, step } from '../src/physics.js';
import { world2, launch, NO_INTENT, seeded } from './helpers.js';

const steps = (w, seconds, intents = NO_INTENT) => {
  for (let i = 0; i < Math.round(seconds * 120); i++) step(w, intents);
};
const SPECIAL_A = [{ steer: { x: 0, y: 0 }, special: true }, NO_INTENT[1]];
const momentum = (w) => w.tops.reduce((p, t) => p + t.spec.mass * t.vx, 0);

test('collision conserves momentum and costs both spin', () => {
  const mk = (y) => {
    const w = world2({ la: launch(-0.3, 0, 900), lb: launch(0.3, y, 900), opts: { bowlK: 0 } });
    w.tops[0].vx = 1.5; w.tops[1].vx = -0.5;
    return w;
  };
  const w = mk(0);
  const ctrl = mk(0.9); // misses
  const p0 = momentum(w);
  let hits = 0;
  for (let i = 0; i < 120; i++) {
    step(w, NO_INTENT); step(ctrl, NO_INTENT);
    hits += w.events.filter((e) => e.type === 'hit').length;
    w.events.length = 0;
  }
  assert.ok(hits >= 1);
  const expected = p0 * Math.exp(-CONST.DAMPING * CONST.DT * 120);
  assert.ok(Math.abs(momentum(w) - expected) < 1e-9, `${momentum(w)} vs ${expected}`);
  assert.ok(w.tops[0].rpm < ctrl.tops[0].rpm - 1);
  assert.ok(w.tops[1].rpm < ctrl.tops[1].rpm - 1);
});

function hitTarget(attacker, setup) {
  const w = world2({
    a: attacker, b: ['apsara-jumbo', 'nataraj-hb'],
    la: launch(-0.25, 0, 900), lb: launch(0.25, 0, 800), opts: { bowlK: 0 },
  });
  w.tops[0].vx = 1.5;
  setup?.(w);
  steps(w, 0.5);
  return 800 - w.tops[1].rpm;
}

test('heavier attack deals more damage', () => {
  const nataraj = hitTarget(['nataraj-621', 'apsara-absolute']);
  const cube = hitTarget(['doms-cubo', 'apsara-absolute']);
  assert.ok(cube > nataraj, `cube ${cube} vs nataraj ${nataraj}`);
});

function snapWorld(speed) {
  const w = world2({
    a: ['nataraj-621', 'apsara-absolute'], b: ['camlin-dustfree', 'nataraj-hb'],
    la: launch(-0.25, 0, 900), lb: launch(0.25, 0, 900), opts: { bowlK: 0 },
  });
  w.tops[0].vx = speed;
  return w;
}
const snapEvents = (w) => w.events.filter((e) => e.type === 'snap');
// target lead (Nataraj HB) durability 6; attacker (Apsara Absolute) durability 10
const SNAP_AT = CONST.SNAP_BASE * 6; // a rammed top feels 1.5× the impact, the rammer 0.5×

test('lead snap only above threshold', () => {
  const below = snapWorld(0.6 * SNAP_AT) /* rammed side feels 1.5× */;
  steps(below, 0.5);
  assert.equal(snapEvents(below).length, 0);
  assert.equal(below.tops[1].leadSnapped, false);
});

test('lead snap fires once', () => {
  const w = snapWorld(1.25 * SNAP_AT);
  steps(w, 0.4);
  assert.equal(snapEvents(w).length, 1);
  assert.equal(snapEvents(w)[0].i, 1);
  assert.equal(w.tops[1].leadSnapped, true);
  assert.ok(w.tops[1].wobble >= 0.3);
  assert.equal(w.tops[0].leadSnapped, false);
  // second big hit
  w.events.length = 0;
  Object.assign(w.tops[0], { x: -0.25, y: 0, vx: 1.4 * SNAP_AT, vy: 0 });
  Object.assign(w.tops[1], { x: 0.25, y: 0, vx: 0, vy: 0, wobble: 0 });
  steps(w, 0.4);
  assert.ok(w.events.some((e) => e.type === 'hit'));
  assert.equal(snapEvents(w).length, 0);
});

test('lead snap costs a quarter of the spin', () => {
  const snapped = snapWorld(1.25 * SNAP_AT);
  steps(snapped, 0.4);
  const ctrl = snapWorld(1.25 * SNAP_AT);
  ctrl.tops[1].leadSnapped = true; // already snapped: same hit, no snap
  steps(ctrl, 0.4);
  const ratio = snapped.tops[1].rpm / ctrl.tops[1].rpm;
  assert.ok(Math.abs(ratio - 0.75) < 0.02, `ratio ${ratio}`);
});

test('same-point overlap is safe', () => {
  const w = world2({ la: launch(0, 0, 900), lb: launch(0, 0, 900) });
  step(w, NO_INTENT);
  for (const t of w.tops) for (const k of ['x', 'y', 'vx', 'vy', 'rpm']) assert.ok(Number.isFinite(t[k]), k);
  const [a, b] = w.tops;
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.spec.radius + b.spec.radius - 1e-9);
});

test('special fires once per round', () => {
  const w = world2({ a: ['nataraj-621', 'nataraj-hb'], la: launch(0.6, 0.3, 900) });
  steps(w, 3, SPECIAL_A);
  assert.equal(w.events.filter((e) => e.type === 'special' && e.i === 0).length, 1);
  assert.equal(w.tops[0].specialUsed, true);
});

test('second wind', () => {
  const w = world2({ a: ['camlin-dustfree', 'nataraj-hb'], opts: { bowlK: 0 } });
  const a = w.tops[0];
  a.rpm = 0.2 * a.spec.maxRPM;
  a.wobble = 0.5;
  step(w, SPECIAL_A);
  assert.ok(Math.abs(a.rpm - 0.4 * a.spec.maxRPM) < 2, `rpm ${a.rpm}`);
  assert.ok(Math.abs(a.wobble - 0.25) < 0.01, `wobble ${a.wobble}`);
  const full = world2({ a: ['camlin-dustfree', 'nataraj-hb'], opts: { bowlK: 0 } });
  step(full, SPECIAL_A);
  assert.ok(full.tops[0].rpm <= full.tops[0].spec.maxRPM);
});

test('recentre', () => {
  const mk = () => {
    const w = world2({ a: ['apsara-nondust', 'doms-y1'], la: launch(0.5, 0, 900, 0.7), opts: { bowlK: 0 } });
    w.tops[0].vx = 1;
    return w;
  };
  const w = mk(); const ctrl = mk();
  step(w, SPECIAL_A); step(ctrl, NO_INTENT);
  assert.ok(w.tops[0].wobble < 0.001);
  assert.ok(Math.hypot(w.tops[0].vx, w.tops[0].vy) < Math.hypot(ctrl.tops[0].vx, ctrl.tops[0].vy));
  assert.equal(w.tops[0].specialKind, 'recentre');
});

test('plant ignores steering and lasts 2.5 s', () => {
  const steerUp = [{ steer: { x: 0, y: 1 }, special: false }, NO_INTENT[1]];
  const w = world2({ a: ['apsara-jumbo', 'apsara-absolute'], opts: { bowlK: 0 } });
  step(w, SPECIAL_A);
  assert.equal(w.tops[0].planted, true);
  const y0 = w.tops[0].y;
  steps(w, 1.5, steerUp);
  assert.ok(Math.abs(w.tops[0].y - y0) < 1e-9);
  steps(w, 1.1, steerUp);
  assert.equal(w.tops[0].planted, false);
  steps(w, 0.3, steerUp);
  assert.ok(w.tops[0].y > y0 + 0.001);
});

test('plant halves damage taken', () => {
  const run = (plant) => {
    const w = world2({
      a: ['apsara-jumbo', 'apsara-absolute'], b: ['nataraj-621', 'apsara-absolute'],
      la: launch(0.25, 0, 800), lb: launch(-0.25, 0, 900), opts: { bowlK: 0 },
    });
    w.tops[1].vx = 1.5;
    step(w, plant ? SPECIAL_A : NO_INTENT);
    steps(w, 0.4);
    return 800 - w.tops[0].rpm;
  };
  const planted = run(true);
  const normal = run(false);
  assert.ok(planted < normal * 0.65, `planted ${planted} normal ${normal}`);
});

test('dash bursts toward the opponent', () => {
  const mk = () => world2({ a: ['nataraj-621', 'nataraj-hb'], la: launch(0, -0.5, 900), lb: launch(0, 0.5, 900), opts: { bowlK: 0 } });
  const w = mk(); const ctrl = mk();
  step(w, SPECIAL_A); step(ctrl, NO_INTENT);
  steps(w, 0.3); steps(ctrl, 0.3);
  assert.ok(w.tops[0].vy > ctrl.tops[0].vy + 0.5, `${w.tops[0].vy}`);
});

test('dash makes the next hit 1.5x', () => {
  const run = (armed) => hitTarget(['nataraj-621', 'apsara-absolute'], (w) => {
    if (armed) { w.tops[0].dashArmed = true; w.tops[0].dashArmedUntil = 99; }
  });
  const armed = run(true);
  const plain = run(false);
  assert.ok(armed > plain * 1.3, `armed ${armed} plain ${plain}`);
});

test('wild resolves to a real special', () => {
  const kinds = ['dash', 'plant', 'secondWind', 'recentre'];
  const a = world2({ a: ['fruit-scented', 'nataraj-hb'], rng: seeded(7) }).tops[0].specialKind;
  const b = world2({ a: ['fruit-scented', 'nataraj-hb'], rng: seeded(7) }).tops[0].specialKind;
  assert.ok(kinds.includes(a));
  assert.equal(a, b);
  const seen = new Set();
  for (let s = 1; s < 40; s++) seen.add(world2({ a: ['fruit-scented', 'nataraj-hb'], rng: seeded(s) }).tops[0].specialKind);
  assert.ok(seen.size >= 3);
});

test('defence-type erasers brace: they take less damage from the same hit', () => {
  const run = (archetype) => {
    const w = world2({
      a: ['apsara-jumbo', 'apsara-absolute'], b: ['nataraj-621', 'apsara-absolute'],
      la: launch(0.25, 0, 800), lb: launch(-0.25, 0, 900), opts: { bowlK: 0 },
    });
    w.tops[0].spec = { ...w.tops[0].spec, archetype };
    w.tops[1].vx = 1.5;
    steps(w, 0.4);
    return 800 - w.tops[0].rpm;
  };
  const braced = run('defense');
  const plain = run('balance');
  assert.ok(braced < plain * 0.9, `braced ${braced} plain ${plain}`);
});

test('a second snap-level hit on a snapped lead crumbles the eraser: snap KO', () => {
  const w = snapWorld(1.25 * SNAP_AT);
  steps(w, 0.4);
  assert.equal(w.tops[1].leadSnapped, true);
  assert.equal(w.over, false);
  w.events.length = 0;
  Object.assign(w.tops[0], { x: -0.25, y: 0, vx: 1.4 * SNAP_AT, vy: 0 });
  Object.assign(w.tops[1], { x: 0.25, y: 0, vx: 0, vy: 0, wobble: 0, rpm: 900 });
  steps(w, 0.4);
  assert.ok(w.events.some((e) => e.type === 'crumble' && e.i === 1));
  assert.deepEqual(w.result, { winner: 0, reason: 'snapko' });
});
