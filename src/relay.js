// Relay (TURN) servers for Play with Friends. Devices first try to connect directly; mobile data
// and many school or office Wi-Fi networks block that, and then the game's messages go through a
// relay instead. The relay is Metered.ca: the game fetches short-lived relay passes with the key
// below. That key is made to sit in a web page (it can only fetch relay passes for this app).
// Leave it empty and friends mode still works, direct connections only.

export const RELAY = {
  app: 'gamessssss', // the Metered app name: the part before .metered.live
  apiKey: '44f5e026291edc8b1cf59f2d29ca83c9a403', // Metered dashboard → TURN credentials → API key
};

export const STUN = [{ urls: 'stun:stun.l.google.com:19302' }];
const MAX_SERVERS = 8;
const FETCH_TIMEOUT = 5000;

export function relayUrl({ app, apiKey } = {}) {
  if (!app || !apiKey || !/^[a-z0-9-]{1,63}$/i.test(app)) return null;
  return `https://${app}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;
}

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
export async function rtcConfig({ relay = RELAY, fetch = globalThis.fetch, relayOnly = false, timeout = FETCH_TIMEOUT } = {}) {
  let relayServers = [];
  const url = relayUrl(relay);
  if (url && fetch) {
    let timer;
    try {
      const res = await Promise.race([
        fetch(url),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeout); }),
      ]);
      if (res?.ok) relayServers = cleanIceServers(await res.json());
    } catch { /* relay unreachable: direct connections only */ }
    clearTimeout(timer);
  }
  const cfg = { iceServers: [...STUN, ...relayServers] };
  if (relayOnly) cfg.iceTransportPolicy = 'relay';
  return cfg;
}
