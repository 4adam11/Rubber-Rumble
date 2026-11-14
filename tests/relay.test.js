// Relay (TURN) settings for friends mode: fetched from Metered.ca with the game's key,
// and never allowed to break joining when the relay can't be reached.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relayUrl, cleanIceServers, rtcConfig, hasRelay, STUN } from '../src/relay.js';

const METERED = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:80', username: 'u1', credential: 'c1' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'u1', credential: 'c1' },
];
const okFetch = (body, seen = []) => async (url) => { seen.push(url); return { ok: true, json: async () => body }; };

test('relayUrl builds the Metered credentials address, or null without a full key', () => {
  assert.equal(relayUrl({ app: 'rubber-rumble', apiKey: 'k 1/2' }),
    'https://rubber-rumble.metered.live/api/v1/turn/credentials?apiKey=k%201%2F2');
  assert.equal(relayUrl({ app: '', apiKey: 'k' }), null);
  assert.equal(relayUrl({ app: 'x', apiKey: '' }), null);
  assert.equal(relayUrl({ app: 'evil.com/x?', apiKey: 'k' }), null, 'app must be a plain subdomain name');
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

test('with a key, rtcConfig adds the relay servers after Google STUN', async () => {
  const seen = [];
  const cfg = await rtcConfig({ relay: { app: 'rr', apiKey: 'key' }, fetch: okFetch(METERED, seen) });
  assert.deepEqual(cfg.iceServers, [...STUN, ...METERED]);
  assert.equal(cfg.iceTransportPolicy, undefined);
  assert.equal(seen.length, 1);
  assert.equal(hasRelay(cfg), true);
});

test('without a key, rtcConfig is STUN only and fetches nothing', async () => {
  const seen = [];
  const cfg = await rtcConfig({ relay: { app: '', apiKey: '' }, fetch: okFetch(METERED, seen) });
  assert.deepEqual(cfg.iceServers, STUN);
  assert.equal(seen.length, 0);
  assert.equal(hasRelay(cfg), false);
});

test('a failing, slow or odd relay answer falls back to STUN only', async () => {
  const relay = { app: 'rr', apiKey: 'key' };
  const down = async () => { throw new Error('offline'); };
  const bad = async () => ({ ok: false, status: 401, json: async () => ({ error: 'bad key' }) });
  const junk = okFetch({ error: 'nope' });
  const slow = () => new Promise(() => {});
  for (const fetch of [down, bad, junk, slow]) {
    const cfg = await rtcConfig({ relay, fetch, timeout: 30 });
    assert.deepEqual(cfg.iceServers, STUN);
  }
});

test('relayOnly forces every connection through the relay (for testing)', async () => {
  const cfg = await rtcConfig({ relay: { app: 'rr', apiKey: 'key' }, fetch: okFetch(METERED), relayOnly: true });
  assert.equal(cfg.iceTransportPolicy, 'relay');
});
