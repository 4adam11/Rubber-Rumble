import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMOS, DEMO_PROP, drawDemo } from '../src/demos.js';

function fakeCtx() {
  const calls = [];
  const grad = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s) => ({ width: String(s).length * 7 });
      if (prop.startsWith('create')) return () => grad;
      return () => { calls.push(prop); };
    },
    set() { return true; },
  });
}

test('one demo per control, all using the same top', () => {
  assert.deepEqual(DEMOS.map((d) => d.id), ['place', 'twist', 'release', 'steer', 'ability']);
  assert.deepEqual(DEMO_PROP, { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' });
  for (const d of DEMOS) assert.ok(d.title && d.text && d.touch, d.id);
});

test('every demo draws at any moment in both input modes', () => {
  for (const d of DEMOS) {
    for (const mode of ['keys', 'touch']) {
      for (let t = 0; t < 6; t += 0.37) {
        const ctx = fakeCtx();
        const pressed = drawDemo(ctx, d.id, 260, 170, t, mode);
        assert.ok(Array.isArray(pressed), `${d.id} ${mode}`);
        assert.ok(ctx.calls.includes('fill'), `${d.id} ${mode} t=${t}`);
      }
    }
  }
});

test('keys light up in time with the animation', () => {
  const seen = new Set();
  for (let t = 0; t < 3; t += 0.05) for (const k of drawDemo(fakeCtx(), 'twist', 260, 170, t, 'keys')) seen.add(k);
  assert.ok(seen.has('A') && seen.has('D'), [...seen].join(','));
  const rel = new Set();
  for (let t = 0; t < 3; t += 0.05) for (const k of drawDemo(fakeCtx(), 'release', 260, 170, t, 'keys')) rel.add(k);
  assert.ok(rel.has('W'));
});
