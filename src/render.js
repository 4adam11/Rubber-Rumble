// Canvas drawing: desk, steel thali, tops, shavings, HUD, banners.
import { computeLayout, arenaToScreen, screenToArenaVec, THALI_OUTER } from './layout.js';
import { SPECIAL_NAMES } from './parts.js';
import { LAUNCH, ringSize } from './launch.js';

export { computeLayout, arenaToScreen, screenToArenaVec };

export const PLAYER_COLORS = ['#2f5fd0', '#d8432f'];
const HAND = '"Kalam", "Comic Sans MS", cursive';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const PAINT = ['#d43c2f', '#f2c230', '#2b2b2b', '#2f8f4e', '#2f5fd0'];

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

function rand(a, b) { return a + Math.random() * (b - a); }

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v + amt * 255))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ---------- static background: desk + thali ----------
function paintBackground(w, h, dpr, L) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);

  // wood
  const wood = g.createLinearGradient(0, 0, w, h);
  wood.addColorStop(0, '#c99258');
  wood.addColorStop(0.5, '#b97c45');
  wood.addColorStop(1, '#a5683a');
  g.fillStyle = wood;
  g.fillRect(0, 0, w, h);

  const plank = 150;
  for (let py = 0; py < h + plank; py += plank) {
    // grain lines inside each plank
    for (let k = 0; k < 18; k++) {
      const y0 = py + rand(4, plank - 4);
      const amp = rand(1, 5), f = rand(0.004, 0.012), ph = rand(0, 6);
      g.beginPath();
      for (let x = -10; x <= w + 10; x += 12) {
        const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph * 2) * amp * 0.3;
        x === -10 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.strokeStyle = `rgba(90,45,15,${rand(0.05, 0.16)})`;
      g.lineWidth = rand(0.6, 2.4);
      g.stroke();
    }
    // a knot now and then
    if (Math.random() < 0.6) {
      const kx = rand(0, w), ky = py + rand(20, plank - 20);
      for (let r = 3; r < 22; r += 4) {
        g.beginPath();
        g.ellipse(kx, ky, r * 2.2, r * 0.8, 0, 0, Math.PI * 2);
        g.strokeStyle = `rgba(80,38,12,${0.18 - r * 0.006})`;
        g.lineWidth = 1.2;
        g.stroke();
      }
    }
    // seam
    g.fillStyle = 'rgba(60,28,8,0.35)';
    g.fillRect(0, py, w, 2);
    g.fillStyle = 'rgba(255,220,170,0.12)';
    g.fillRect(0, py + 2, w, 1);
  }

  // old pencil scribbles and a compass scratch on the desk
  g.save();
  g.strokeStyle = 'rgba(40,40,48,0.18)';
  g.lineWidth = 1.2;
  g.lineCap = 'round';
  const scribble = (x, y, s) => {
    g.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = i * 0.9;
      g.lineTo(x + Math.cos(a) * s * (0.4 + (i % 3) * 0.2) + i * 2, y + Math.sin(a) * s * 0.5);
    }
    g.stroke();
  };
  scribble(w * 0.08, h * 0.9, 18);
  scribble(w * 0.9, h * 0.12, 14);
  g.font = `600 22px ${HAND}`;
  g.fillStyle = 'rgba(40,40,48,0.16)';
  g.save();
  g.translate(w * 0.86, h * 0.88);
  g.rotate(-0.15);
  g.fillText('R + R', 0, 0);
  g.restore();
  g.beginPath();
  g.arc(w * 0.12, h * 0.14, 34, 0.3, 4.6);
  g.strokeStyle = 'rgba(255,235,200,0.22)';
  g.lineWidth = 1;
  g.stroke();
  g.restore();

  // vignette
  const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(30,12,0,0.35)');
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);

  paintThali(g, L);
  return c;
}

function paintThali(g, L) {
  const { cx, cy, scale } = L;
  const r = scale, R = scale * THALI_OUTER;

  g.save();
  g.shadowColor = 'rgba(30,10,0,0.55)';
  g.shadowBlur = 28;
  g.shadowOffsetY = 12;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fillStyle = '#9aa3ad';
  g.fill();
  g.restore();

  const rim = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  rim.addColorStop(0, '#fbfcfd');
  rim.addColorStop(0.3, '#a7b0ba');
  rim.addColorStop(0.55, '#eef1f4');
  rim.addColorStop(0.8, '#7f8994');
  rim.addColorStop(1, '#c9d0d7');
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fillStyle = rim;
  g.fill();

  const bowl = g.createRadialGradient(cx - r * 0.22, cy - r * 0.28, r * 0.05, cx, cy, r);
  bowl.addColorStop(0, '#f7f9fb');
  bowl.addColorStop(0.45, '#d6dce2');
  bowl.addColorStop(0.85, '#a3acb6');
  bowl.addColorStop(1, '#808a95');
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = bowl;
  g.fill();

  for (let k = 1; k <= 16; k++) {
    g.beginPath();
    g.arc(cx, cy, (r * k) / 16.5, 0, Math.PI * 2);
    g.strokeStyle = k % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(40,50,60,0.05)';
    g.lineWidth = 1;
    g.stroke();
  }

  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(30,40,50,0.35)';
  g.lineWidth = 2;
  g.stroke();

  g.save();
  g.beginPath();
  g.arc(cx, cy, r * 0.92, -2.5, -1.3);
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = r * 0.035;
  g.lineCap = 'round';
  g.filter = 'blur(3px)';
  g.stroke();
  g.restore();

  g.beginPath();
  g.arc(cx, cy, r * 0.035, 0, Math.PI * 2);
  g.fillStyle = 'rgba(80,90,100,0.25)';
  g.fill();
}

// ---------- renderer ----------
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let L = computeLayout(canvas.clientWidth || 800, canvas.clientHeight || 600);
  let dpr = 1;
  let bg = null;
  let clock = 0;
  let shake = 0;
  const particles = [];
  const banners = [];
  const self = {};

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    L = computeLayout(w, h);
    self.layout = L;
    bg = paintBackground(w, h, dpr, L);
  }

  function update(dt) {
    clock += dt;
    shake = Math.max(0, shake - dt * 30);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.exp(-4 * dt); p.vy *= Math.exp(-4 * dt);
      p.rot += p.vr * dt;
    }
    for (let i = banners.length - 1; i >= 0; i--) {
      banners[i].t += dt;
      if (banners[i].t >= banners[i].life) banners.splice(i, 1);
    }
  }

  function burst(sx, sy, count, big) {
    const n = Math.round(count * (reducedMotion() ? 0.3 : 1));
    for (let k = 0; k < n; k++) {
      const a = rand(0, Math.PI * 2), sp = rand(60, big ? 420 : 260);
      const dust = Math.random() < 0.4;
      particles.push({
        x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.35, 0.7), max: 0.7, rot: rand(0, 6), vr: rand(-12, 12),
        size: dust ? rand(1.2, 2.6) : rand(4, big ? 11 : 8),
        kind: dust ? 'dust' : 'shaving',
        paint: PAINT[Math.floor(Math.random() * PAINT.length)],
      });
    }
  }

  function spawnFromEvents(events, world) {
    for (const e of events) {
      if (e.type === 'hit') {
        const p = arenaToScreen(L, e.x, e.y);
        burst(p.x, p.y, Math.min(26, 5 + e.impact * 12), false);
        if (!reducedMotion()) shake = Math.max(shake, Math.min(9, e.impact * 5));
      } else if (e.type === 'snap' && world) {
        const t = world.tops[e.i];
        const p = arenaToScreen(L, t.x, t.y);
        burst(p.x, p.y, 34, true);
        banner('Lead snapped!', { x: p.x, y: p.y - 40, color: PLAYER_COLORS[e.i], size: 26, life: 1.2 });
        if (!reducedMotion()) shake = 12;
      } else if (e.type === 'special' && world) {
        const t = world.tops[e.i];
        const p = arenaToScreen(L, t.x, t.y);
        banner(SPECIAL_NAMES[e.kind] + '!', { x: p.x, y: p.y - 46, color: PLAYER_COLORS[e.i], size: 28, life: 1.1 });
      }
    }
  }

  function banner(text, o = {}) {
    if (o.x == null) {
      // only one centre banner at a time
      for (let i = banners.length - 1; i >= 0; i--) if (banners[i].x === null) banners.splice(i, 1);
    }
    banners.push({
      text, sub: o.sub || '', x: o.x ?? null, y: o.y ?? null,
      color: o.color || '#1f2a44', size: o.size || 64, t: 0, life: o.life || 1.4,
    });
  }

  // ---------- drawing helpers ----------
  function begin() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = shake ? rand(-shake, shake) : 0, sy = shake ? rand(-shake, shake) : 0;
    ctx.clearRect(0, 0, L.width, L.height);
    if (bg) ctx.drawImage(bg, sx - 0, sy - 0, L.width, L.height);
    ctx.translate(sx, sy);
  }

  function bodyPath(spec, rpx) {
    if (spec.shape === 'cube') {
      const s = rpx * 1.5;
      roundRect(ctx, -s / 2, -s / 2, s, s, rpx * 0.18);
    } else if (spec.shape === 'pill') {
      const w = rpx * 1.9, h = rpx * 1.1;
      roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
    } else {
      const w = rpx * 1.9, h = rpx * 1.25;
      roundRect(ctx, -w / 2, -h / 2, w, h, rpx * 0.25);
    }
  }

  function drawBody(spec, rpx, alpha) {
    ctx.globalAlpha = alpha;
    bodyPath(spec, rpx);
    const grad = ctx.createLinearGradient(-rpx, -rpx, rpx, rpx);
    grad.addColorStop(0, shade(spec.color, 0.12));
    grad.addColorStop(1, shade(spec.color, -0.14));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.stroke();
    ctx.save();
    bodyPath(spec, rpx);
    ctx.clip();
    if (spec.band) {
      ctx.fillStyle = spec.band;
      ctx.fillRect(-rpx * 0.25, -rpx * 2, rpx * 0.5, rpx * 4);
      ctx.fillStyle = '#1d1d1d';
      ctx.fillRect(-rpx * 0.25 - 2, -rpx * 2, 2, rpx * 4);
      ctx.fillRect(rpx * 0.25, -rpx * 2, 2, rpx * 4);
    }
    if (spec.shape === 'cube') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      roundRect(ctx, -rpx * 0.5, -rpx * 0.5, rpx, rpx, rpx * 0.12);
      ctx.stroke();
    }
    // rubbed-off pencil smudge
    ctx.fillStyle = 'rgba(60,60,70,0.10)';
    ctx.beginPath();
    ctx.ellipse(rpx * 0.45, -rpx * 0.2, rpx * 0.35, rpx * 0.18, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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

    // shadow
    ctx.beginPath();
    ctx.ellipse(p.x + 4, p.y + 6, rpx * (1.05 + wob * 0.2), rpx * (0.95 + wob * 0.2), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,25,35,0.28)';
    ctx.fill();

    // player ring
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(clock * 0.8 * (i ? -1 : 1));
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, rpx * 1.32, 0, Math.PI * 2);
    ctx.strokeStyle = PLAYER_COLORS[i];
    ctx.globalAlpha = opts.ghost ? 0.5 : 0.85;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;

    if (t.planted) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, rpx * 1.55, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(40,40,60,0.55)';
      ctx.lineWidth = 4;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(p.x + ox, p.y + oy);
    ctx.rotate(t.angle);
    if (spin > 0.2 && !opts.ghost) {
      // spin blur disc
      const sweep = rpx * 1.14;
      const disc = ctx.createRadialGradient(0, 0, sweep * 0.2, 0, 0, sweep);
      disc.addColorStop(0, shade(spec.color, -0.05));
      disc.addColorStop(1, shade(spec.color, -0.2));
      ctx.globalAlpha = 0.25 + 0.45 * spin;
      ctx.beginPath();
      ctx.arc(0, 0, sweep, 0, Math.PI * 2);
      ctx.fillStyle = disc;
      ctx.fill();
      ctx.globalAlpha = 1;
      // motion arcs
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.arc(0, 0, sweep * (0.75 + k * 0.18), k * Math.PI, k * Math.PI + 1.1 * spin);
        ctx.stroke();
      }
    }
    drawBody(spec, rpx, opts.ghost ? 0.55 : 1 - 0.55 * Math.max(0, spin - 0.2));
    // lead poking through the top
    ctx.beginPath();
    ctx.arc(0, 0, rpx * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#e2bf86';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, rpx * 0.09, 0, Math.PI * 2);
    ctx.fillStyle = t.leadSnapped ? '#8a8a90' : '#34343a';
    ctx.fill();
    if (t.leadSnapped) {
      ctx.strokeStyle = '#b22';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-rpx * 0.12, -rpx * 0.12); ctx.lineTo(rpx * 0.12, rpx * 0.12);
      ctx.moveTo(rpx * 0.12, -rpx * 0.12); ctx.lineTo(-rpx * 0.12, rpx * 0.12);
      ctx.stroke();
    }
    ctx.restore();

    if (t.dashUntil && opts.time !== undefined && opts.time < t.dashUntil) {
      const v = Math.hypot(t.vx, t.vy) || 1;
      const back = screenDir(-t.vx / v, -t.vy / v);
      ctx.strokeStyle = PLAYER_COLORS[i];
      ctx.lineWidth = 3;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        const px = p.x + back.y * k * rpx * 0.6, py = p.y - back.x * k * rpx * 0.6;
        ctx.moveTo(px + back.x * rpx * 1.3, py + back.y * rpx * 1.3);
        ctx.lineTo(px + back.x * rpx * 2.6, py + back.y * rpx * 2.6);
        ctx.stroke();
      }
    }
  }

  function screenDir(ax, ay) {
    const a = arenaToScreen(L, 0, 0), b = arenaToScreen(L, ax, ay);
    const dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1;
    return { x: dx / m, y: dy / m };
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
      } else {
        // a pencil-shaving curl: wood fan with a painted, scalloped edge
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

  function drawBanners() {
    for (const b of banners) {
      const k = b.t / b.life;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.4 : 1;
      const alpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      const x = b.x ?? L.width / 2;
      const y = (b.y ?? L.height / 2) - (b.x !== null ? k * 30 : 0);
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

  // ---------- HUD ----------
  function panelRect(i) {
    if (L.rotate) {
      const w = Math.min(L.width - 32, 520), h = 52;
      const x = (L.width - w) / 2;
      return i === 0 ? { x, y: L.height - 16 - h, w, h } : { x, y: 16, w, h };
    }
    const w = Math.min(220, (L.width - 2 * THALI_OUTER * L.scale) / 2 - 24);
    const ww = Math.max(150, w);
    return i === 0 ? { x: 16, y: 16, w: ww, h: 96 } : { x: L.width - 16 - ww, y: 16, w: ww, h: 96 };
  }

  function paper(r) {
    ctx.save();
    ctx.shadowColor = 'rgba(30,10,0,0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = 'rgba(255,253,246,0.94)';
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.clip();
    ctx.strokeStyle = 'rgba(80,130,200,0.18)';
    ctx.lineWidth = 1;
    for (let y = r.y + 18; y < r.y + r.h; y += 16) {
      ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(220,80,80,0.35)';
    ctx.beginPath(); ctx.moveTo(r.x + 12, r.y); ctx.lineTo(r.x + 12, r.y + r.h); ctx.stroke();
    ctx.restore();
  }

  function bar(x, y, w, h, frac, color, label) {
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(40,40,60,0.12)';
    ctx.fill();
    if (frac > 0) {
      roundRect(ctx, x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.strokeStyle = 'rgba(30,30,50,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    if (label) {
      ctx.font = `700 10px ${SANS}`;
      ctx.fillStyle = 'rgba(30,30,50,0.7)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x - 5, y + h / 2 + 0.5);
    }
  }

  function drawHud(hud, tops) {
    if (!hud) return;
    for (let i = 0; i < 2; i++) {
      const r = panelRect(i);
      paper(r);
      const t = tops[i];
      const col = PLAYER_COLORS[i];
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `700 17px ${HAND}`;
      ctx.fillStyle = col;
      const pips = 26;
      const name = hud.names[i];
      ctx.fillText(name, r.x + 18, r.y + 20, r.w - 18 - pips - 8);
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.arc(r.x + r.w - 12 - k * 13, r.y + 14, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = k < hud.roundWins[i] ? col : 'rgba(0,0,0,0)';
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      const spin = t ? t.rpm / t.spec.maxRPM : 0;
      const wob = t ? Math.min(1, t.wobble) : 0;
      const special = hud.specialNames?.[i] || '';
      const ready = hud.specialsReady?.[i];
      if (L.rotate) {
        const bw = (r.w - 70) / 2;
        bar(r.x + 58, r.y + 30, bw - 10, 9, spin, col, 'SPIN');
        bar(r.x + 58 + bw + 46, r.y + 30, bw - 46, 9, wob, wob > 0.6 ? '#d8432f' : '#e0a030', 'WOBBLE');
        ctx.font = `600 12px ${HAND}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = ready ? '#2a7a3b' : 'rgba(60,60,70,0.45)';
        ctx.fillText(`${special}${ready ? '' : ' (used)'}`, r.x + r.w - 40, r.y + 20);
      } else {
        bar(r.x + 62, r.y + 32, r.w - 74, 10, spin, col, 'SPIN');
        bar(r.x + 62, r.y + 50, r.w - 74, 10, wob, wob > 0.6 ? '#d8432f' : '#e0a030', 'WOBBLE');
        ctx.font = `600 13px ${HAND}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = ready ? '#2a7a3b' : 'rgba(60,60,70,0.45)';
        const key = hud.specialKeys?.[i] ? ` [${hud.specialKeys[i]}]` : '';
        ctx.fillText(`★ ${special}${ready ? key : ' — used'}`, r.x + 18, r.y + 82, r.w - 24);
      }
    }
  }

  // ---------- public draw calls ----------
  function drawBattle(world, hud) {
    begin();
    world.tops.forEach((t, i) => drawTop(t, i, { time: world.time }));
    drawParticles();
    drawHud(hud, world.tops);
    if (hud?.overlay) hud.overlay(ctx, L);
    drawBanners();
  }

  function drawLaunch(launches, hud) {
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
        // arrows along the rim
        ctx.strokeStyle = PLAYER_COLORS[i];
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 5]);
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
        ctx.strokeStyle = perfect ? '#22a34a' : 'rgba(40,40,60,0.55)';
        ctx.lineWidth = perfect ? 5 : 2.5;
        ctx.stroke();
        // rpm gauge
        const frac = s.rpm / s.spec.maxRPM;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rpx * 1.7, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.strokeStyle = PLAYER_COLORS[i];
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.lineCap = 'butt';
      } else if (s.result?.perfect) {
        ctx.font = `700 22px ${HAND}`;
      }
      const label = hud?.launchLabels?.[i];
      if (label) {
        ctx.font = `700 18px ${HAND}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#fffdf6';
        const ly = p.y + (L.rotate ? (i === 0 ? rpx * 2.6 : -rpx * 2.6) : -rpx * 2.6);
        ctx.strokeText(label, p.x, ly);
        ctx.fillStyle = PLAYER_COLORS[i];
        ctx.fillText(label, p.x, ly);
      }
    });
    drawParticles();
    drawHud(hud, launches.map((s) => s && { spec: s.spec, rpm: s.rpm, wobble: 0 }));
    if (hud?.overlay) hud.overlay(ctx, L);
    drawBanners();
  }

  function drawIdle() {
    begin();
    drawParticles();
    drawBanners();
  }

  Object.assign(self, { resize, update, drawBattle, drawLaunch, drawIdle, spawnFromEvents, banner, burst, layout: L });
  return self;
}
