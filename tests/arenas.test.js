import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARENAS, ARENA_IDS } from '../src/arenas.js';
import { buildTop } from '../src/parts.js';
import { createWorld, step } from '../src/physics.js';
import { cpuLaunch, createCpu, pickCombo } from '../src/ai.js';
import { LAUNCH } from '../src/launch.js';
import { launch, still, seeded, NO_INTENT } from './helpers.js';

const spec = () => buildTop('apsara-nondust', 'nataraj-hb');
const mkWorld = (arena, la, lb) => createWorld([spec(), spec()], [la, lb], still, { arena: ARENAS[arena] });

test('three arenas from basic to hard', () => {
  assert.deepEqual(ARENA_IDS, ['thali', 'tiffin', 'geometry']);
  assert.deepEqual(ARENA_IDS.map((id) => ARENAS[id].level), ['Basic', 'Medium', 'Hard']);
  assert.equal(ARENAS.thali.zones.length + ARENAS.thali.bumpers.length, 0);
  assert.ok(ARENAS.geometry.bumpers.length >= 1);
  assert.ok(ARENAS.geometry.zones.length >= 3);
});

test('arena slowing patches slow a top down', () => {
  const z = ARENAS.geometry.zones[0];
  const w = mkWorld('geometry', launch(z.x, z.y, 900), launch(-0.9, 0.3, 900));
  const ctrl = mkWorld('thali', launch(z.x, z.y, 900), launch(-0.9, 0.3, 900));
  for (const ww of [w, ctrl]) { ww.bowlK = 0; ww.tops[0].vx = 0.6; }
  for (let i = 0; i < 12; i++) { step(w, NO_INTENT); step(ctrl, NO_INTENT); }
  assert.ok(w.tops[0].vx < ctrl.tops[0].vx * 0.9, `${w.tops[0].vx} vs ${ctrl.tops[0].vx}`);
});

test('the sharpener is solid: tops bounce off it', () => {
  const b = ARENAS.geometry.bumpers[0];
  const w = mkWorld('geometry', launch(b.x - 0.35, b.y, 900), launch(-0.9, -0.3, 900));
  w.bowlK = 0;
  w.tops[0].vx = 2;
  let bumped = false;
  for (let i = 0; i < 60; i++) {
    step(w, NO_INTENT);
    if (w.events.some((e) => e.type === 'bump')) bumped = true;
    const t = w.tops[0];
    assert.ok(Math.hypot(t.x - b.x, t.y - b.y) >= b.r + t.spec.radius - 1e-6, 'never inside the sharpener');
  }
  assert.ok(bumped);
  assert.ok(w.tops[0].vx < 0, 'bounced back');
});

test('nothing solid sits on the launch arc', () => {
  for (const id of ARENA_IDS) {
    for (const b of ARENAS[id].bumpers) {
      for (const home of [0, Math.PI]) {
        for (let a = -LAUNCH.SLIDE_RANGE; a <= LAUNCH.SLIDE_RANGE; a += 0.05) {
          const x = LAUNCH.START_RADIUS * Math.cos(home + a), y = LAUNCH.START_RADIUS * Math.sin(home + a);
          assert.ok(Math.hypot(x - b.x, y - b.y) > b.r + 0.16, `${id} bumper too close to the rim`);
        }
      }
    }
  }
});

test('cpu rounds finish at a sensible length on every arena', () => {
  const rng = seeded(21);
  for (const id of ARENA_IDS) {
    let total = 0;
    const N = 24;
    for (let k = 0; k < N; k++) {
      const pa = pickCombo('medium', null, rng), pb = pickCombo('medium', null, rng);
      const sa = buildTop(pa.eraserId, pa.leadId), sb = buildTop(pb.eraserId, pb.leadId);
      const w = createWorld([sa, sb], [cpuLaunch(sa, 'medium', 0, rng), cpuLaunch(sb, 'medium', 1, rng)], rng, { arena: ARENAS[id] });
      const cpus = [createCpu('medium', 0, rng), createCpu('medium', 1, rng)];
      while (!w.over) step(w, cpus.map((c) => c.think(w, 1 / 120)));
      total += w.time;
    }
    const mean = total / N;
    assert.ok(mean > 8 && mean < 45, `${id} mean round ${mean.toFixed(1)}s`);
  }
});
