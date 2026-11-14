// Friends mode, host ↔ guest helpers. Pure: no DOM, no network.
// The host runs the battle and sends snapshots; guests draw them ~100 ms behind, smoothly.
import { LAUNCH } from './launch.js';

export const SNAP_HZ = 20;
export const INTENT_HZ = 30;
export const LAUNCH_HZ = 15;
export const INTERP_DELAY = 0.1;

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const FLAGS = ['leadSnapped', 'crumbled', 'planted', 'dashArmed', 'unlocked', 'specialUsed', 'out', 'inZone'];

// ---------- battle snapshots ----------
export function packWorld(w) {
  return {
    time: r4(w.time),
    over: !!w.over,
    tops: w.tops.map((t) => ({
      p: [r4(t.x), r4(t.y), r4(t.vx), r4(t.vy), r4(t.angle), Math.round(t.rpm * 10) / 10, r4(t.wobble)],
      f: FLAGS.reduce((bits, k, n) => bits | (t[k] ? 1 << n : 0), 0),
      d: t.spinDir, s: t.shieldHits || 0, k: t.specialKind, o: t.outAt ?? null,
    })),
    clash: w.clash ? { t: r4(w.clash.t), pair: w.clash.pair, mash: w.clash.mash, x: r4(w.clash.x), y: r4(w.clash.y) } : null,
    zones: (w.zones || []).filter((z) => z.owner >= 0).map((z) => [r4(z.x), r4(z.y), z.r, z.owner, r4(z.until)]),
  };
}

// A world-shaped object the renderer can draw, fed by snapshots instead of physics.
export function createMirror(specs, arena = null) {
  return {
    mirror: true, arena, time: 0, over: false, clash: null, events: [], snaps: [],
    zones: (arena?.zones || []).map((z) => ({ ...z, owner: -1, until: Infinity })),
    bumpers: (arena?.bumpers || []).map((b) => ({ ...b })),
    baseZones: (arena?.zones || []).map((z) => ({ ...z, owner: -1, until: Infinity })),
    tops: specs.map((spec, i) => ({
      spec, index: i, x: 0, y: 0, vx: 0, vy: 0, angle: 0, rpm: spec.maxRPM, wobble: 0, spinDir: 1,
      shieldHits: 0, specialKind: null, outAt: null, ...Object.fromEntries(FLAGS.map((k) => [k, false])),
    })),
  };
}

export function pushSnapshot(m, snap, at) {
  m.snaps.push({ at, snap });
  if (m.snaps.length > 4) m.snaps.shift();
}

// Set the mirror to how the battle looked INTERP_DELAY ago (never ahead of the newest snapshot).
export function interpolate(m, now) {
  if (!m.snaps.length) return;
  const rt = now - INTERP_DELAY;
  let a = m.snaps[0], b = m.snaps[m.snaps.length - 1];
  for (let k = 0; k < m.snaps.length - 1; k++) {
    if (m.snaps[k].at <= rt && m.snaps[k + 1].at >= rt) { a = m.snaps[k]; b = m.snaps[k + 1]; break; }
  }
  if (rt >= b.at) a = b;
  const span = b.at - a.at;
  const k = span > 1e-9 ? Math.max(0, Math.min(1, (rt - a.at) / span)) : 1;
  const lerp = (x, y) => x + (y - x) * k;
  const sa = a.snap, sb = b.snap;
  m.time = lerp(sa.time, sb.time);
  m.over = sb.over;
  m.clash = sb.clash;
  m.zones = [...m.baseZones, ...sb.zones.map(([x, y, r, owner, until]) => ({ x, y, r, owner, until, drag: 3.2, kind: 'crumbs' }))];
  sb.tops.forEach((tb, i) => {
    const t = m.tops[i];
    if (!t) return;
    const ta = sa.tops[i] || tb;
    [t.x, t.y, t.vx, t.vy, t.angle, t.rpm, t.wobble] = tb.p.map((v, n) => lerp(ta.p[n], v));
    FLAGS.forEach((key, n) => { t[key] = !!(tb.f & (1 << n)); });
    t.spinDir = tb.d;
    t.shieldHits = tb.s;
    t.specialKind = tb.k;
    t.outAt = tb.o;
  });
}

// ---------- launches ----------
const ORDER = { place: 0, twist: 1, done: 2 };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const inSlot = (s, angle) => s.home + Math.max(-s.range, Math.min(s.range, wrap(angle - s.home)));

export const launchView = (s) => ({ phase: s.phase, rimAngle: r4(s.rimAngle), rpm: Math.round(s.rpm), spinDir: s.spinDir, t: r4(s.t) });

// Another device's launch: take its state, but never step backwards and never leave its slot.
export function mergeRemoteLaunch(s, msg) {
  if (!msg || s.phase === 'done') return;
  if (msg.phase in ORDER && ORDER[msg.phase] < ORDER[s.phase]) return; // a stale, older message
  if (msg.phase in ORDER && ORDER[msg.phase] > ORDER[s.phase] && msg.phase !== 'done') s.phase = msg.phase;
  if (Number.isFinite(msg.rimAngle)) s.rimAngle = inSlot(s, msg.rimAngle);
  if (Number.isFinite(msg.rpm)) s.rpm = Math.max(0, Math.min(s.spec.maxRPM, msg.rpm));
  if (msg.spinDir === 1 || msg.spinDir === -1) s.spinDir = msg.spinDir;
  if (Number.isFinite(msg.t)) s.t = msg.t;
}

export const launchDeadline = (s) => LAUNCH.PLACE_TIME + s.twistTime + 1.5;

// The friend went quiet: launch with what they had, a little wobbly.
export function finishLaunchNow(s) {
  if (s.phase === 'done') return;
  s.phase = 'done';
  s.result = {
    x: LAUNCH.START_RADIUS * Math.cos(s.rimAngle), y: LAUNCH.START_RADIUS * Math.sin(s.rimAngle),
    rpm: s.rpm, wobble: 0.35, perfect: false, spinDir: s.spinDir || 1,
  };
}

// ---------- cleaning what comes off the wire ----------
const num = (v) => (Number.isFinite(v) ? v : 0);

export function cleanIntent(msg) {
  let x = num(msg?.steer?.x), y = num(msg?.steer?.y);
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  return { steer: { x, y }, special: num(msg?.sp) > 0, mash: Math.max(0, Math.min(20, Math.floor(num(msg?.taps)))) };
}

export function cleanLaunchResult(s, r) {
  const angle = inSlot(s, Math.atan2(num(r?.y), num(r?.x)));
  return {
    x: LAUNCH.START_RADIUS * Math.cos(angle), y: LAUNCH.START_RADIUS * Math.sin(angle),
    rpm: Math.max(0, Math.min(s.spec.maxRPM * 1.05, num(r?.rpm))),
    wobble: Math.max(0, Math.min(1, num(r?.wobble))),
    perfect: !!r?.perfect,
    spinDir: r?.spinDir === -1 ? -1 : 1,
  };
}
