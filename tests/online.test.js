// Host ↔ guest helpers: snapshots, smoothing, merging a friend's launch, cleaning what comes off the wire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTop } from '../src/parts.js';
import { createWorld } from '../src/physics.js';
import { createLaunch, updateLaunch, LAUNCH } from '../src/launch.js';
import {
  packWorld, createMirror, pushSnapshot, interpolate, INTERP_DELAY,
  launchView, mergeRemoteLaunch, launchDeadline, finishLaunchNow, cleanIntent, cleanLaunchResult,
} from '../src/online.js';
import { still } from './helpers.js';

const specs = () => [buildTop('apsara-nondust', 'nataraj-hb'), buildTop('doms-cubo', 'doms-y1'), buildTop('camlin-dustfree', 'camlin-exam')];

function world3() {
  const s = specs();
  return createWorld(s, [[-0.6, 0], [0.3, 0.5], [0.3, -0.5]].map(([x, y], i) => ({ x, y, rpm: s[i].maxRPM, wobble: 0.1, spinDir: i ? -1 : 1 })), still, {});
}

test('a snapshot carries every top and its state flags', () => {
  const w = world3();
  w.time = 3.25;
  Object.assign(w.tops[1], { out: true, outAt: 3, leadSnapped: true, unlocked: true, shieldHits: 2 });
  w.clash = { t: 0.5, pair: [0, 2], mash: [3, 4], x: 0.1, y: 0 };
  const m = createMirror(specs());
  pushSnapshot(m, JSON.parse(JSON.stringify(packWorld(w))), 10);
  interpolate(m, 10 + INTERP_DELAY + 1);
  assert.equal(m.time, 3.25);
  assert.ok(Math.abs(m.tops[1].x - 0.3) < 1e-3 && Math.abs(m.tops[1].y - 0.5) < 1e-3);
  assert.equal(m.tops[1].out, true);
  assert.equal(m.tops[1].outAt, 3);
  assert.equal(m.tops[1].leadSnapped, true);
  assert.equal(m.tops[1].unlocked, true);
  assert.equal(m.tops[1].shieldHits, 2);
  assert.equal(m.tops[2].spinDir, -1);
  assert.deepEqual(m.clash.pair, [0, 2]);
  assert.equal(m.tops[0].spec.eraserId, 'apsara-nondust');
});

test('guests draw smoothly: halfway between two snapshots, 100 ms behind', () => {
  const w = world3();
  const m = createMirror(specs());
  pushSnapshot(m, packWorld(w), 1.0);
  w.tops[0].x = -0.4; w.time += 0.05;
  pushSnapshot(m, packWorld(w), 1.05);
  interpolate(m, 1.025 + INTERP_DELAY);
  assert.ok(Math.abs(m.tops[0].x - -0.5) < 1e-3, `x ${m.tops[0].x}`);
  interpolate(m, 5); // long after: hold the newest, never run ahead
  assert.ok(Math.abs(m.tops[0].x - -0.4) < 1e-3);
});

test("a friend's launch moves forward only", () => {
  const s = createLaunch(specs()[1], 1, { seats: 3 });
  mergeRemoteLaunch(s, { phase: 'twist', rimAngle: s.home + 0.2, rpm: 300, spinDir: -1 });
  assert.equal(s.phase, 'twist');
  assert.equal(s.rpm, 300);
  assert.equal(s.spinDir, -1);
  mergeRemoteLaunch(s, { phase: 'place', rimAngle: s.home, rpm: 0 });
  assert.equal(s.phase, 'twist', 'no going back to place');
  finishLaunchNow(s);
  mergeRemoteLaunch(s, { phase: 'twist', rpm: 999 });
  assert.equal(s.phase, 'done');
  assert.equal(s.rpm, 300);
});

test('a slot never wanders outside its seat', () => {
  const s = createLaunch(specs()[0], 2, { seats: 4 });
  mergeRemoteLaunch(s, { phase: 'place', rimAngle: s.home + 3, rpm: 0 });
  assert.ok(Math.abs(s.rimAngle - s.home) <= s.range + 1e-9);
});

test('a silent friend is launched for them at the deadline', () => {
  const s = createLaunch(specs()[0], 1, { seats: 2, twistTime: LAUNCH.TWIST_TIME });
  assert.equal(launchDeadline(s), LAUNCH.PLACE_TIME + LAUNCH.TWIST_TIME + 1.5);
  mergeRemoteLaunch(s, { phase: 'twist', rimAngle: s.home, rpm: 400, spinDir: 1 });
  finishLaunchNow(s);
  assert.equal(s.phase, 'done');
  assert.equal(s.result.rpm, 400);
  assert.equal(s.result.perfect, false);
  assert.ok(Math.abs(Math.hypot(s.result.x, s.result.y) - LAUNCH.START_RADIUS) < 1e-9);
});

test('launch view is what other devices need to draw it', () => {
  const s = createLaunch(specs()[0], 0);
  updateLaunch(s, LAUNCH.PLACE_TIME);
  s.rpm = 123;
  assert.deepEqual(Object.keys(launchView(s)).sort(), ['phase', 'rimAngle', 'rpm', 'spinDir', 't']);
});

test('inputs from the wire are cleaned', () => {
  assert.deepEqual(cleanIntent({ steer: { x: 3, y: 4 }, sp: 2, taps: 500 }), { steer: { x: 0.6, y: 0.8 }, special: true, mash: 20 });
  assert.deepEqual(cleanIntent({ steer: { x: 'a', y: NaN } }), { steer: { x: 0, y: 0 }, special: false, mash: 0 });
  assert.deepEqual(cleanIntent(null), { steer: { x: 0, y: 0 }, special: false, mash: 0 });
});

test('a launch result from the wire is kept honest', () => {
  const spec = specs()[0];
  const s = createLaunch(spec, 1, { seats: 2 });
  const r = cleanLaunchResult(s, { x: 5, y: 0, rpm: spec.maxRPM * 9, wobble: -2, perfect: true, spinDir: 7 });
  assert.ok(r.rpm <= spec.maxRPM * 1.05 + 1e-9);
  assert.ok(r.wobble >= 0 && r.wobble <= 1);
  assert.equal(r.spinDir, 1);
  assert.ok(Math.abs(Math.hypot(r.x, r.y) - LAUNCH.START_RADIUS) < 1e-9, 'back on the rim');
  assert.ok(Math.abs(Math.atan2(r.y, r.x) - s.home) <= s.range + 1e-9, 'inside its own slot');
});
