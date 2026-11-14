// Relay passes for Play with Friends, handed out by the server so Metered's keys never reach
// the browser or the code on GitHub. The keys live in Vercel environment settings:
//   METERED_APP         the app name (the part before .metered.live)
//   METERED_SECRET_KEY  Metered → Developers → Secret key. With it, the server makes passes that
//                       expire after 48 hours and makes a fresh one every 24 hours (Metered's
//                       recommended rotation), so a copied pass stops working within 2 days.
//   METERED_API_KEY     a fixed pass's API key: the fallback when the secret key is missing or
//                       refused (Metered's secret-key API may not be on every plan).
// Files starting with "_" in api/ are helpers, not web addresses of their own.

export const LABEL_PREFIX = 'rubber-rumble-';
export const LIFETIME_S = 48 * 3600;          // each pass works for 48 hours…
export const ROTATE_MS = 24 * 3600e3;         // …and a new one is made every 24 hours
export const SETTLE_MS = 3 * 60e3;            // a new pass takes up to 2 minutes to work everywhere
const CACHE_MS = 10 * 60e3;
const TIMEOUT_MS = 5000;

const bornAt = (c) => (c && typeof c.label === 'string' && c.label.startsWith(LABEL_PREFIX)
  ? Number(c.label.slice(LABEL_PREFIX.length)) : NaN);

// Which of our passes to hand out now, and whether it's time to make the next one.
export function pickCredential(list, now) {
  const ours = (Array.isArray(list) ? list : [])
    .filter((c) => c && !c.expired && typeof c.apiKey === 'string' && Number.isFinite(bornAt(c)))
    .sort((a, b) => bornAt(b) - bornAt(a));
  const settled = ours.filter((c) => now - bornAt(c) >= SETTLE_MS);
  return {
    use: settled[0] || ours[0] || null,
    create: !ours.length || now - bornAt(ours[0]) >= ROTATE_MS,
  };
}

// Only the game's own pages may ask (other websites' visitors are turned away). A script outside
// a browser can still fake these headers; the expiring passes are what limit that.
export function allowedRequest(headers, hosts) {
  const h = headers || {};
  const site = h['sec-fetch-site'];
  if (site) return site === 'same-origin';
  const from = h.origin || h.referer;
  if (!from) return false;
  try { return hosts.includes(new URL(from).host); } catch { return false; }
}

const isIce = (s) => s && typeof s === 'object' && [].concat(s.urls).every((u) => typeof u === 'string' && /^(stun|turns?):/.test(u));

export function createTurnService({ env = {}, fetch, now = Date.now }) {
  const app = env.METERED_APP;
  const base = app && /^[a-z0-9-]{1,63}$/i.test(app) ? `https://${app}.metered.live` : null;
  let cache = null, pending = null;

  async function call(path, opts = {}) {
    const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
    const res = await fetch(`${base}${path}`, { ...opts, signal });
    if (!res.ok) throw new Error(`metered ${res.status}`);
    return res.json();
  }
  async function serversFor(apiKey) {
    const list = await call(`/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`);
    if (!Array.isArray(list)) throw new Error('metered: not a list');
    return list.filter(isIce).slice(0, 8);
  }
  async function rotating() {
    const secret = encodeURIComponent(env.METERED_SECRET_KEY);
    const listed = await call(`/api/v2/turn/credentials?secretKey=${secret}`);
    const { use, create } = pickCredential(listed?.data, now());
    let chosen = use;
    if (create) {
      const made = await call(`/api/v1/turn/credential?secretKey=${secret}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiryInSeconds: LIFETIME_S, label: `${LABEL_PREFIX}${now()}` }),
      });
      chosen = chosen || made;
    }
    if (!chosen?.apiKey) throw new Error('metered: no pass');
    return serversFor(chosen.apiKey);
  }
  async function load() {
    if (!base) return [];
    let servers = [];
    if (env.METERED_SECRET_KEY) { try { servers = await rotating(); } catch { /* fall back */ } }
    if (!servers.length && env.METERED_API_KEY) { try { servers = await serversFor(env.METERED_API_KEY); } catch { /* no relay */ } }
    if (servers.length) cache = { at: now(), servers };
    return servers;
  }

  return {
    async iceServers() {
      if (cache && now() - cache.at < CACHE_MS) return cache.servers;
      if (!pending) pending = load().finally(() => { pending = null; });
      return pending;
    },
  };
}
