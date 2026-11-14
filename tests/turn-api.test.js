// The server side of the relay: /api/turn hands out Metered relay servers without the key
// ever reaching the browser, and (with the secret key) rotates passes that expire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTurnService, pickCredential, allowedRequest, LABEL_PREFIX, ROTATE_MS, LIFETIME_S, SETTLE_MS } from '../api/_turn.mjs';

const ICE = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:80', username: 'u', credential: 'p' },
];
const HOUR = 3600e3;

// A stand-in for Metered's REST API.
function fakeMetered({ creds = [], freePlan = false } = {}) {
  const calls = [];
  let n = 0;
  const reply = (status, body) => ({ ok: status < 300, status, json: async () => body });
  const fetch = async (url, opts = {}) => {
    const u = new URL(url);
    calls.push(`${opts.method || 'GET'} ${u.pathname}`);
    if (u.pathname === '/api/v1/turn/credentials') {
      const key = u.searchParams.get('apiKey');
      return key && (key === 'static-key' || creds.some((c) => c.apiKey === key)) ? reply(200, ICE) : reply(401, { error: 'Invalid API Key' });
    }
    if (u.searchParams.get('secretKey') !== 'secret') return reply(401, { message: 'bad secret' });
    if (freePlan) return reply(400, { message: 'api not available under free plan' });
    if (u.pathname === '/api/v2/turn/credentials') return reply(200, { data: creds.filter((c) => !c.expired), pagination: {} });
    if (u.pathname === '/api/v1/turn/credential' && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      const c = { username: `n${++n}`, password: 'x', apiKey: `key-${n}`, expiryInSeconds: body.expiryInSeconds, label: body.label, expired: false };
      creds.push(c);
      return reply(200, c);
    }
    return reply(404, {});
  };
  return { fetch, calls, creds };
}

test('pickCredential takes the newest settled pass and says when a new one is due', () => {
  const now = 100 * HOUR;
  const mk = (age) => ({ apiKey: `a${age}`, label: `${LABEL_PREFIX}${now - age}`, expired: false });
  // a 30-hour-old pass and a 2-hour-old pass: use the newer, nothing to create yet
  assert.deepEqual(pickCredential([mk(30 * HOUR), mk(2 * HOUR)], now), { use: mk(2 * HOUR), create: false });
  // only a 25-hour-old pass: use it, but it's time to make the next one
  assert.deepEqual(pickCredential([mk(25 * HOUR)], now), { use: mk(25 * HOUR), create: true });
  // a brand-new pass is still spreading through Metered's network: keep using the older one
  assert.deepEqual(pickCredential([mk(25 * HOUR), mk(SETTLE_MS / 2)], now), { use: mk(25 * HOUR), create: false });
  // nothing at all: create one (and use it as soon as it exists)
  assert.deepEqual(pickCredential([], now), { use: null, create: true });
  // passes that aren't ours (other labels) are ignored
  assert.deepEqual(pickCredential([{ apiKey: 'x', label: 'someone-else' }], now), { use: null, create: true });
});

test('with only the API key, the server hands out the relay servers', async () => {
  const m = fakeMetered();
  const svc = createTurnService({ env: { METERED_APP: 'rr', METERED_API_KEY: 'static-key' }, fetch: m.fetch, now: () => 0 });
  assert.deepEqual(await svc.iceServers(), ICE);
});

test('answers are reused for a while instead of asking Metered every time', async () => {
  const m = fakeMetered();
  let t = 0;
  const svc = createTurnService({ env: { METERED_APP: 'rr', METERED_API_KEY: 'static-key' }, fetch: m.fetch, now: () => t });
  await svc.iceServers();
  t += 60e3;
  await svc.iceServers();
  assert.equal(m.calls.length, 1);
  t += 20 * 60e3;
  await svc.iceServers();
  assert.equal(m.calls.length, 2);
});

test('with the secret key, the first request creates an expiring pass and uses it', async () => {
  const m = fakeMetered();
  const svc = createTurnService({ env: { METERED_APP: 'rr', METERED_SECRET_KEY: 'secret' }, fetch: m.fetch, now: () => 5 * HOUR });
  assert.deepEqual(await svc.iceServers(), ICE);
  assert.equal(m.creds.length, 1);
  assert.equal(m.creds[0].expiryInSeconds, LIFETIME_S);
  assert.equal(m.creds[0].label, `${LABEL_PREFIX}${5 * HOUR}`);
});

test('with the secret key, a day-old pass gets a successor while still being handed out', async () => {
  const now = 50 * HOUR;
  const old = { username: 'o', password: 'p', apiKey: 'key-old', label: `${LABEL_PREFIX}${now - ROTATE_MS - HOUR}`, expired: false };
  const m = fakeMetered({ creds: [old] });
  const svc = createTurnService({ env: { METERED_APP: 'rr', METERED_SECRET_KEY: 'secret' }, fetch: m.fetch, now: () => now });
  assert.deepEqual(await svc.iceServers(), ICE);
  assert.equal(m.creds.length, 2, 'a new pass was created');
  assert.ok(m.calls.includes('GET /api/v1/turn/credentials'));
  // the relay servers came from the old (settled) pass, not the brand-new one
  assert.equal(m.calls.filter((c) => c === 'GET /api/v1/turn/credentials').length, 1);
});

test('if the secret-key API is refused (free plan), it falls back to the API key', async () => {
  const m = fakeMetered({ freePlan: true });
  const svc = createTurnService({ env: { METERED_APP: 'rr', METERED_SECRET_KEY: 'secret', METERED_API_KEY: 'static-key' }, fetch: m.fetch, now: () => 0 });
  assert.deepEqual(await svc.iceServers(), ICE);
});

test('with nothing configured, or Metered down, the answer is an empty list', async () => {
  const none = createTurnService({ env: {}, fetch: async () => { throw new Error('should not be called'); }, now: () => 0 });
  assert.deepEqual(await none.iceServers(), []);
  const down = createTurnService({ env: { METERED_APP: 'rr', METERED_API_KEY: 'static-key' }, fetch: async () => { throw new Error('down'); }, now: () => 0 });
  assert.deepEqual(await down.iceServers(), []);
});

test('only the game itself may ask: other websites are turned away', () => {
  const hosts = ['rubber-rumble.vercel.app'];
  assert.equal(allowedRequest({ 'sec-fetch-site': 'same-origin' }, hosts), true);
  assert.equal(allowedRequest({ origin: 'https://rubber-rumble.vercel.app' }, hosts), true);
  assert.equal(allowedRequest({ referer: 'https://rubber-rumble.vercel.app/?room=RR-7K2Q' }, hosts), true);
  assert.equal(allowedRequest({ 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' }, hosts), false);
  assert.equal(allowedRequest({ origin: 'https://evil.example' }, hosts), false);
  assert.equal(allowedRequest({ referer: 'https://evil.example/page' }, hosts), false);
  assert.equal(allowedRequest({}, hosts), false, 'no sign of coming from the game');
});
