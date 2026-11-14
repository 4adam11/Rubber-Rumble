// Each device turns the bowl so its own top starts nearest the player; HUD and intro handle 3–4 players.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, arenaToScreen, screenToArena, screenToArenaVec } from '../src/layout.js';
import { seatAngle, LAUNCH } from '../src/launch.js';
import { viewFor } from '../src/layout.js';
import { createHud } from '../src/hud.js';
import { drawIntro } from '../src/intro.js';
import { PLAYER_COLORS } from '../src/render.js';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('screen ↔ arena round trip with the bowl turned', () => {
  const L = computeLayout(375, 812, 1.1);
  for (const [x, y] of [[0.3, -0.2], [-0.7, 0.5], [0, 0.9]]) {
    const p = arenaToScreen(L, x, y);
    const a = screenToArena(L, p.x, p.y);
    assert.ok(close(a.x, x) && close(a.y, y), `${x},${y} → ${a.x},${a.y}`);
  }
  const v = screenToArenaVec(L, 10, 0);
  const back = arenaToScreen(L, v.x, v.y);
  assert.ok(close(back.x - L.cx, 10) && close(back.y - L.cy, 0));
});

test('with no turn the mapping is exactly as before', () => {
  const a = computeLayout(375, 812), b = computeLayout(375, 812, 0);
  assert.deepEqual(arenaToScreen(a, 0.4, -0.3), arenaToScreen(b, 0.4, -0.3));
  assert.equal(viewFor(0, 2), 0);
});

test("every seat's launch spot lands bottom-centre on a phone and left-middle on a laptop", () => {
  for (const n of [2, 3, 4]) {
    for (let k = 0; k < n; k++) {
      const h = seatAngle(k, n), r = LAUNCH.START_RADIUS;
      const P = computeLayout(375, 812, viewFor(k, n));
      const p = arenaToScreen(P, r * Math.cos(h), r * Math.sin(h));
      assert.ok(close(p.x, P.cx, 1e-6) && p.y > P.cy, `portrait seat ${k}/${n}`);
      const W = computeLayout(1280, 720, viewFor(k, n));
      const q = arenaToScreen(W, r * Math.cos(h), r * Math.sin(h));
      assert.ok(close(q.y, W.cy, 1e-6) && q.x < W.cx, `landscape seat ${k}/${n}`);
    }
  }
});

function fakeCtx() {
  const calls = [];
  const grad = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s) => ({ width: String(s).length * 7 });
      if (prop.startsWith('create')) return () => grad;
      return (...args) => { calls.push([prop, ...args]); };
    },
    set() { return true; },
  });
}

const player = (k) => ({
  name: `P${k}`, color: PLAYER_COLORS[k], eraserId: 'apsara-nondust', health: 0.5 + k * 0.1, points: k, target: 4,
  ability: { kind: 'dash', unlocked: false, used: false, key: '' }, leadId: 'nataraj-hb', subtitle: 'x',
});

test('four seat colours, all different', () => {
  assert.equal(PLAYER_COLORS.length, 4);
  assert.equal(new Set(PLAYER_COLORS).size, 4);
});

test('the health bars draw 3 and 4 players on a phone and a laptop', () => {
  for (const n of [3, 4]) {
    for (const [w, h] of [[360, 740], [1280, 720]]) {
      const hud = createHud();
      hud.update(0.1, Array.from({ length: n }, (_, k) => 0.5 + k * 0.1));
      const ctx = fakeCtx();
      hud.draw(ctx, computeLayout(w, h), { players: Array.from({ length: n }, (_, k) => player(k)), time: 30 }, 1);
      const names = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
      for (let k = 0; k < n; k++) assert.ok(names.includes(`P${k}`), `${n} players @${w}: P${k} named`);
      // every label sits on the screen
      for (const c of ctx.calls.filter((c) => c[0] === 'fillText')) assert.ok(c[2] >= 0 && c[2] <= w, `${n}@${w} text ${c[1]} at ${c[2]}`);
    }
  }
});

test('the VS intro shows every fighter when there are 4', () => {
  const ctx = fakeCtx();
  drawIntro(ctx, computeLayout(375, 812), 0.5, { players: [0, 1, 2, 3].map(player), round: 'Round 1', arenaName: 'Steel Thali', arenaLevel: 'Basic' }, 1);
  const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
  for (let k = 0; k < 4; k++) assert.ok(texts.includes(`P${k}`.toUpperCase()), `P${k} shown`);
});
