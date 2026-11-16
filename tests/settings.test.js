// Saved settings: the one-time note for players who had the game before the earned kit, and Rising.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, saveSettings, defaultSettings } from '../src/settings.js';

function withStorage(initial, fn) {
  const data = new Map(initial ? [['rubber-rumble:v1', JSON.stringify(initial)]] : []);
  const before = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
  try { return fn(data); } finally { globalThis.localStorage = before; }
}

test('a brand-new player gets no "what changed" note', () => {
  withStorage(null, () => {
    const s = loadSettings();
    assert.equal(s.kitNote, false);
    assert.equal(s.kitVersion, 1);
  });
});

test('a player with a save from before the earned kit gets the note once', () => {
  withStorage({ muted: true, tournament: { rung: 2, champion: false } }, (data) => {
    const s = loadSettings();
    assert.equal(s.kitNote, true);
    assert.deepEqual(s.tournament, { rung: 2, champion: false });
    s.kitNote = false;
    saveSettings(s);
    assert.equal(JSON.parse(data.get('rubber-rumble:v1')).kitVersion, 1);
    assert.equal(loadSettings().kitNote, false, 'not shown again');
  });
});
test('Rising starts at level 2 and bad saved values are repaired', () => {
  assert.deepEqual(defaultSettings().rising, { level: 2, streak: 0 });
  withStorage({ kitVersion: 1, rising: { level: 5, streak: 1 } }, () => assert.deepEqual(loadSettings().rising, { level: 5, streak: 1 }));
  withStorage({ kitVersion: 1, rising: { level: 99, streak: 'x' } }, () => assert.deepEqual(loadSettings().rising, { level: 7, streak: 0 }));
  withStorage({ kitVersion: 1, rising: 'nonsense' }, () => assert.deepEqual(loadSettings().rising, { level: 2, streak: 0 }));
});
