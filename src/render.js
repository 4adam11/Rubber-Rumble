// Canvas drawing: arena, tops, effects, health bars, intro and banners.
import { computeLayout, arenaToScreen, screenToArenaVec, THALI_OUTER } from './layout.js';
import { LAUNCH, ringSize } from './launch.js';
import { drawEraserTop, drawLeadTop, ERASER_ART } from './art.js';
import { paintDesk, paintArena, drawCrumbs } from './arena-art.js';
import { createHud } from './hud.js';
import { drawIntro as paintIntro } from './intro.js';
import { ABILITIES } from './abilities.js';
import { CLASH } from './physics.js';

export { computeLayout, arenaToScreen, screenToArenaVec };

export const PLAYER_COLORS = ['#2f5fd0', '#d8432f'];
const HAND = '"Kalam", "Comic Sans MS", cursive';
const PAINT = ['#d43c2f', '#f2c230', '#2b2b2b', '#2f8f4e', '#2f5fd0'];

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};
const rand = (a, b) => a + Math.random() * (b - a);

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v + amt * 255))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let L = computeLayout(canvas.clientWidth || 800, canvas.clientHeight || 600);
  let dpr = 1;
  let bg = null;
  let arenaId = 'thali';
  let clock = 0;
  let shake = 0;
  let flash = 0;
  const particles = [];
  const banners = [];
  const waves = [];
  const stamps = [];
  const trails = [[], []];
  let trailWorld = null;
  const cam = { zoom: 1, target: 1, fx: 0, fy: 0, hold: 0 };
  const slow = { scale: 1, left: 0 };
  const hud = createHud();
  const self = { hud };

  function repaint() {
    const w = L.width, h = L.height;
    bg = document.createElement('canvas');
    bg.width = Math.round(w * dpr);
    bg.height = Math.round(h * dpr);
    const g = bg.getContext('2d');
    g.scale(dpr, dpr);
    paintDesk(g, w, h);
    paintArena(g, L, arenaId);
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    L = computeLayout(w, h);
    self.layout = L;
    repaint();
  }

  function setArena(id) {
    if (id === arenaId && bg) return;
    arenaId = id;
    repaint();
  }

  // ---------- time ----------
  function update(dt) {
    clock += dt;
    shake = Math.max(0, shake - dt * 30);
    flash = Math.max(0, flash - dt * 2.5);
    if (slow.left > 0) { slow.left -= dt; if (slow.left <= 0) slow.scale = 1; }
    if (cam.hold > 0) cam.hold -= dt; else cam.target = 1;
    cam.zoom += (cam.target - cam.zoom) * Math.min(1, dt * 7);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.g) p.vy += p.g * dt;
      p.vx *= Math.exp(-(p.drag ?? 4) * dt); p.vy *= Math.exp(-(p.drag ?? 4) * dt);
      p.rot += p.vr * dt;
    }
    for (let i = waves.length - 1; i >= 0; i--) { waves[i].t += dt; if (waves[i].t >= waves[i].life) waves.splice(i, 1); }
    for (let i = banners.length - 1; i >= 0; i--) { banners[i].t += dt; if (banners[i].t >= banners[i].life) banners.splice(i, 1); }
    for (let i = stamps.length - 1; i >= 0; i--) { stamps[i].t += dt; if (stamps[i].t >= stamps[i].life) stamps.splice(i, 1); }
  }

  function slowmo(scale, seconds) {
    if (reducedMotion()) return;
    slow.scale = Math.min(slow.scale, scale);
    slow.left = Math.max(slow.left, seconds);
  }

  // ---------- effects ----------
  function burst(sx, sy, count, big) {
    const n = Math.round(count * (reducedMotion() ? 0.3 : 1));
    for (let k = 0; k < n; k++) {
      const a = rand(0, Math.PI * 2), sp = rand(60, big ? 420 : 260);
      const dust = Math.random() < 0.4;
      particles.push({
        kind: dust ? 'dust' : 'shaving', x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.35, 0.7), rot: rand(0, 6), vr: rand(-12, 12),
        size: dust ? rand(1.2, 2.6) : rand(4, big ? 11 : 8), paint: PAINT[Math.floor(Math.random() * PAINT.length)],
      });
    }
  }

  function sparks(sx, sy, count, color) {
    for (let k = 0; k < count; k++) {
      const a = rand(0, Math.PI * 2), sp = rand(150, 420);
      particles.push({ kind: 'spark', x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.15, 0.35), rot: a, vr: 0, size: rand(6, 14), color, drag: 6 });
    }
  }

  function shards(sx, sy, color) {
    for (let k = 0; k < 18; k++) {
      const a = rand(0, Math.PI * 2), sp = rand(120, 380);
      particles.push({
        kind: k % 3 ? 'shard' : 'chip', x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 520, drag: 1.2,
        life: rand(0.7, 1.2), rot: rand(0, 6), vr: rand(-18, 18), size: rand(5, 11), color,
      });
    }
  }

  function wave(x, y, r0, r1, life, color, width = 4) { waves.push({ x, y, r0, r1, t: 0, life, color, width }); }

  function banner(text, o = {}) {
    if (o.x == null) for (let i = banners.length - 1; i >= 0; i--) if (banners[i].x === null) banners.splice(i, 1);
    banners.push({ text, sub: o.sub || '', x: o.x ?? null, y: o.y ?? null, color: o.color || '#1f2a44', size: o.size || 64, t: 0, life: o.life || 1.4 });
  }

  function topScreen(world, i) {
    const t = world.tops[i];
    return arenaToScreen(L, t.x, t.y);
  }

  function spawnFromEvents(events, world, quiet = false) {
    for (const e of events) {
      if (e.type === 'hit') {
        const p = arenaToScreen(L, e.x, e.y);
        burst(p.x, p.y, Math.min(26, 5 + e.impact * 12), false);
        if (quiet) continue;
        wave(p.x, p.y, 4, 24 + e.impact * 30, 0.35, 'rgba(255,255,255,0.9)', 3);
        if (!reducedMotion()) shake = Math.max(shake, Math.min(9, e.impact * 5));
        if (e.impact > 1.3) { slowmo(0.25, 0.08); flash = Math.max(flash, 0.12); }
      } else if (quiet) {
        continue;
      } else if (e.type === 'damage') {
        hud.hit(e.i, e.amount);
      } else if (e.type === 'snap') {
        const p = topScreen(world, e.i);
        const rpx = world.tops[e.i].spec.radius * L.scale;
        shards(p.x, p.y, '#2b2b30');
        burst(p.x, p.y, 30, true);
        wave(p.x, p.y, rpx, rpx * 5, 0.6, PLAYER_COLORS[e.i], 6);
        stamps.push({ i: e.i, x: p.x, y: p.y, t: 0, life: 1.6 });
        flash = 0.5;
        if (!reducedMotion()) {
          shake = 14;
          cam.target = 1.18; cam.fx = p.x; cam.fy = p.y; cam.hold = 0.55;
        }
        slowmo(0.3, 0.6);
      } else if (e.type === 'clashStart') {
        const p = arenaToScreen(L, e.x, e.y);
        sparks(p.x, p.y, 24, '#ffe7a3');
        wave(p.x, p.y, 10, 120, 0.5, '#ffd23f', 6);
        flash = Math.max(flash, 0.3);
        if (!reducedMotion()) shake = Math.max(shake, 8);
        banner('SPIN CLASH!', { color: '#d97706', size: 72, life: 1.2 });
      } else if (e.type === 'clashEnd') {
        const w0 = topScreen(world, e.winner), l0 = topScreen(world, 1 - e.winner);
        for (let k = 0; k < 22; k++) { // spin flies from the loser to the winner
          const f = k / 22;
          particles.push({ kind: 'spark', x: l0.x + (w0.x - l0.x) * f * 0.3, y: l0.y + (w0.y - l0.y) * f * 0.3,
            vx: (w0.x - l0.x) * rand(1.6, 2.6), vy: (w0.y - l0.y) * rand(1.6, 2.6), life: rand(0.3, 0.5), rot: Math.atan2(w0.y - l0.y, w0.x - l0.x), vr: 0, size: rand(8, 16), color: PLAYER_COLORS[e.winner], drag: 2 });
        }
        wave(w0.x, w0.y, 10, 80, 0.5, PLAYER_COLORS[e.winner], 5);
        banner('CLASH WON! +spin', { x: w0.x, y: w0.y - 60, color: PLAYER_COLORS[e.winner], size: 28, life: 1.3 });
      } else if (e.type === 'crumble') {
        // Snap KO: the eraser breaks apart into crumbs
        const p = topScreen(world, e.i);
        const rpx = world.tops[e.i].spec.radius * L.scale;
        shards(p.x, p.y, '#2b2b30');
        for (let k = 0; k < 26; k++) {
          const a = rand(0, Math.PI * 2), sp = rand(120, 420);
          particles.push({ kind: 'chip', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, g: 600, drag: 1, life: rand(0.8, 1.4), rot: rand(0, 6), vr: rand(-15, 15), size: rand(6, 14) });
        }
        wave(p.x, p.y, rpx, rpx * 7, 0.8, '#ffffff', 8);
        flash = 0.8;
        if (!reducedMotion()) { shake = 18; cam.target = 1.22; cam.fx = p.x; cam.fy = p.y; cam.hold = 0.8; }
        slowmo(0.25, 0.9);
        banner('SNAP KO!', { x: p.x, y: p.y - 70, color: '#b3261e', size: 46, life: 1.6 });
      } else if (e.type === 'special') {
        const p = topScreen(world, e.i);
        const a = ABILITIES[e.kind];
        wave(p.x, p.y, 10, 90, 0.5, a?.color || '#fff', 5);
        banner(`${a?.icon || ''} ${a?.name || ''}!`, { x: p.x, y: p.y - 56, color: PLAYER_COLORS[e.i], size: 30, life: 1.1 });
      } else if (e.type === 'unlock') {
        const p = topScreen(world, e.i);
        wave(p.x, p.y, 8, 70, 0.7, ABILITIES[e.kind]?.color || '#ffd23f', 4);
        banner('ABILITY READY!', { x: p.x, y: p.y - 50, color: '#d97706', size: 24, life: 1.3 });
      } else if (e.type === 'block') {
        const p = topScreen(world, e.i);
        sparks(p.x, p.y, 14, '#bcd3ff');
        wave(p.x, p.y, 20, 60, 0.4, 'rgba(160,190,255,0.9)', 4);
      } else if (e.type === 'bump') {
        const p = arenaToScreen(L, e.x, e.y);
        sparks(p.x, p.y, 10, '#ffe7a3');
        if (!reducedMotion()) shake = Math.max(shake, 4);
      }
    }
  }

  // ---------- drawing ----------
  function begin() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, L.width, L.height);
    const sx = shake ? rand(-shake, shake) : 0, sy = shake ? rand(-shake, shake) : 0;
    ctx.translate(sx, sy);
    if (Math.abs(cam.zoom - 1) > 0.002) {
      ctx.translate(cam.fx, cam.fy);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.fx, -cam.fy);
    }
    if (bg) ctx.drawImage(bg, 0, 0, L.width, L.height);
  }

  function endFrame() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, flash)})`;
      ctx.fillRect(0, 0, L.width, L.height);
    }
  }

  function screenDir(ax, ay) {
    const a = arenaToScreen(L, 0, 0), b = arenaToScreen(L, ax, ay);
    const dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1;
    return { x: dx / m, y: dy / m };
  }

  function drawTrail(i, t) {
    const tr = trails[i];
    if (tr.length < 2) return;
    const art = ERASER_ART[t.spec.eraserId];
    const rpx = t.spec.radius * L.scale;
    for (let k = 1; k < tr.length; k++) {
      const a = k / tr.length;
      ctx.beginPath();
      ctx.moveTo(tr[k - 1].x, tr[k - 1].y);
      ctx.lineTo(tr[k].x, tr[k].y);
      ctx.strokeStyle = art.base;
      ctx.globalAlpha = a * 0.28;
      ctx.lineWidth = rpx * 1.4 * a;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawTop(t, i, opts = {}) {
    const spec = t.spec;
    const rpx = spec.radius * L.scale;
    const spin = Math.min(1, t.rpm / spec.maxRPM);
    const p = arenaToScreen(L, t.x, t.y);
    const wob = Math.min(1, t.wobble);
    const wa = clock * (5 + 9 * spin);
    const ox = Math.cos(wa) * wob * rpx * 0.5, oy = Math.sin(wa) * wob * rpx * 0.5;
    const art = ERASER_ART[spec.eraserId];

    // contact shadow + soft shadow
    ctx.beginPath();
    ctx.ellipse(p.x + 5, p.y + 8, rpx * (1.15 + wob * 0.25), rpx * (1.0 + wob * 0.25), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,25,35,0.22)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 3, rpx * 0.9, rpx * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,25,35,0.22)';
    ctx.fill();

    // unlocked ability aura
    if (t.unlocked && !t.specialUsed && !opts.ghost) {
      const col = ABILITIES[t.specialKind]?.color || '#ffd23f';
      const pulse = 0.5 + 0.5 * Math.sin(clock * 8);
      const g = ctx.createRadialGradient(p.x, p.y, rpx * 0.8, p.x, p.y, rpx * (2 + pulse * 0.4));
      g.addColorStop(0, `${col}aa`);
      g.addColorStop(1, `${col}00`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rpx * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // player ring
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(clock * 0.8 * (i ? -1 : 1));
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, rpx * 1.36, 0, Math.PI * 2);
    ctx.strokeStyle = PLAYER_COLORS[i];
    ctx.globalAlpha = opts.ghost ? 0.5 : 0.9;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;

    if (t.planted) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, rpx * 1.6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(40,40,60,0.6)';
      ctx.lineWidth = 5;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(p.x + ox, p.y + oy);
    ctx.rotate(t.angle);
    if (spin > 0.2 && !opts.ghost) {
      const sweep = rpx * 1.14;
      const disc = ctx.createRadialGradient(0, 0, sweep * 0.2, 0, 0, sweep);
      disc.addColorStop(0, shade(art.rubber, -0.04));
      disc.addColorStop(1, shade(art.base, -0.1));
      ctx.globalAlpha = 0.2 + 0.4 * spin;
      ctx.beginPath();
      ctx.arc(0, 0, sweep, 0, Math.PI * 2);
      ctx.fillStyle = disc;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(0, 0, sweep * (0.7 + k * 0.14), k * 2.1, k * 2.1 + 1.2 * spin);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = opts.ghost ? 0.55 : 1 - 0.5 * Math.max(0, spin - 0.25);
    drawEraserTop(ctx, spec.eraserId, rpx);
    ctx.globalAlpha = 1;
    drawLeadTop(ctx, spec.leadId, rpx, t.leadSnapped);
    ctx.restore();

    // graphite shield bubble
    if (t.shieldHits > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, rpx * 1.7, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(p.x, p.y, rpx, p.x, p.y, rpx * 1.7);
      g.addColorStop(0, 'rgba(150,180,255,0.05)');
      g.addColorStop(1, 'rgba(150,180,255,0.45)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,215,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `700 ${Math.max(11, rpx * 0.5)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e6eeff';
      ctx.fillText('🛡'.repeat(t.shieldHits), p.x, p.y - rpx * 1.85);
      ctx.restore();
    }

    // slowed in a patch: little drag marks
    if (t.inZone && !opts.ghost) {
      ctx.strokeStyle = 'rgba(30,20,10,0.45)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const a = clock * 3 + (k * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rpx * 1.15, a, a + 0.5);
        ctx.stroke();
      }
    }

    if (t.dashUntil && opts.time !== undefined && opts.time < t.dashUntil) {
      const v = Math.hypot(t.vx, t.vy) || 1;
      const b = screenDir(-t.vx / v, -t.vy / v);
      ctx.strokeStyle = ABILITIES.dash.color;
      ctx.lineWidth = 4;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        const px = p.x + b.y * k * rpx * 0.6, py = p.y - b.x * k * rpx * 0.6;
        ctx.moveTo(px + b.x * rpx * 1.3, py + b.y * rpx * 1.3);
        ctx.lineTo(px + b.x * rpx * 3, py + b.y * rpx * 3);
        ctx.stroke();
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const a = Math.min(1, p.life / 0.25);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === 'dust') {
        ctx.fillStyle = '#3a3a40';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-p.size, 0);
        ctx.stroke();
      } else if (p.kind === 'shard') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.5, -p.size * 0.3);
        ctx.lineTo(p.size * 0.6, 0);
        ctx.lineTo(-p.size * 0.3, p.size * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-p.size * 0.2, -p.size * 0.12, p.size * 0.4, 1.5);
      } else if (p.kind === 'chip') {
        ctx.fillStyle = '#e9c48f';
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, s, -0.2, 2.4);
        ctx.closePath();
        ctx.fillStyle = '#efcf9a';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, s, -0.2, 2.4);
        ctx.strokeStyle = p.paint;
        ctx.lineWidth = Math.max(1.2, s * 0.22);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawWaves() {
    for (const w of waves) {
      const k = w.t / w.life;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r0 + (w.r1 - w.r0) * (1 - (1 - k) ** 2), 0, Math.PI * 2);
      ctx.strokeStyle = w.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = w.width * (1 - k * 0.6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // "LEAD SNAPPED!" stamped on, then cracked in two
  function drawStamps() {
    for (const s of stamps) {
      const k = s.t / s.life;
      const size = Math.min(54, L.width / 9);
      const pop = k < 0.12 ? 2.2 - 1.2 * (k / 0.12) : 1;
      const split = k > 0.45 ? (k - 0.45) / 0.55 : 0;
      const alpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      const x = Math.min(Math.max(s.x, size * 4), L.width - size * 4);
      const y = Math.max(s.y - size * 1.6, size * 1.2 + (L.hud === 'top' ? 84 : 0));
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.rotate(-0.08);
      ctx.font = `900 ${size}px ${HAND}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = 'LEAD SNAPPED!';
      for (const half of [-1, 1]) {
        ctx.save();
        ctx.beginPath();
        // a jagged crack line splits the stamp
        const tw = size * 4.2;
        ctx.moveTo(-tw, 0);
        for (let j = 0; j <= 10; j++) ctx.lineTo(-tw + (j * tw * 2) / 10, (j % 2 ? 6 : -6));
        ctx.lineTo(tw, half * size * 2);
        ctx.lineTo(-tw, half * size * 2);
        ctx.closePath();
        ctx.clip();
        ctx.translate(half * split * 18, half * split * 14);
        ctx.rotate(half * split * 0.05);
        ctx.lineJoin = 'round';
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#161616';
        ctx.strokeText(text, 0, 0);
        const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.5, PLAYER_COLORS[s.i]);
        g.addColorStop(1, shade(PLAYER_COLORS[s.i], -0.3));
        ctx.fillStyle = g;
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  function drawBanners() {
    for (const b of banners) {
      const k = b.t / b.life;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.4 : 1;
      const alpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      const x = b.x ?? L.width / 2;
      const y = (b.y ?? L.height / 2 + (L.hud === 'top' ? 30 : 0)) - (b.x !== null ? k * 30 : 0);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.rotate(-0.04);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const size = Math.min(b.size, L.width / Math.max(4, b.text.length * 0.62));
      ctx.font = `700 ${size}px ${HAND}`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.16;
      ctx.strokeStyle = '#fffdf6';
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      if (b.sub) {
        ctx.font = `600 ${Math.max(14, size * 0.32)}px ${HAND}`;
        ctx.lineWidth = 5;
        ctx.strokeText(b.sub, 0, size * 0.75);
        ctx.fillStyle = '#3b3b48';
        ctx.fillText(b.sub, 0, size * 0.75);
      }
      ctx.restore();
    }
  }

  function overlays(frame) {
    endFrame();
    if (frame?.hudData) hud.draw(ctx, L, frame.hudData, clock);
    if (frame?.overlay) frame.overlay(ctx, L);
    drawStamps();
    drawBanners();
  }

  // ---------- public draw calls ----------
  function drawBattle(world, frame) {
    if (trailWorld !== world) { trailWorld = world; trails[0] = []; trails[1] = []; }
    world.tops.forEach((t, i) => {
      const p = arenaToScreen(L, t.x, t.y);
      trails[i].push(p);
      if (trails[i].length > 14) trails[i].shift();
    });
    begin();
    drawCrumbs(ctx, L, world.zones || [], world.time);
    world.tops.forEach((t, i) => drawTrail(i, t));
    drawWaves();
    world.tops.forEach((t, i) => drawTop(t, i, { time: world.time }));
    if (world.clash) {
      const p = arenaToScreen(L, world.clash.x, world.clash.y);
      if (Math.random() < 0.8) sparks(p.x, p.y, 2, Math.random() < 0.5 ? '#ffe7a3' : '#ffffff');
      const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 60);
      g.addColorStop(0, 'rgba(255,230,140,0.7)');
      g.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 60, 0, Math.PI * 2);
      ctx.fill();
      if (!reducedMotion()) shake = Math.max(shake, 2.5);
    }
    drawParticles();
    overlays(frame);
    if (world.clash) drawClashMeter(world.clash, frame);
  }

  // tug-of-war bar: whoever mashes more pushes it toward the other side
  function drawClashMeter(c, frame) {
    const W = L.width, H = L.height;
    const bw = Math.min(460, W - 48), bh = 26;
    const x = (W - bw) / 2, y = L.rotate ? H / 2 - bh / 2 : H - 92;
    const share = (c.mash[0] + 1) / (c.mash[0] + c.mash[1] + 2);
    ctx.save();
    ctx.fillStyle = '#161616';
    ctx.fillRect(x - 4, y - 4, bw + 8, bh + 8);
    ctx.fillStyle = PLAYER_COLORS[0];
    ctx.fillRect(x, y, bw * share, bh);
    ctx.fillStyle = PLAYER_COLORS[1];
    ctx.fillRect(x + bw * share, y, bw * (1 - share), bh);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(x + bw * share - 3, y - 6, 6, bh + 12);
    const left = Math.max(0, 1 - c.t / CLASH.duration);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x, y + bh + 6, bw * left, 4);
    ctx.font = `800 ${W < 420 ? 20 : 24}px ${HAND}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#161616';
    const pulse = 1 + 0.06 * Math.sin(clock * 20);
    ctx.translate(W / 2, y - 22);
    ctx.scale(pulse, pulse);
    const hint = frame?.clashHint || 'MASH!';
    ctx.strokeText(hint, 0, 0);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(hint, 0, 0);
    ctx.restore();
    ctx.font = `800 18px ${HAND}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(String(c.mash[0]), x + 8, y + bh / 2 + 1);
    ctx.textAlign = 'right';
    ctx.fillText(String(c.mash[1]), x + bw - 8, y + bh / 2 + 1);
  }

  function thumbsGuide(p, i, rpx) {
    // two thumbs flicking past each other next to the top
    const k = Math.sin(clock * 12);
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (const side of [-1, 1]) {
      const x = p.x + side * rpx * 2.6;
      const y = p.y + side * k * rpx * 0.9;
      ctx.beginPath();
      ctx.ellipse(x, y, rpx * 0.55, rpx * 0.75, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,224,190,0.92)';
      ctx.fill();
      ctx.strokeStyle = PLAYER_COLORS[i];
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y - rpx * 0.35, rpx * 0.3, rpx * 0.22, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();
      ctx.fillStyle = PLAYER_COLORS[i];
      ctx.font = `700 ${Math.max(12, rpx * 0.6)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(side * k > 0 ? '▼' : '▲', x, y + rpx * 1.15);
    }
    ctx.restore();
  }

  function drawLaunch(launches, frame) {
    begin();
    launches.forEach((s, i) => {
      if (!s) return;
      const ghost = {
        spec: s.spec,
        x: LAUNCH.START_RADIUS * Math.cos(s.rimAngle), y: LAUNCH.START_RADIUS * Math.sin(s.rimAngle),
        vx: 0, vy: 0, rpm: s.phase === 'twist' ? s.rpm : 0, wobble: 0,
        angle: s.phase === 'twist' ? clock * (s.rpm / s.spec.maxRPM) * 18 : 0.3,
        leadSnapped: false, planted: false,
      };
      drawTop(ghost, i, { ghost: s.phase === 'place' });
      const p = arenaToScreen(L, ghost.x, ghost.y);
      const rpx = s.spec.radius * L.scale;
      if (s.phase === 'place') {
        ctx.strokeStyle = PLAYER_COLORS[i];
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 6]);
        const home = s.side === 0 ? Math.PI : 0;
        ctx.beginPath();
        for (let a = -LAUNCH.SLIDE_RANGE; a <= LAUNCH.SLIDE_RANGE + 1e-6; a += 0.05) {
          const q = arenaToScreen(L, LAUNCH.START_RADIUS * Math.cos(home + a), LAUNCH.START_RADIUS * Math.sin(home + a));
          a === -LAUNCH.SLIDE_RANGE ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (s.phase === 'twist') {
        const ring = ringSize(s);
        const perfect = ring <= LAUNCH.PERFECT_RING;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rpx * (1.45 + ring * 1.3), 0, Math.PI * 2);
        ctx.strokeStyle = perfect ? '#22c55e' : 'rgba(40,40,60,0.6)';
        ctx.lineWidth = perfect ? 6 : 2.5;
        ctx.stroke();
        const frac = s.rpm / s.spec.maxRPM;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rpx * 1.75, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.strokeStyle = PLAYER_COLORS[i];
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.lineCap = 'butt';
        if (frame?.touchGuide?.[i]) thumbsGuide(p, i, rpx);
        if (s.spinDir) {
          ctx.font = `900 ${Math.max(18, rpx * 0.9)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#fff';
          const ax = p.x + rpx * 2.1, ay = p.y - rpx * 1.6;
          ctx.strokeText(s.spinDir > 0 ? '↻' : '↺', ax, ay);
          ctx.fillStyle = PLAYER_COLORS[i];
          ctx.fillText(s.spinDir > 0 ? '↻' : '↺', ax, ay);
        }
      }
      const label = frame?.launchLabels?.[i];
      if (label) {
        ctx.font = `700 ${L.width < 420 ? 17 : 19}px ${HAND}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#fffdf6';
        const off = rpx * 2.8;
        const ly = p.y + (L.rotate ? (i === 0 ? off : -off) : -off);
        const lx = Math.min(Math.max(p.x, 110), L.width - 110);
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = PLAYER_COLORS[i];
        ctx.fillText(label, lx, ly);
      }
    });
    drawParticles();
    overlays(frame);
  }

  function drawIntro(p, data) {
    begin();
    endFrame();
    paintIntro(ctx, L, p, data, clock);
  }

  function drawIdle() {
    begin();
    drawParticles();
    overlays(null);
  }

  Object.assign(self, {
    resize, setArena, update, drawBattle, drawLaunch, drawIntro, drawIdle, spawnFromEvents, banner, burst,
    get timeScale() { return slow.scale; },
    get clock() { return clock; },
    layout: L,
  });
  void THALI_OUTER;
  return self;
}
