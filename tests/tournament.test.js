import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUNGS, MODIFIERS, advance, bossSpec } from '../src/tournament.js';
import { ERASERS, LEADS, buildTop } from '../src/parts.js';
import { ABILITY_IDS } from '../src/abilities.js';
import { ARENA_IDS } from '../src/arenas.js';
import { createWorld, step } from '../src/physics.js';
import { launch, still, NO_INTENT } from './helpers.js';

const ORDER = { easy: 0, medium: 1, hard: 2 };

test('five opponents, getting harder, ending with the Principal', () => {
  assert.equal(RUNGS.length, 5);
  assert.equal(RUNGS[4].boss, true);
  assert.match(RUNGS[4].name, /Principal/);
  for (let i = 1; i < RUNGS.length; i++) assert.ok(ORDER[RUNGS[i].difficulty] >= ORDER[RUNGS[i - 1].difficulty]);
  for (const r of RUNGS) {
    assert.ok(ERASERS.some((e) => e.id === r.parts.eraserId), r.id);
    assert.ok(LEADS.some((l) => l.id === r.parts.leadId), r.id);
    assert.ok(ABILITY_IDS.includes(r.ability), r.id);
    assert.ok(ARENA_IDS.includes(r.arena), r.id);
    assert.ok(!r.modifier || MODIFIERS[r.modifier], r.id);
    assert.ok(r.taunt && r.name, r.id);
  }
});

test('winning climbs the ladder, losing stays put, the last win makes you champion', () => {
  let p = { rung: 0, champion: false };
  p = advance(p, false);
  assert.equal(p.rung, 0);
  for (let i = 0; i < 4; i++) p = advance(p, true);
  assert.equal(p.rung, 4);
  assert.equal(p.champion, false);
  p = advance(p, true);
  assert.equal(p.champion, true);
  assert.equal(p.rung, 4, 'stays on the last rung for replays');
});

test('the boss top is bigger, heavier and spins longer', () => {
  const base = buildTop('apsara-jumbo', 'apsara-absolute');
  const boss = bossSpec(base);
  assert.ok(boss.radius > base.radius * 1.2);
  assert.ok(boss.mass > base.mass);
  assert.ok(boss.maxRPM > base.maxRPM * 1.1 && boss.maxRPM < base.maxRPM * 1.2, 'spins longer, but not so long that no earned top can win (tools/kit-check.mjs)');
  assert.equal(boss.boss, true);
  assert.equal(base.boss, undefined, 'original untouched');
});

function world(mods, bowlK = 0) {
  const s = buildTop('apsara-nondust', 'nataraj-hb');
  return createWorld([s, s], [launch(-0.5, 0, 900), launch(0.5, 0.5, 900)], still, { bowlK, clash: false, mods });
}

test('oily desk: tops keep sliding longer', () => {
  const oily = world(MODIFIERS.oily.mods), dry = world(null);
  oily.tops[0].vx = dry.tops[0].vx = 1;
  for (let i = 0; i < 120; i++) { step(oily, NO_INTENT); step(dry, NO_INTENT); }
  assert.ok(oily.tops[0].vx > dry.tops[0].vx * 1.2);
});

test('ceiling fan: a breeze pushes tops sideways', () => {
  const fan = world(MODIFIERS.fan.mods), calm = world(null);
  for (let i = 0; i < 120; i++) { step(fan, NO_INTENT); step(calm, NO_INTENT); }
  assert.ok(fan.tops[0].x > calm.tops[0].x + 0.02);
});

test('earthquake drill: the desk shakes every few seconds', () => {
  const w = world(MODIFIERS.quake.mods, 0.7); // the bowl keeps the tops in while the desk shakes
  let quakes = 0;
  for (let i = 0; i < 120 * 9; i++) { step(w, NO_INTENT); quakes += w.events.filter((e) => e.type === 'quake').length; w.events.length = 0; }
  assert.ok(quakes >= 2, `${quakes} quakes`);
});
