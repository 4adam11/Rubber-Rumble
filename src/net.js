// Friends-mode connections. The room creator's device ("host") opens a PeerJS peer named after
// the room code; friends connect to it directly (WebRTC). PeerJS's free public broker only
// introduces the devices. Messages are small JSON objects { t: type, v: PROTOCOL, ... }.
// createFakeNetwork() is an in-memory stand-in with the same shape, for tests.

export const PROTOCOL = 1;
export const PEER_PREFIX = 'rubber-rumble-';
const PEER_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js',
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
];
const CONNECT_TIMEOUT = 12000;
// A closed tab doesn't always close its connection, so everyone sends a tiny heartbeat
// and anyone silent for `timeout` ms counts as gone.
const BEAT = 2000, SILENCE = 9000;

// Load PeerJS only when someone opens Play with Friends (solo play never needs it).
let loading = null;
export function loadPeer() {
  if (globalThis.Peer) return Promise.resolve({ Peer: globalThis.Peer });
  if (loading) return loading;
  loading = (async () => {
    for (const url of PEER_URLS) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = url;
          s.async = true;
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
        if (globalThis.Peer) return { Peer: globalThis.Peer };
      } catch { /* try the next copy */ }
    }
    loading = null;
    throw new Error('load-failed');
  })();
  return loading;
}

function emitter() {
  const handlers = new Map();
  return {
    on(type, fn) { (handlers.get(type) || handlers.set(type, []).get(type)).push(fn); },
    emit(type, ...args) { for (const fn of handlers.get(type) || []) fn(...args); },
  };
}

const errType = (e) => e?.type || e?.message || 'error';
// Errors that mean the PeerJS service itself couldn't be reached (no internet, or it's blocked).
const OFFLINE_ERRORS = new Set(['network', 'server-error', 'socket-error', 'socket-closed']);
// `rtc` is the WebRTC settings (STUN and relay servers, see relay.js); without it PeerJS uses its own.
const peerOptions = (rtc) => (rtc ? { debug: 0, config: rtc } : { debug: 0 });

// Host a room. Resolves with a link once the code is registered; rejects 'code-taken' or 'offline'.
export function hostRoom(code, { Peer }, { beat = BEAT, timeout = SILENCE, rtc, connectTimeout = CONNECT_TIMEOUT } = {}) {
  return new Promise((resolve, reject) => {
    const peer = new Peer(PEER_PREFIX + code, peerOptions(rtc));
    const conns = new Map();
    const heard = new Map(), leaves = new Map();
    const pulse = setInterval(() => {
      const now = Date.now();
      for (const [id, c] of conns) {
        c.send({ t: 'hb', v: PROTOCOL });
        if (now - (heard.get(id) ?? now) > timeout) { leaves.get(id)?.(); try { c.close(); } catch { /* */ } }
      }
    }, beat);
    pulse.unref?.(); // never keep a test run (Node) alive just for heartbeats
    const msgs = emitter(), events = emitter();
    let opened = false;
    const fail = (why) => {
      if (opened) return;
      opened = true; // settled: nothing more to report
      clearInterval(pulse);
      clearTimeout(timer);
      try { peer.destroy(); } catch { /* */ }
      reject(new Error(why));
    };
    const timer = setTimeout(() => fail('offline'), connectTimeout);
    const link = {
      role: 'host', code, peerId: PEER_PREFIX + code,
      send(to, msg) {
        const m = { ...msg, v: PROTOCOL };
        if (to === '*') { for (const c of conns.values()) if (c.open !== false) c.send(m); }
        else conns.get(to)?.send(m);
      },
      kick(id) { conns.get(id)?.close(); },
      on: msgs.on,
      onPeer: (fn) => events.on('peer', fn),
      onLeave: (fn) => events.on('leave', fn),
      onError: (fn) => events.on('error', fn),
      close() { clearInterval(pulse); try { peer.destroy(); } catch { /* already gone */ } },
    };
    peer.on('open', () => { if (opened) return; opened = true; clearTimeout(timer); resolve(link); });
    peer.on('error', (e) => {
      const type = errType(e);
      if (!opened) fail(type === 'unavailable-id' ? 'code-taken' : 'offline');
      else events.emit('error', type);
    });
    peer.on('connection', (conn) => {
      const id = conn.peer;
      let gone = false;
      const leave = () => { if (gone) return; gone = true; conns.delete(id); heard.delete(id); leaves.delete(id); events.emit('leave', id); };
      leaves.set(id, leave);
      conn.on('open', () => { conns.set(id, conn); heard.set(id, Date.now()); events.emit('peer', id); });
      conn.on('data', (m) => {
        if (!m || typeof m !== 'object') return;
        heard.set(id, Date.now());
        if (m.t === 'hb') return;
        if (m.v !== PROTOCOL) { // a different version of the game: turn it away
          conn.send({ t: 'reject', reason: 'version', v: PROTOCOL });
          setTimeout(() => conn.close(), 50);
          return;
        }
        msgs.emit(m.t, m, id);
      });
      conn.on('close', leave);
      conn.on('error', leave);
    });
  });
}

// Join a friend's room. Rejects 'no-room' when nobody hosts that code, 'offline' when the PeerJS
// service can't be reached, or 'connect-failed' when the room was found but the devices couldn't link
// (a network blocking direct connections, with no working relay).
export function joinRoom(code, { Peer }, { protocol = PROTOCOL, beat = BEAT, timeout = SILENCE, rtc, connectTimeout = CONNECT_TIMEOUT } = {}) {
  return new Promise((resolve, reject) => {
    const peer = new Peer(undefined, peerOptions(rtc));
    const msgs = emitter(), events = emitter();
    let settled = false, conn = null, gone = false, heard = Date.now(), pulse = null, online = false;
    const fail = (why) => { if (settled) return; settled = true; clearTimeout(timer); try { peer.destroy(); } catch { /* */ } reject(new Error(why)); };
    const timer = setTimeout(() => fail(online ? 'connect-failed' : 'offline'), connectTimeout);
    const link = {
      role: 'guest', code,
      get peerId() { return peer.id; },
      send(msg) { if (conn) conn.send({ ...msg, v: protocol }); },
      on: msgs.on,
      onLeave: (fn) => events.on('leave', fn),
      close() { clearInterval(pulse); try { peer.destroy(); } catch { /* already gone */ } },
    };
    const leave = () => { if (gone || !settled) return; gone = true; clearInterval(pulse); events.emit('leave'); };
    peer.on('open', () => {
      online = true;
      conn = peer.connect(PEER_PREFIX + String(code).toUpperCase(), { reliable: true, serialization: 'json' });
      conn.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        heard = Date.now();
        pulse = setInterval(() => {
          conn.send({ t: 'hb', v: protocol });
          if (Date.now() - heard > timeout) { leave(); try { conn.close(); } catch { /* */ } }
        }, beat);
        pulse.unref?.();
        resolve(link);
      });
      conn.on('data', (m) => {
        if (!m || typeof m !== 'object') return;
        heard = Date.now();
        if (m.t !== 'hb') msgs.emit(m.t, m);
      });
      conn.on('close', leave);
      conn.on('error', leave);
    });
    peer.on('error', (e) => {
      const type = errType(e);
      if (!settled) fail(type === 'peer-unavailable' ? 'no-room' : !online && OFFLINE_ERRORS.has(type) ? 'offline' : 'connect-failed');
      else if (type !== 'peer-unavailable') leave();
    });
    peer.on('disconnected', () => { /* lost the broker only; the direct link may still be fine */ });
  });
}

// ---------- in-memory stand-in for tests ----------
// offline: 'silent' (the service never answers) or 'error' (it fails with a network error).
export function createFakeNetwork({ offline = null } = {}) {
  const peers = new Map(), options = new Map();
  let n = 0, blocked = false;
  const later = (fn) => setTimeout(fn, 0);

  class FakeConn {
    constructor(peerId) { this.peer = peerId; this.other = null; this.open = false; this.closed = false; const e = emitter(); this.on = e.on; this.emit = e.emit; }
    send(msg) {
      if (this.closed || this.silent || !this.other) return;
      const copy = JSON.parse(JSON.stringify(msg));
      later(() => { if (!this.other.closed) this.other.emit('data', copy); });
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      later(() => this.emit('close'));
      if (this.other && !this.other.closed) this.other.close();
    }
  }

  class FakePeer {
    constructor(id, opts) {
      this.id = id || `guest-${++n}`;
      this.conns = [];
      options.set(this.id, opts || {});
      const e = emitter(); this.on = e.on; this.emit = e.emit;
      later(() => {
        if (offline === 'silent') return;
        if (offline === 'error') { this.emit('error', { type: 'network' }); return; }
        if (peers.has(this.id)) { this.emit('error', { type: 'unavailable-id' }); return; }
        peers.set(this.id, this);
        this.emit('open', this.id);
      });
    }
    connect(id) {
      const mine = new FakeConn(id);
      this.conns.push(mine);
      later(() => {
        const target = peers.get(id);
        if (!target) { this.emit('error', { type: 'peer-unavailable' }); return; }
        const theirs = new FakeConn(this.id);
        target.conns.push(theirs);
        mine.other = theirs; theirs.other = mine;
        target.emit('connection', theirs);
        if (blocked) return; // the networks won't let the two devices link
        later(() => { mine.open = theirs.open = true; theirs.emit('open'); mine.emit('open'); });
      });
      return mine;
    }
    destroy() {
      peers.delete(this.id);
      for (const c of this.conns) c.close();
    }
  }
  return {
    Peer: FakePeer,
    // what the game passed to PeerJS for this peer id
    options: (id) => options.get(id),
    // from now on, devices find each other but can't link (like mobile data with no relay)
    block() { blocked = true; },
    // the tab disappears: nothing more is sent or received, and nobody is told
    vanish(id) {
      const p = peers.get(id);
      if (!p) return;
      peers.delete(id);
      for (const c of p.conns) { c.silent = true; if (c.other) c.other.silent = true; }
    },
  };
}
