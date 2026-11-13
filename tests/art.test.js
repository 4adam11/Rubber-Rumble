import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERASERS, LEADS } from '../src/parts.js';
import { ERASER_ART, LEAD_ART, drawEraserTop, drawEraserSide, drawPencil, drawLeadTop, drawTopSide } from '../src/art.js';

// A canvas context stand-in that accepts every call and records them.
function fakeCtx() {
  const calls = [];
  const grad = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop.startsWith('create')) return () => grad;
      return (...args) => { calls.push(prop); };
    },
    set() { return true; },
  });
}

test('every eraser and lead has art', () => {
  for (const e of ERASERS) assert.ok(ERASER_ART[e.id], e.id);
  for (const l of LEADS) assert.ok(LEAD_ART[l.id], l.id);
});

test('drawing every part never throws and actually paints', () => {
  for (const e of ERASERS) {
    for (const fn of [(c) => drawEraserTop(c, e.id, 40), (c) => drawEraserSide(c, e.id, 120)]) {
      const ctx = fakeCtx();
      fn(ctx);
      assert.ok(ctx.calls.includes('fill'), e.id);
    }
  }
  for (const l of LEADS) {
    for (const fn of [(c) => drawPencil(c, l.id, 0, 0, 200, 16), (c) => drawLeadTop(c, l.id, 40, false), (c) => drawLeadTop(c, l.id, 40, true)]) {
      const ctx = fakeCtx();
      fn(ctx);
      assert.ok(ctx.calls.includes('fill'), l.id);
    }
  }
  const ctx = fakeCtx();
  drawTopSide(ctx, 'apsara-nondust', 'nataraj-hb', 120);
  assert.ok(ctx.calls.length > 20);
});

test('doms eraser is the neon hexagon', () => {
  assert.equal(ERASER_ART['doms-cubo'].shape, 'hex');
});
