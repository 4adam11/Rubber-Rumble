import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerForPoint, createTouchTracker, specialButton } from '../src/input.js';

test('playerForPoint', () => {
  assert.equal(playerForPoint(100, 300, 812, 375, 2), 0);
  assert.equal(playerForPoint(700, 100, 812, 375, 2), 1);
  assert.equal(playerForPoint(100, 700, 375, 812, 2), 0);
  assert.equal(playerForPoint(100, 100, 375, 812, 2), 1);
  assert.equal(playerForPoint(700, 100, 812, 375, 1), 0);
  assert.equal(playerForPoint(100, 100, 375, 812, 1), 0);
});

test('touch keeps its player across the midline', () => {
  const t = createTouchTracker();
  t.down(1, 100, 200, 0);
  t.move(1, 700, 200);
  assert.equal(t.touchesFor(0).length, 1);
  assert.equal(t.touchesFor(0)[0].x, 700);
  assert.equal(t.touchesFor(1).length, 0);
  t.up(1);
  assert.equal(t.touchesFor(0).length, 0);
});

test('third touch ignored', () => {
  const t = createTouchTracker();
  t.down(1, 10, 10, 0);
  t.down(2, 20, 20, 0);
  t.down(3, 30, 30, 0);
  assert.equal(t.touchesFor(0).length, 2);
  t.move(3, 50, 50); // ignored id must not crash
  t.up(3);
  assert.equal(t.touchesFor(0).length, 2);
});

test('special buttons sit on their own side, on screen', () => {
  for (const [w, h] of [[812, 375], [375, 812], [1440, 900]]) {
    for (const players of [1, 2]) {
      for (let i = 0; i < players; i++) {
        const b = specialButton(i, w, h, players);
        assert.ok(b.r >= 22, 'touch target at least 44 px');
        assert.ok(b.x - b.r >= 0 && b.x + b.r <= w && b.y - b.r >= 0 && b.y + b.r <= h, `${w}x${h} p${i}`);
        if (players === 2) assert.equal(playerForPoint(b.x, b.y, w, h, 2), i);
      }
    }
  }
});
