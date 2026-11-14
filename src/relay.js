// Relay (TURN) servers for Play with Friends. Devices first try to connect directly; mobile data
// and many school or office Wi-Fi networks block that, and then the game's messages go through a
// relay (Metered.ca) instead. The game asks its own server (/api/turn, see api/_turn.mjs) for the
// relay servers, so Metered's keys never appear in this code. If that fails (or when running
// locally without the server), friends mode still works, direct connections only.

export const RELAY_ENDPOINT = '/api/turn';
export const STUN = [{ urls: 'stun:stun.l.google.com:19302' }];
const MAX_SERVERS = 8;
const FETCH_TIMEOUT = 5000;

const isIceUrl = (u) => typeof u === 'string' && /^(stun|turns?):/.test(u);

// Only well-formed stun:/turn:/turns: entries get through to the browser.
export function cleanIceServers(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const s of list) {
    if (!s || typeof s !== 'object') continue;
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    if (!urls.length || !urls.every(isIceUrl)) continue;
    if (s.username !== undefined && typeof s.username !== 'string') continue;
    if (s.credential !== undefined && typeof s.credential !== 'string') continue;
    const e = { urls: s.urls };
    if (s.username !== undefined) e.username = s.username;
    if (s.credential !== undefined) e.credential = s.credential;
    out.push(e);
    if (out.length >= MAX_SERVERS) break;
  }
  return out;
}

export const hasRelay = (cfg) => (cfg?.iceServers || [])
  .some((s) => [].concat(s.urls).some((u) => /^turns?:/.test(u)));

// The connection settings for PeerJS. Never throws: without the relay it is STUN only.
// relayOnly sends everything through the relay, to test what a blocked network gets.
export async function rtcConfig({ endpoint = RELAY_ENDPOINT, fetch = globalThis.fetch, relayOnly = false, timeout = FETCH_TIMEOUT } = {}) {
  let relayServers = [];
  if (endpoint && fetch) {
    let timer;
    try {
      const res = await Promise.race([
        fetch(endpoint),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeout); }),
      ]);
      if (res?.ok) relayServers = cleanIceServers((await res.json())?.iceServers);
    } catch { /* relay unreachable: direct connections only */ }
    clearTimeout(timer);
  }
  const cfg = { iceServers: [...STUN, ...relayServers] };
  if (relayOnly) cfg.iceTransportPolicy = 'relay';
  return cfg;
}
