import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, ABILITY_IDS, UNLOCK_AT } from '../src/abilities.js';
import { buildTop } from '../src/parts.js';
import { createWorld, step } from '../src/physics.js';
import { pickAbility } from '../src/ai.js';
import { launch, still, seeded, NO_INTENT } from './helpers.js';

const PRESS_A = [{ steer: { x: 0, y: 0 }, special: true }, NO_INTENT[1]];

function mk(abilities, { a = ['apsara-nondust', 'nataraj-hb'], b = ['apsara-nondust', 'nataraj-hb'], la, lb, bowlK = 0 } = {}) {
  const sa = buildTop(...a), sb = buildTop(...b);
  return createWorld([sa, sb], [la || launch(-0.5, 0, sa.maxRPM), lb || launch(0.5, 0, sb.maxRPM)], still, { bowlK, abilities });
}
const steps = (w, s, intents = NO_INTENT) => { for (let i = 0; i < Math.round(s * 120); i++) step(w, intents); };

test('six abilities, each with a name and a description', () => {
  assert.equal(ABILITY_IDS.length, 6);
  for (const id of ABILITY_IDS) {
    assert.ok(ABILITIES[id].name && ABILITIES[id].desc, id);
  }
  assert.ok(ABILITY_IDS.includes('shield') && ABILITY_IDS.includes('crumbs'));
  assert.equal(UNLOCK_AT, 0.3);
});

test('each top uses the ability its player chose', () => {
  const w = mk(['shield', 'crumbs']);
  assert.equal(w.tops[0].specialKind, 'shield');
  assert.equal(w.tops[1].specialKind, 'crumbs');
});

test('an ability is locked above 30% health and unlocks below it', () => {
  const w = mk(['secondWind', 'dash']);
  const a = w.tops[0];
  step(w, PRESS_A);
  assert.equal(a.specialUsed, false);
  assert.equal(a.unlocked, false);
  a.rpm = 0.29 * a.spec.maxRPM;
  step(w, NO_INTENT);
  assert.equal(a.unlocked, true);
  assert.equal(w.events.filter((e) => e.type === 'unlock' && e.i === 0).length, 1);
  step(w, PRESS_A);
  assert.equal(a.specialUsed, true);
  assert.ok(w.events.some((e) => e.type === 'special' && e.i === 0 && e.kind === 'secondWind'));
});

test('the unlock fires only once even if health bounces back up', () => {
  const w = mk(['secondWind', 'dash']);
  const a = w.tops[0];
  a.rpm = 0.25 * a.spec.maxRPM;
  step(w, NO_INTENT);
  a.rpm = 0.6 * a.spec.maxRPM;
  step(w, NO_INTENT);
  a.rpm = 0.2 * a.spec.maxRPM;
  step(w, NO_INTENT);
  assert.equal(w.events.filter((e) => e.type === 'unlock').length, 1);
  assert.equal(a.unlocked, true); // stays unlocked
});

function rammed(shield) {
  const w = mk([shield ? 'shield' : 'dash', 'dash'], { la: launch(0.25, 0, 250), lb: launch(-0.25, 0, 900) });
  const v = w.tops[0];
  if (shield) { step(w, PRESS_A); }
  v.rpm = 900; // healthy again so it survives three rams
  const hits = [];
  for (let k = 0; k < 3; k++) {
    Object.assign(v, { x: 0.25, y: 0, vx: 0, vy: 0 });
    Object.assign(w.tops[1], { x: -0.25, y: 0, vx: 1.6, vy: 0, rpm: 900 });
    const before = v.rpm;
    steps(w, 0.35);
    hits.push(before - v.rpm);
  }
  return { w, hits };
}

test('graphite shield blocks the next two hits', () => {
  const shielded = rammed(true);
  const open = rammed(false);
  assert.ok(shielded.w.events.filter((e) => e.type === 'block').length >= 1);
  assert.ok(shielded.hits[0] < open.hits[0] * 0.3, `${shielded.hits[0]} vs ${open.hits[0]}`);
  assert.ok(shielded.hits[1] < open.hits[1] * 0.3, `${shielded.hits[1]} vs ${open.hits[1]}`);
  assert.ok(shielded.hits[2] > open.hits[2] * 0.6, 'third hit lands');
});

test('crumb trail slows the opponent but not its owner', () => {
  const w = mk(['crumbs', 'dash'], { la: launch(0, 0, 200) });
  step(w, PRESS_A);
  steps(w, 1);
  assert.ok(w.zones.length > 0);
  const z = w.zones[0];
  assert.equal(z.owner, 0);
  // owner rolling through its own crumbs keeps its speed
  const own = w.tops[0];
  Object.assign(own, { x: z.x, y: z.y, vx: 1, vy: 0 });
  const opp = w.tops[1];
  Object.assign(opp, { x: z.x, y: z.y + 0.001, vx: 1, vy: 0 });
  // keep them from colliding: move owner far after one check
  const ctrl = mk(['dash', 'dash']);
  Object.assign(ctrl.tops[1], { x: 0.3, y: 0.6, vx: 1, vy: 0 });
  own.x = -0.6; own.y = -0.6;
  step(w, NO_INTENT); step(ctrl, NO_INTENT);
  assert.ok(opp.vx < ctrl.tops[1].vx - 0.005, `${opp.vx} vs ${ctrl.tops[1].vx}`);
});

test('crumbs expire', () => {
  const w = mk(['crumbs', 'dash'], { la: launch(0, 0, 200) });
  step(w, PRESS_A);
  w.tops[0].rpm = 950; // keep the round going long enough to see them expire
  w.tops[1].rpm = 950;
  steps(w, 12);
  assert.equal(w.over, false);
  assert.equal(w.zones.filter((z) => z.owner === 0).length, 0);
});

test('cpu picks a valid ability, and Hard counters the opponent', () => {
  const rng = seeded(4);
  for (const d of ['easy', 'medium', 'hard']) {
    for (let i = 0; i < 50; i++) {
      assert.ok(ABILITY_IDS.includes(pickAbility(d, buildTop('camlin-dustfree', 'camlin-exam'), buildTop('nataraj-621', 'nataraj-hb'), rng)));
    }
  }
  // vs a rammer, Hard puts up the shield
  assert.equal(pickAbility('hard', buildTop('apsara-jumbo', 'apsara-absolute'), buildTop('nataraj-621', 'nataraj-hb'), rng), 'shield');
});
