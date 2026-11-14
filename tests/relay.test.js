// Relay (TURN) settings for friends mode: the game asks its own server (/api/turn) for the
// relay servers, and a missing or broken answer never breaks joining.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanIceServers, rtcConfig, hasRelay, STUN, RELAY_ENDPOINT } from '../src/relay.js';

const METERED = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:80', username: 'u1', credential: 'c1' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'u1', credential: 'c1' },
];
const okFetch = (body, seen = []) => async (url) => { seen.push(url); return { ok: true, json: async () => body }; };

test('no Metered key or address is in the game code', () => {
  const src = readFileSync(new URL('../src/relay.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /metered\.live|apiKey\s*[:=]\s*['"][0-9a-f]{20,}/i);
  assert.equal(RELAY_ENDPOINT, '/api/turn');
});

test('cleanIceServers keeps only stun/turn entries with string fields', () => {
  const out = cleanIceServers([
    ...METERED,
    { urls: 'http://example.com' },
    { urls: ['turn:a.example:3478', 'javascript:alert(1)'], username: 'x', credential: 'y' },
    { urls: 'turn:b.example:3478', username: 5, credential: 'y' },
    null, 'turn:c', 7,
  ]);
  assert.deepEqual(out, METERED);
  assert.deepEqual(cleanIceServers({ not: 'a list' }), []);
  assert.equal(cleanIceServers(Array.from({ length: 20 }, () => METERED[1])).length, 8);
});

test('rtcConfig adds the server\'s relay servers after Google STUN', async () => {
  const seen = [];
  const cfg = await rtcConfig({ fetch: okFetch({ iceServers: METERED }, seen) });
  assert.deepEqual(seen, ['/api/turn']);
  assert.deepEqual(cfg.iceServers, [...STUN, ...METERED]);
  assert.equal(cfg.iceTransportPolicy, undefined);
  assert.equal(hasRelay(cfg), true);
});

test('an empty answer (no relay set up) is STUN only', async () => {
  const cfg = await rtcConfig({ fetch: okFetch({ iceServers: [] }) });
  assert.deepEqual(cfg.iceServers, STUN);
  assert.equal(hasRelay(cfg), false);
});

test('a failing, slow or odd answer falls back to STUN only', async () => {
  const down = async () => { throw new Error('offline'); };
  const bad = async () => ({ ok: false, status: 404, json: async () => ({}) });
  const junk = okFetch({ error: 'nope' });
  const html = async () => ({ ok: true, json: async () => { throw new SyntaxError('not json'); } });
  const slow = () => new Promise(() => {});
  for (const fetch of [down, bad, junk, html, slow]) {
    const cfg = await rtcConfig({ fetch, timeout: 30 });
    assert.deepEqual(cfg.iceServers, STUN);
  }
});

test('relayOnly forces every connection through the relay (for testing)', async () => {
  const cfg = await rtcConfig({ fetch: okFetch({ iceServers: METERED }), relayOnly: true });
  assert.equal(cfg.iceTransportPolicy, 'relay');
});
