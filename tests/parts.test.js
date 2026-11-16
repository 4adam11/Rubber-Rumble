import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERASERS, LEADS, COMBOS, buildTop, findCombo } from '../src/parts.js';

const inRange = (v) => Number.isInteger(v) && v >= 1 && v <= 10;

test('every eraser×lead pair builds valid stats', () => {
  assert.equal(ERASERS.length, 7);
  assert.equal(LEADS.length, 6);
  for (const e of ERASERS) {
    for (const l of LEADS) {
      const t = buildTop(e.id, l.id);
      for (const k of ['attack', 'defense', 'stamina', 'stability', 'glide', 'speed', 'durability']) {
        assert.ok(inRange(t[k]), `${e.id}+${l.id} ${k}=${t[k]}`);
      }
      for (const k of ['attack', 'defense', 'stamina', 'balance', 'speed']) {
        assert.ok(inRange(t.card[k]), `${e.id}+${l.id} card.${k}=${t.card[k]}`);
      }
      assert.ok(t.maxRPM > 0);
      assert.ok(t.radius > 0);
      assert.ok(t.baseWobble >= 0);
    }
  }
});

test('deadly duo', () => {
  const t = buildTop('apsara-nondust', 'nataraj-hb');
  assert.equal(t.combo.id, 'deadly-duo');
  assert.equal(t.attack, 8);
  assert.equal(t.stability, 8);
  assert.equal(buildTop('apsara-jumbo', 'nataraj-hb').combo.id, 'deadly-duo');
});

test('deadly duo beats family precedence', () => {
  assert.equal(buildTop('apsara-nondust', 'nataraj-hb').combo.id, 'deadly-duo');
  const fam = buildTop('nataraj-621', 'apsara-platinum');
  assert.equal(fam.combo.id, 'hindustan-family');
  assert.equal(fam.stamina, 6);
  assert.equal(fam.durability, 5);
});

test('doms double cancels cube wobble', () => {
  assert.equal(buildTop('doms-cubo', 'doms-y1').baseWobble, 0);
  assert.equal(buildTop('doms-cubo', 'nataraj-hb').baseWobble, 2);
});

test('each named combo only on its parts', () => {
  const fam = (id) => id.startsWith('apsara-') || id.startsWith('nataraj-');
  const expected = (e, l) => {
    if ((e === 'apsara-nondust' || e === 'apsara-jumbo') && l === 'nataraj-hb') return 'deadly-duo';
    if (e === 'doms-cubo' && l === 'doms-y1') return 'doms-double';
    if (e === 'camlin-dustfree' && l === 'camlin-exam') return 'exam-hall';
    if (e === 'faber-dustfree' && l === 'faber-2b') return 'toppers-kit';
    if (e === 'fruit-scented' && l === 'apsara-platinum') return 'sugar-rush';
    if (e === 'apsara-jumbo' && l === 'faber-2b') return 'sleepy-bench';
    if (fam(e) && fam(l)) return 'hindustan-family';
    return null;
  };
  for (const e of ERASERS) {
    for (const l of LEADS) {
      const c = buildTop(e.id, l.id).combo;
      const want = expected(e.id, l.id);
      if (want) assert.equal(c.id, want, `${e.id}+${l.id}`);
      else assert.ok(c && !c.star && !c.bad, `${e.id}+${l.id} has a standard combo`); // every other pair
    }
  }
});

test('sleepy bench is bad', () => {
  assert.equal(buildTop('apsara-jumbo', 'faber-2b').combo.bad, true);
  for (const c of COMBOS) {
    if (c.id !== 'sleepy-bench') assert.equal(c.bad, false, c.id);
  }
});

test('card formulas', () => {
  const t = buildTop('camlin-dustfree', 'doms-y1');
  assert.equal(t.combo.id, 'free-period'); // Glide +1 (9 → 10), Defense −1
  assert.equal(t.card.stamina, Math.round((8 + 10) / 2));
  assert.equal(t.card.balance, 6);
  assert.equal(t.card.speed, 5);
});

test('maxRPM formula', () => {
  const t = buildTop('nataraj-621', 'nataraj-hb');
  assert.ok(Math.abs(t.maxRPM - 1000 * (1.15 - 3 * 0.03)) < 1e-9);
});

test('special mapping', () => {
  assert.equal(buildTop('doms-cubo', 'nataraj-hb').special, 'dash');
  assert.equal(buildTop('apsara-jumbo', 'nataraj-hb').special, 'plant');
  assert.equal(buildTop('fruit-scented', 'nataraj-hb').special, 'wild');
  assert.equal(buildTop('camlin-dustfree', 'nataraj-hb').special, 'secondWind');
  assert.equal(buildTop('apsara-nondust', 'doms-y1').special, 'recentre');
});

test('unknown id throws', () => {
  assert.throws(() => buildTop('nope', 'nataraj-hb'));
  assert.throws(() => buildTop('apsara-nondust', 'nope'));
});

// ---- a combo for every pair ----
test('every eraser + lead pair has a combo', () => {
  for (const e of ERASERS) for (const l of LEADS) assert.ok(buildTop(e.id, l.id).combo, `${e.id}+${l.id}`);
});

test('13 star combos, 1 bad combo, 28 standard combos', () => {
  const all = ERASERS.flatMap((e) => LEADS.map((l) => buildTop(e.id, l.id).combo));
  assert.equal(all.filter((c) => c.star).length, 13);
  assert.equal(all.filter((c) => c.bad).length, 1);
  assert.equal(all.filter((c) => !c.star && !c.bad).length, 28);
});

test('a standard combo is exactly one stat up and one stat down, for one pair', () => {
  const standard = COMBOS.filter((x) => !x.star && !x.bad);
  assert.equal(standard.length, 28);
  for (const c of standard) {
    assert.deepEqual(Object.values(c.mods).sort(), [-1, 1], c.id);
    assert.equal(c.erasers.length, 1, c.id);
    assert.equal(c.leads.length, 1, c.id);
    assert.match(c.desc, /\+1, .+ −1$/, c.id);
  }
  assert.equal(new Set(COMBOS.map((c) => c.id)).size, COMBOS.length, 'ids are unique');
  assert.equal(new Set(COMBOS.map((c) => c.name)).size, COMBOS.length, 'names are unique');
});

test('the old combos are untouched', () => {
  assert.deepEqual(findCombo('apsara-nondust', 'nataraj-hb').mods, { attack: 2, stability: 1 });
  assert.equal(findCombo('apsara-jumbo', 'faber-2b').id, 'sleepy-bench');
  assert.equal(findCombo('nataraj-621', 'apsara-absolute').id, 'hindustan-family');
  assert.equal(findCombo('doms-cubo', 'nataraj-hb').name, 'Sharp Corners');
  assert.equal(buildTop('doms-cubo', 'nataraj-hb').combo.star, false);
  assert.equal(buildTop('apsara-nondust', 'nataraj-hb').combo.star, true);
});
