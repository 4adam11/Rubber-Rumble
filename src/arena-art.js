// Static backgrounds: the wooden desk and the three arenas, painted once per resize.
import { arenaToScreen, THALI_OUTER } from './layout.js';
import { ARENAS } from './arenas.js';

const rand = (a, b) => a + Math.random() * (b - a);

// a deterministic jitter so stains look the same every repaint
function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paintDesk(g, w, h) {
  const wood = g.createLinearGradient(0, 0, w, h);
  wood.addColorStop(0, '#c99258');
  wood.addColorStop(0.5, '#b97c45');
  wood.addColorStop(1, '#a1663a');
  g.fillStyle = wood;
  g.fillRect(0, 0, w, h);
  const plank = 150;
  for (let py = 0; py < h + plank; py += plank) {
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
    g.fillStyle = 'rgba(60,28,8,0.35)';
    g.fillRect(0, py, w, 2);
    g.fillStyle = 'rgba(255,220,170,0.12)';
    g.fillRect(0, py + 2, w, 1);
  }
  // a pencil and a ruler left lying on the desk
  g.save();
  g.translate(w * 0.06, h * 0.82);
  g.rotate(-0.35);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(4, 6, 170, 26);
  g.fillStyle = '#f2e3a4';
  g.fillRect(0, 0, 170, 26);
  g.fillStyle = 'rgba(60,40,10,0.55)';
  for (let i = 0; i <= 34; i++) g.fillRect(i * 5, 0, 1, i % 5 === 0 ? 10 : 5);
  g.restore();
  // warm vignette
  const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(30,12,0,0.4)');
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);
}

function dropShadow(g, cx, cy, R) {
  g.save();
  g.shadowColor = 'rgba(30,10,0,0.55)';
  g.shadowBlur = 30;
  g.shadowOffsetY = 14;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fillStyle = '#8f98a2';
  g.fill();
  g.restore();
}

function steelRim(g, cx, cy, r, R, tint = 0) {
  const rim = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  rim.addColorStop(0, '#fbfcfd');
  rim.addColorStop(0.28, '#a7b0ba');
  rim.addColorStop(0.5, '#eef1f4');
  rim.addColorStop(0.78, '#7f8994');
  rim.addColorStop(1, '#c9d0d7');
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fillStyle = rim;
  g.fill();
  // rolled lip highlight
  g.beginPath();
  g.arc(cx, cy, (r + R) / 2, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = Math.max(1, (R - r) * 0.25);
  g.stroke();
  if (tint) {
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fillStyle = `rgba(255,236,200,${tint})`;
    g.fill();
  }
}

function brushed(g, cx, cy, r, alpha) {
  for (let k = 1; k <= 60; k++) {
    g.beginPath();
    g.arc(cx, cy, (r * k) / 61, 0, Math.PI * 2);
    g.strokeStyle = k % 2 ? `rgba(255,255,255,${alpha})` : `rgba(40,50,60,${alpha * 0.6})`;
    g.lineWidth = 1;
    g.stroke();
  }
}

function glint(g, cx, cy, r) {
  g.save();
  g.beginPath();
  g.arc(cx, cy, r * 0.9, -2.55, -1.25);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = r * 0.04;
  g.lineCap = 'round';
  g.filter = 'blur(4px)';
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, r * 0.82, 0.6, 1.0);
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = r * 0.025;
  g.stroke();
  g.restore();
}

function paintThali(g, L) {
  const { cx, cy, scale } = L;
  const r = scale, R = scale * THALI_OUTER;
  dropShadow(g, cx, cy, R);
  steelRim(g, cx, cy, r, R);
  const bowl = g.createRadialGradient(cx - r * 0.22, cy - r * 0.28, r * 0.05, cx, cy, r);
  bowl.addColorStop(0, '#f8fafc');
  bowl.addColorStop(0.45, '#d4dae0');
  bowl.addColorStop(0.85, '#9ea7b1');
  bowl.addColorStop(1, '#7c8691');
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = bowl;
  g.fill();
  brushed(g, cx, cy, r, 0.05);
  // the deep inner ring of a thali
  g.beginPath();
  g.arc(cx, cy, r * 0.93, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(30,40,50,0.18)';
  g.lineWidth = 3;
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(30,40,50,0.4)';
  g.lineWidth = 2;
  g.stroke();
  glint(g, cx, cy, r);
  g.beginPath();
  g.arc(cx, cy, r * 0.035, 0, Math.PI * 2);
  g.fillStyle = 'rgba(80,90,100,0.25)';
  g.fill();
}

function paintTiffin(g, L) {
  const { cx, cy, scale } = L;
  const r = scale, R = scale * THALI_OUTER;
  dropShadow(g, cx, cy, R);
  steelRim(g, cx, cy, r, R, 0.05);
  const lid = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx, cy, r);
  lid.addColorStop(0, '#ffffff');
  lid.addColorStop(0.6, '#dfe3e7');
  lid.addColorStop(1, '#b3bbc4');
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = lid;
  g.fill();
  brushed(g, cx, cy, r, 0.035);
  // embossed rings of a tiffin lid
  for (const k of [0.38, 0.62, 0.86]) {
    g.beginPath();
    g.arc(cx, cy, r * k, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 3;
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, r * k + 2.5, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(60,70,80,0.22)';
    g.lineWidth = 2;
    g.stroke();
  }
  glint(g, cx, cy, r);
}

function paintGeometry(g, L) {
  const { cx, cy, scale } = L;
  const r = scale, R = scale * THALI_OUTER;
  dropShadow(g, cx, cy, R);
  steelRim(g, cx, cy, r, R);
  const tin = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r);
  tin.addColorStop(0, '#2f5aa0');
  tin.addColorStop(0.7, '#1d3b6e');
  tin.addColorStop(1, '#122648');
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = tin;
  g.fill();
  // printed protractor + ruler ticks round the edge
  g.save();
  g.translate(cx, cy);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  for (let a = 0; a < 360; a += 5) {
    const long = a % 30 === 0;
    const rad = (a * Math.PI) / 180;
    g.lineWidth = long ? 2 : 1;
    g.beginPath();
    g.moveTo(Math.cos(rad) * r * 0.97, Math.sin(rad) * r * 0.97);
    g.lineTo(Math.cos(rad) * r * (long ? 0.88 : 0.93), Math.sin(rad) * r * (long ? 0.88 : 0.93));
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.font = `600 ${Math.max(8, r * 0.05)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    g.fillText(String(a), Math.cos(rad) * r * 0.8, Math.sin(rad) * r * 0.8);
  }
  g.strokeStyle = 'rgba(255,255,255,0.14)';
  g.lineWidth = 1.5;
  for (const k of [0.3, 0.55]) { g.beginPath(); g.arc(0, 0, r * k, 0, Math.PI * 2); g.stroke(); }
  g.beginPath(); g.moveTo(-r * 0.95, 0); g.lineTo(r * 0.95, 0); g.moveTo(0, -r * 0.95); g.lineTo(0, r * 0.95); g.stroke();
  g.restore();
  glint(g, cx, cy, r);
}

function paintZone(g, L, z, i) {
  const p = arenaToScreen(L, z.x, z.y);
  const rr = z.r * L.scale;
  const rnd = seededRand(i * 97 + 13);
  const blob = (x, y, rad, n, jag) => {
    g.beginPath();
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr2 = rad * (1 - jag + jag * 2 * rnd());
      const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2;
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  };
  if (z.kind === 'dal') {
    blob(p.x, p.y, rr, 14, 0.18);
    g.fillStyle = 'rgba(232,162,32,0.78)';
    g.fill();
    g.lineWidth = 2.5;
    g.strokeStyle = 'rgba(170,96,10,0.7)';
    g.stroke();
    g.fillStyle = 'rgba(255,240,170,0.6)';
    g.beginPath();
    g.ellipse(p.x - rr * 0.25, p.y - rr * 0.3, rr * 0.35, rr * 0.16, -0.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(120,70,0,0.55)'; // mustard seeds
    for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(p.x + (rnd() - 0.5) * rr, p.y + (rnd() - 0.5) * rr, 1.6, 0, Math.PI * 2); g.fill(); }
  } else if (z.kind === 'ink') {
    blob(p.x, p.y, rr, 18, 0.28);
    g.fillStyle = 'rgba(8,14,40,0.92)';
    g.fill();
    for (let k = 0; k < 6; k++) {
      const a = rnd() * Math.PI * 2, d = rr * (1.15 + rnd() * 0.5);
      g.beginPath();
      g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, rr * (0.06 + rnd() * 0.08), 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(120,150,255,0.35)';
    g.beginPath();
    g.ellipse(p.x - rr * 0.3, p.y - rr * 0.3, rr * 0.3, rr * 0.12, -0.6, 0, Math.PI * 2);
    g.fill();
  } else if (z.kind === 'shavings') {
    const paints = ['#d43c2f', '#f2c230', '#2b2b2b', '#2f8f4e', '#2f5fd0'];
    for (let k = 0; k < 16; k++) {
      const a = rnd() * Math.PI * 2, d = rr * Math.sqrt(rnd()) * 0.9;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, s = rr * (0.25 + rnd() * 0.25);
      g.save();
      g.translate(x, y);
      g.rotate(rnd() * 6.28);
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, s, -0.2, 2.6);
      g.closePath();
      g.fillStyle = '#efcf9a';
      g.fill();
      g.beginPath();
      g.arc(0, 0, s, -0.2, 2.6);
      g.strokeStyle = paints[k % paints.length];
      g.lineWidth = Math.max(1.5, s * 0.22);
      g.stroke();
      g.restore();
    }
  }
}

function paintBumper(g, L, b) {
  const p = arenaToScreen(L, b.x, b.y);
  const br = b.r * L.scale;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 5;
  if (b.kind === 'sharpener') {
    // a red plastic sharpener with a steel blade
    g.translate(p.x, p.y);
    g.rotate(0.3);
    const w = br * 2.1, h = br * 1.7;
    g.beginPath();
    g.roundRect ? g.roundRect(-w / 2, -h / 2, w, h, br * 0.3) : g.rect(-w / 2, -h / 2, w, h);
    g.fillStyle = '#d63a2f';
    g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.22);
    const blade = g.createLinearGradient(-w * 0.35, 0, w * 0.35, 0);
    blade.addColorStop(0, '#9aa3ad');
    blade.addColorStop(0.5, '#f4f6f8');
    blade.addColorStop(1, '#8a939d');
    g.fillStyle = blade;
    g.fillRect(-w * 0.38, -h * 0.12, w * 0.76, h * 0.42);
    g.beginPath();
    g.arc(-w * 0.22, h * 0.09, br * 0.12, 0, Math.PI * 2);
    g.fillStyle = '#5b636c';
    g.fill();
    g.beginPath(); // pencil hole
    g.arc(w * 0.18, -h * 0.28, br * 0.16, 0, Math.PI * 2);
    g.fillStyle = '#2a1712';
    g.fill();
  } else {
    // compass pin: a brass disc with a steel point
    const disc = g.createRadialGradient(p.x - br * 0.3, p.y - br * 0.3, 1, p.x, p.y, br);
    disc.addColorStop(0, '#fff3c4');
    disc.addColorStop(1, '#b8902f');
    g.beginPath();
    g.arc(p.x, p.y, br, 0, Math.PI * 2);
    g.fillStyle = disc;
    g.fill();
    g.shadowColor = 'transparent';
    g.beginPath();
    g.arc(p.x, p.y, br * 0.35, 0, Math.PI * 2);
    g.fillStyle = '#d8dde2';
    g.fill();
    g.beginPath();
    g.arc(p.x, p.y, br * 0.12, 0, Math.PI * 2);
    g.fillStyle = '#333';
    g.fill();
  }
  g.restore();
}

export function paintArena(g, L, arenaId = 'thali') {
  const a = ARENAS[arenaId] || ARENAS.thali;
  if (arenaId === 'tiffin') paintTiffin(g, L);
  else if (arenaId === 'geometry') paintGeometry(g, L);
  else paintThali(g, L);
  a.zones.forEach((z, i) => paintZone(g, L, z, i));
  a.bumpers.forEach((b) => paintBumper(g, L, b));
}

// Crumbs dropped by the Crumb Trail ability (they come and go, so they are drawn every frame).
export function drawCrumbs(ctx, L, zones, time) {
  for (const z of zones) {
    if (z.kind !== 'crumbs') continue;
    const p = arenaToScreen(L, z.x, z.y);
    const fade = Math.max(0, Math.min(1, (z.until - time) / 1.2));
    const rnd = seededRand(Math.round(z.x * 9973 + z.y * 7919));
    ctx.globalAlpha = 0.85 * fade;
    for (let k = 0; k < 9; k++) {
      const a = rnd() * Math.PI * 2, d = z.r * L.scale * Math.sqrt(rnd());
      ctx.fillStyle = k % 3 ? '#fde2ea' : '#f472b6';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.6 + rnd() * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// A small preview for the arena picker.
export function paintArenaThumb(g, size, arenaId) {
  const L = { width: size, height: size, rotate: false, scale: (size / 2 - 4) / THALI_OUTER, cx: size / 2, cy: size / 2 };
  paintArena(g, L, arenaId);
}
