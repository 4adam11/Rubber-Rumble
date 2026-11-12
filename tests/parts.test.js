import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERASERS, LEADS, COMBOS, buildTop } from '../src/parts.js';

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
      assert.equal(c ? c.id : null, expected(e.id, l.id), `${e.id}+${l.id}`);
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
  assert.equal(t.combo, null);
  assert.equal(t.card.stamina, Math.round((8 + 9) / 2));
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
