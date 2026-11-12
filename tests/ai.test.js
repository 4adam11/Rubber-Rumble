import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERASERS, buildTop } from '../src/parts.js';
import { createWorld, step } from '../src/physics.js';
import { DIFFICULTY, pickCombo, cpuLaunch, createCpu } from '../src/ai.js';
import { world2, launch, seeded } from './helpers.js';

const archetypeOf = (id) => ERASERS.find((e) => e.id === id).archetype;

test('launch quality matches difficulty', () => {
  const spec = buildTop('apsara-nondust', 'nataraj-hb');
  const rng = seeded(3);
  for (const [name, d] of Object.entries(DIFFICULTY)) {
    let sum = 0;
    for (let i = 0; i < 500; i++) {
      const r = cpuLaunch(spec, name, 1, rng);
      assert.ok(r.rpm <= 1.05 * spec.maxRPM + 1e-9);
      assert.ok(r.wobble >= 0 && r.wobble <= 0.4);
      sum += r.rpm / spec.maxRPM;
    }
    const expected = d.rpm * (1 + 0.05 * d.perfect);
    assert.ok(Math.abs(sum / 500 - expected) < 0.03, `${name}: ${sum / 500} vs ${expected}`);
  }
});

test('cpu launches from its own side', () => {
  const spec = buildTop('apsara-nondust', 'nataraj-hb');
  assert.ok(cpuLaunch(spec, 'easy', 1, seeded(1)).x > 0.7);
  assert.ok(cpuLaunch(spec, 'easy', 0, seeded(1)).x < -0.7);
});

test('medium never picks a bad combo', () => {
  const rng = seeded(5);
  for (let i = 0; i < 500; i++) {
    const p = pickCombo('medium', null, rng);
    const c = buildTop(p.eraserId, p.leadId).combo;
    assert.ok(!c || !c.bad, `${p.eraserId}+${p.leadId}`);
  }
});

test('easy picks anything valid', () => {
  const rng = seeded(9);
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const p = pickCombo('easy', null, rng);
    buildTop(p.eraserId, p.leadId);
    seen.add(p.eraserId);
  }
  assert.equal(seen.size, ERASERS.length);
});

test('hard counter-picks', () => {
  const rng = seeded(2);
  const vsAttack = pickCombo('hard', buildTop('nataraj-621', 'nataraj-hb'), rng);
  assert.equal(archetypeOf(vsAttack.eraserId), 'defense');
  assert.ok(!buildTop(vsAttack.eraserId, vsAttack.leadId).combo?.bad);
  const vsStamina = pickCombo('hard', buildTop('camlin-dustfree', 'camlin-exam'), rng);
  assert.equal(archetypeOf(vsStamina.eraserId), 'attack');
  const vsDefense = pickCombo('hard', buildTop('apsara-jumbo', 'nataraj-hb'), rng);
  assert.equal(archetypeOf(vsDefense.eraserId), 'stamina');
  const vsBalance = pickCombo('hard', buildTop('apsara-nondust', 'doms-y1'), rng);
  assert.equal(buildTop(vsBalance.eraserId, vsBalance.leadId).combo?.id, 'deadly-duo');
});

function thinkFor(cpu, w, seconds = 0.6) {
  let intent;
  for (let t = 0; t < seconds; t += 0.05) intent = cpu.think(w, 0.05);
  return intent;
}

test('cpu steers away from the rim', () => {
  const w = world2({ la: launch(0.9, 0, 300), lb: launch(-0.5, 0, 900) });
  const intent = thinkFor(createCpu('hard', 0, seeded(1)), w);
  assert.ok(intent.steer.x < 0, `${intent.steer.x}`);
});

test('cpu chases when ahead', () => {
  const w = world2({ a: ['nataraj-621', 'nataraj-hb'], la: launch(-0.2, 0, 900), lb: launch(0.4, 0, 400) });
  const intent = thinkFor(createCpu('hard', 0, seeded(1)), w);
  assert.ok(intent.steer.x > 0, `${intent.steer.x}`);
});

test('cpu uses second wind when low', () => {
  const w = world2({ a: ['camlin-dustfree', 'nataraj-hb'], la: launch(0.3, 0.2, 0), lb: launch(-0.5, 0, 900) });
  w.tops[0].rpm = 0.25 * w.tops[0].spec.maxRPM;
  const cpu = createCpu('easy', 0, seeded(1));
  let fired = false;
  for (let t = 0; t < DIFFICULTY.easy.reaction + 0.1; t += 0.05) if (cpu.think(w, 0.05).special) fired = true;
  assert.ok(fired);
});

test('cpu intents are always valid', () => {
  const rng = seeded(11);
  for (const diff of Object.keys(DIFFICULTY)) {
    const pa = pickCombo(diff, null, rng), pb = pickCombo(diff, null, rng);
    const sa = buildTop(pa.eraserId, pa.leadId), sb = buildTop(pb.eraserId, pb.leadId);
    const w = createWorld([sa, sb], [cpuLaunch(sa, diff, 0, rng), cpuLaunch(sb, diff, 1, rng)], rng);
    const cpus = [createCpu(diff, 0, rng), createCpu(diff, 1, rng)];
    for (let i = 0; i < 30 * 120 && !w.over; i++) {
      const intents = cpus.map((c) => c.think(w, 1 / 120));
      for (const it of intents) {
        assert.ok(Number.isFinite(it.steer.x) && Number.isFinite(it.steer.y));
        assert.ok(Math.hypot(it.steer.x, it.steer.y) <= 1 + 1e-9);
        assert.equal(typeof it.special, 'boolean');
      }
      step(w, intents);
    }
  }
});
