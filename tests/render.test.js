import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, arenaToScreen, screenToArenaVec, THALI_OUTER } from '../src/layout.js';

test('layout fits', () => {
  for (const [w, h] of [[375, 812], [812, 375], [1440, 900], [360, 640]]) {
    const L = computeLayout(w, h);
    const d = 2 * THALI_OUTER * L.scale;
    assert.equal(L.rotate, h > w, `${w}x${h}`);
    assert.ok(d <= Math.min(w, h) - 32 + 1e-9, `${w}x${h} d=${d}`);
    if (L.rotate) assert.ok(d <= h - 32 - 120 + 1e-9);
    assert.ok(d > Math.min(w, h) * 0.5, `${w}x${h} thali too small: ${d}`);
  }
});

test('players sit on their own side', () => {
  const land = computeLayout(812, 375);
  assert.ok(arenaToScreen(land, -0.8, 0).x < land.cx);
  const port = computeLayout(375, 812);
  assert.ok(arenaToScreen(port, -0.8, 0).y > port.cy); // player 0 at the bottom
  assert.ok(arenaToScreen(port, 0.8, 0).y < port.cy);
});

test('transform round-trip', () => {
  for (const [w, h] of [[812, 375], [375, 812]]) {
    const L = computeLayout(w, h);
    const a = arenaToScreen(L, 0, 0);
    const b = arenaToScreen(L, 0.3, -0.2);
    const v = screenToArenaVec(L, b.x - a.x, b.y - a.y);
    assert.ok(Math.abs(v.x - 0.3) < 1e-9 && Math.abs(v.y + 0.2) < 1e-9, JSON.stringify(v));
  }
});
