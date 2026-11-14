// Seats for 2–4 players: where each top launches, scoring, and how the computer plays in a crowd.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTop } from '../src/parts.js';
import { createWorld } from '../src/physics.js';
import { LAUNCH, createLaunch, setPlace, seatAngle } from '../src/launch.js';
import { createMatch } from '../src/match.js';
import { createCpu, cpuLaunch } from '../src/ai.js';
import { still, seeded } from './helpers.js';

const spec = (e = 'apsara-nondust', l = 'nataraj-hb') => buildTop(e, l);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

test('two seats keep the old sides: left (π) and right (0)', () => {
  assert.equal(seatAngle(0, 2), Math.PI);
  assert.equal(seatAngle(1, 2), 0);
  assert.equal(createLaunch(spec(), 0).rimAngle, Math.PI);
  assert.equal(createLaunch(spec(), 1).rimAngle, 0);
  assert.equal(createLaunch(spec(), 1).range, LAUNCH.SLIDE_RANGE);
});

test('four seats sit a quarter turn apart and their slide ranges never overlap', () => {
  const homes = [0, 1, 2, 3].map((k) => seatAngle(k, 4));
  for (let k = 0; k < 4; k++) {
    const gap = Math.abs(wrap(homes[(k + 1) % 4] - homes[k]));
    assert.ok(Math.abs(gap - Math.PI / 2) < 1e-9);
  }
  const s = createLaunch(spec(), 2, { seats: 4 });
  assert.ok(2 * s.range < Math.PI / 2, `range ${s.range}`);
  updateToPlace(s);
  setPlace(s, s.home + 1.4); // way past its slot
  assert.ok(Math.abs(wrap(s.rimAngle - s.home) - s.range) < 1e-9);
});

function updateToPlace(s) { s.phase = 'place'; }

test('a 4-seat match scores seat 3', () => {
  const m = createMatch({ seats: 4 });
  const st = m.record({ winner: 3, reason: 'ringout' });
  assert.deepEqual(st.points, [0, 0, 0, 2]);
  assert.deepEqual(st.wins, [0, 0, 0, 1]);
});

test('computer launches from its own seat', () => {
  const rng = seeded(4);
  for (let k = 0; k < 20; k++) {
    const r = cpuLaunch(spec(), 'medium', 3, rng, 4);
    const a = Math.atan2(r.y, r.x);
    assert.ok(Math.abs(wrap(a - seatAngle(3, 4))) <= (Math.PI / 4 - 0.1) * 0.5 + 1e-9);
  }
});

function crowd(points, outs = []) {
  const specs = points.map(() => spec('nataraj-621', 'nataraj-hb')); // attackers ram the nearest rival
  const w = createWorld(specs, points.map(([x, y], i) => ({ x, y, rpm: specs[i].maxRPM, wobble: 0 })), still, { clash: false });
  for (const i of outs) w.tops[i].out = true;
  return w;
}

test('the computer goes for the nearest rival still spinning', () => {
  const w = crowd([[0, 0], [0.3, 0], [-0.5, 0]], [1]);
  const cpu = createCpu('hard', 0, seeded(1));
  let steer = null;
  for (let k = 0; k < 30 && !steer?.x; k++) steer = cpu.think(w, 0.1).steer;
  assert.ok(steer.x < 0, `steers toward live top 2: ${steer.x}`);
});

test('only the two computers in a clash mash', () => {
  const w = crowd([[0, 0], [0.3, 0], [-0.5, 0]]);
  w.clash = { t: 0, pair: [1, 2], mash: [0, 0], x: 0, y: 0 };
  const out = createCpu('hard', 0, seeded(2)), inside = createCpu('hard', 1, seeded(3));
  let a = 0, b = 0;
  for (let k = 0; k < 60; k++) { a += out.think(w, 1 / 30).mash || 0; b += inside.think(w, 1 / 30).mash || 0; }
  assert.equal(a, 0);
  assert.ok(b > 0);
});
