import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTop } from '../src/parts.js';
import {
  LAUNCH, createLaunch, slide, setPlace, addStroke, keyStroke, ringSize, release, updateLaunch,
  createPairStrokeDetector, createCircleStrokeDetector,
} from '../src/launch.js';

const spec = buildTop('apsara-nondust', 'nataraj-hb');
const per = spec.maxRPM / LAUNCH.STROKES_TO_MAX;
const twisting = (side = 0) => {
  const s = createLaunch(spec, side);
  updateLaunch(s, LAUNCH.PLACE_TIME);
  return s;
};

test('phases advance on time', () => {
  const s = createLaunch(spec, 0);
  assert.equal(s.phase, 'place');
  updateLaunch(s, 1.5);
  assert.equal(s.phase, 'twist');
  updateLaunch(s, 2.5);
  assert.equal(s.phase, 'done');
  assert.equal(s.result.wobble, 0.25);
  assert.equal(s.result.perfect, false);
});

test('alternating keys add strokes, repeats do not', () => {
  const a = twisting();
  keyStroke(a, 'L'); keyStroke(a, 'R'); keyStroke(a, 'L');
  assert.ok(Math.abs(a.rpm - 3 * per) < 1e-9);
  const b = twisting();
  keyStroke(b, 'L'); keyStroke(b, 'L'); keyStroke(b, 'L');
  assert.ok(Math.abs(b.rpm - per) < 1e-9);
});

test('22 strokes nearly fill, with diminishing returns', () => {
  const a = twisting();
  for (let i = 0; i < 22; i++) addStroke(a, 1);
  assert.ok(a.rpm < spec.maxRPM && a.rpm > 0.85 * spec.maxRPM, `${a.rpm}`);
  const b = twisting();
  for (let i = 0; i < 40; i++) addStroke(b, 1);
  assert.equal(b.rpm, spec.maxRPM);
});

test('strokes ignored outside twist', () => {
  const s = createLaunch(spec, 0);
  keyStroke(s, 'L');
  addStroke(s, 1);
  assert.equal(s.rpm, 0);
  release(s);
  assert.equal(s.phase, 'place');
});

test('perfect release', () => {
  const a = twisting();
  for (let i = 0; i < 10; i++) addStroke(a, 1);
  const pre = a.rpm;
  assert.ok(ringSize(a) <= LAUNCH.PERFECT_RING);
  release(a);
  assert.equal(a.result.perfect, true);
  assert.equal(a.result.wobble, 0);
  assert.ok(Math.abs(a.result.rpm - pre * 1.05) < 1e-9);
});

test('loose release adds wobble', () => {
  const a = twisting();
  addStroke(a, 1);
  updateLaunch(a, 0.4);
  assert.ok(Math.abs(ringSize(a) - 1) < 1e-9);
  release(a);
  assert.equal(a.result.perfect, false);
  assert.ok(Math.abs(a.result.wobble - 0.4) < 1e-9);
});

test('release position on the rim', () => {
  const a = twisting(1);
  release(a);
  assert.ok(Math.abs(a.result.x - LAUNCH.START_RADIUS) < 1e-9);
  assert.ok(Math.abs(a.result.y) < 1e-9);
  const b = twisting(0);
  release(b);
  assert.ok(Math.abs(b.result.x + LAUNCH.START_RADIUS) < 1e-9);
});

test('slide clamps', () => {
  const s = createLaunch(spec, 1);
  slide(s, 1, 10);
  assert.ok(Math.abs(s.rimAngle - LAUNCH.SLIDE_RANGE) < 1e-9);
  slide(s, -1, 20);
  assert.ok(Math.abs(s.rimAngle + LAUNCH.SLIDE_RANGE) < 1e-9);
  const p = createLaunch(spec, 0);
  setPlace(p, 0);
  assert.ok(Math.abs(p.rimAngle - (Math.PI - LAUNCH.SLIDE_RANGE)) < 1e-9);
  setPlace(p, -Math.PI + 0.1); // just past the wrap, near home
  assert.ok(Math.abs(p.rimAngle - (Math.PI + 0.1)) < 1e-9);
});

test('pair detector counts alternating thumb flicks', () => {
  const d = createPairStrokeDetector();
  const out = [0, 35, -5, 35].map((gap, i) => d.update(gap, 0, i * 0.05));
  assert.equal(out[0], 0);
  assert.ok(out[1] > 0 && out[2] > 0 && out[3] > 0);
  for (const v of out.slice(1)) assert.ok(v >= 0.5 && v <= 1.5);
});

test('pair detector ignores jitter and one-way drags', () => {
  const j = createPairStrokeDetector();
  assert.equal([0, 10, 0, 10, 0].map((g, i) => j.update(g, 0, i * 0.05)).filter((v) => v > 0).length, 0);
  const one = createPairStrokeDetector();
  assert.equal([0, 35, 70, 105].map((g, i) => one.update(g, 0, i * 0.05)).filter((v) => v > 0).length, 1);
});

test('circle detector', () => {
  const d = createCircleStrokeDetector();
  let strokes = 0;
  for (let i = 0; i <= 200; i++) {
    const a = Math.atan2(Math.sin(i * (2 * Math.PI + 0.02) / 200), Math.cos(i * (2 * Math.PI + 0.02) / 200));
    if (d.update(a, i * 0.005) > 0) strokes++;
  }
  assert.equal(strokes, 2);
});
