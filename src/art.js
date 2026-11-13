// Hand-drawn stationery art, inspired by real Indian school erasers and pencils.
// Colours, sleeves and stripes follow the real products; no logos or brand lettering.
// Pure canvas drawing: every function takes a 2D context and draws around (0,0) unless told otherwise.

export const ERASER_ART = {
  'apsara-nondust': { shape: 'rect', w: 1.9, h: 1.15, rubber: '#f7f6f1', sleeve: 'apsara', base: '#1b6fb5', accent: '#a6ce39' },
  'apsara-jumbo': { shape: 'rect', w: 2.0, h: 1.3, rubber: '#f5f3ee', sleeve: 'apsara', base: '#164f8f', accent: '#f5c518' },
  'nataraj-621': { shape: 'rect', w: 1.85, h: 1.15, rubber: '#fbfbf8', sleeve: 'band', base: '#d2232a', accent: '#ffffff' },
  'doms-cubo': { shape: 'hex', w: 1.75, h: 1.75, rubber: '#fdfdfb', sleeve: 'neon', base: '#ff6a1a', accent: '#ffb38a' },
  'camlin-dustfree': { shape: 'rect', w: 1.95, h: 1.1, rubber: '#f8f8f6', sleeve: 'camlin', base: '#e9e9ec', accent: '#c2185b' },
  'faber-dustfree': { shape: 'rect', w: 1.95, h: 1.12, rubber: '#f9f8f4', sleeve: 'faber', base: '#e2412c', accent: '#ffffff' },
  'fruit-scented': { shape: 'pill', w: 1.9, h: 1.1, rubber: '#ff8fb1', sleeve: 'fruit', base: '#ff6f9c', accent: '#ffe066' },
};

export const LEAD_ART = {
  'nataraj-hb': { barrel: '#1d1d1f', stripe: '#d2232a', stripeW: 0.14, end: 'dip', endColor: '#111', label: '#e7c66b' },
  'apsara-platinum': { barrel: '#2a2c31', stripe: '#c9ced6', stripeW: 0.1, end: 'dip', endColor: '#c9ced6', label: '#ffffff' },
  'apsara-absolute': { barrel: '#1b3f8f', stripe: '#9fb7e6', end: 'dip', endColor: '#0e2257', label: '#ffffff' },
  'doms-y1': { barrel: '#ff7aa8', stripe: '#ffd1e1', end: 'cap', endColor: '#ffffff', label: '#ffffff' },
  'camlin-exam': { barrel: '#2c5fb8', stripe: '#86a7e6', end: 'cap', endColor: '#d63a2f', label: '#ffffff' },
  'faber-2b': { barrel: '#1f4d33', stripe: '#3f7a57', end: 'ferrule', endColor: '#c9a646', label: '#e7c66b' },
};

const WOOD = '#e9c48f';
const WOOD_DARK = '#c99a5c';
const GRAPHITE = '#2b2b30';

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v + amt * 255))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function hexPath(ctx, r, rot = Math.PI / 6) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3;
    i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

// little print lines that suggest lettering without copying any logo
function printBars(ctx, x, y, w, h, color, rows = 2) {
  ctx.fillStyle = color;
  for (let i = 0; i < rows; i++) {
    const bw = w * (i === 0 ? 1 : 0.62);
    rr(ctx, x, y + i * h * 1.9, bw, h, h / 2);
    ctx.fill();
  }
}

// ---------- sleeves (top-down, unit box -w/2..w/2, -h/2..h/2) ----------
function sleeveTop(ctx, a, w, h) {
  const x0 = -w * 0.12, x1 = w * 0.5; // sleeve covers the right ~60% like a real eraser
  const sw = x1 - x0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, -h / 2 - 1, sw, h + 2);
  ctx.clip();
  switch (a.sleeve) {
    case 'apsara': {
      ctx.fillStyle = a.base;
      ctx.fillRect(x0, -h, sw, h * 2);
      ctx.fillStyle = a.accent; // the diagonal flash
      ctx.beginPath();
      ctx.moveTo(x0 + sw * 0.55, -h);
      ctx.lineTo(x0 + sw * 0.95, -h);
      ctx.lineTo(x0 + sw * 0.7, h);
      ctx.lineTo(x0 + sw * 0.3, h);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(x0 + sw * 0.08, h * 0.1, sw * 0.42, h * 0.3);
      ctx.fillStyle = '#333';
      for (let i = 0; i < 7; i++) ctx.fillRect(x0 + sw * (0.12 + i * 0.045), h * 0.16, sw * 0.018, h * 0.18);
      printBars(ctx, x0 + sw * 0.08, -h * 0.32, sw * 0.4, h * 0.09, '#ffffff');
      break;
    }
    case 'band': {
      ctx.fillStyle = a.base;
      ctx.fillRect(x0 + sw * 0.05, -h, sw * 0.7, h * 2);
      printBars(ctx, x0 + sw * 0.14, -h * 0.18, sw * 0.5, h * 0.11, a.accent);
      break;
    }
    case 'camlin': {
      ctx.fillStyle = a.base;
      ctx.fillRect(x0, -h, sw, h * 2);
      const blob = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
      blob(x0 + sw * 0.82, -h * 0.15, h * 0.42, '#c2185b');
      blob(x0 + sw * 0.95, h * 0.2, h * 0.36, '#7b1fa2');
      blob(x0 + sw * 0.72, h * 0.32, h * 0.22, '#ff8f00');
      printBars(ctx, x0 + sw * 0.08, -h * 0.28, sw * 0.42, h * 0.12, '#222');
      printBars(ctx, x0 + sw * 0.08, h * 0.12, sw * 0.3, h * 0.08, '#d63a2f', 1);
      break;
    }
    case 'faber': {
      ctx.fillStyle = a.base;
      ctx.fillRect(x0, -h, sw, h * 2);
      ctx.fillStyle = shade(a.base, -0.08);
      ctx.fillRect(x0, h * 0.28, sw, h * 0.3);
      printBars(ctx, x0 + sw * 0.18, -h * 0.3, sw * 0.55, h * 0.1, '#fff');
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1, h * 0.05);
      ctx.beginPath(); // little arrow motif
      ctx.moveTo(x0 + sw * 0.55, h * 0.08); ctx.lineTo(x0 + sw * 0.85, h * 0.08); ctx.lineTo(x0 + sw * 0.78, -h * 0.02);
      ctx.stroke();
      break;
    }
  }
  // sleeve edge shadows
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x0, -h, Math.max(1, w * 0.012), h * 2);
  ctx.restore();
}

// ---------- erasers, top-down ----------
export function drawEraserTop(ctx, id, r) {
  const a = ERASER_ART[id];
  if (!a) return;
  const w = a.w * r, h = a.h * r;
  if (a.shape === 'hex') return neonHexTop(ctx, a, r);

  // body
  if (a.shape === 'pill') rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  else rr(ctx, -w / 2, -h / 2, w, h, r * 0.22);
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  g.addColorStop(0, shade(a.rubber, 0.04));
  g.addColorStop(1, shade(a.rubber, -0.12));
  ctx.fillStyle = g;
  ctx.fill();

  ctx.save();
  if (a.shape === 'pill') rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  else rr(ctx, -w / 2, -h / 2, w, h, r * 0.22);
  ctx.clip();
  if (a.sleeve === 'fruit') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-w * 0.1, -h * 0.18, w * 0.38, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = a.accent;
    const seeds = [[-0.3, 0.1], [-0.1, 0.25], [0.12, 0.05], [0.3, 0.22], [0.25, -0.2], [-0.05, -0.05], [-0.33, -0.18]];
    for (const [sx, sy] of seeds) {
      ctx.beginPath();
      ctx.ellipse(sx * w, sy * h, r * 0.05, r * 0.08, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3c9a3c'; // leaf
    ctx.beginPath();
    ctx.ellipse(-w * 0.42, 0, r * 0.16, r * 0.08, 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    sleeveTop(ctx, a, w, h);
    // rubbed, slightly grey exposed end
    ctx.fillStyle = 'rgba(70,70,80,0.08)';
    ctx.beginPath();
    ctx.ellipse(-w * 0.4, h * 0.1, w * 0.12, h * 0.3, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // top highlight
  const hl = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  hl.addColorStop(0, 'rgba(255,255,255,0.35)');
  hl.addColorStop(0.4, 'rgba(255,255,255,0)');
  hl.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = hl;
  ctx.fillRect(-w, -h, w * 2, h * 2);
  ctx.restore();

  if (a.shape === 'pill') rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  else rr(ctx, -w / 2, -h / 2, w, h, r * 0.22);
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.strokeStyle = 'rgba(30,30,40,0.45)';
  ctx.stroke();
}

function neonHexTop(ctx, a, r) {
  const R = r * 0.98;
  hexPath(ctx, R);
  ctx.fillStyle = a.base;
  ctx.fill();
  hexPath(ctx, R * 0.86);
  const g = ctx.createLinearGradient(-R, -R, R, R);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#e9e9e4');
  ctx.fillStyle = g;
  ctx.fill();
  // orange corner caps like the real case
  ctx.fillStyle = a.base;
  for (let i = 0; i < 6; i++) {
    const ang = Math.PI / 6 + (i * Math.PI) / 3;
    const cx = Math.cos(ang) * R * 0.8, cy = Math.sin(ang) * R * 0.8;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    rr(ctx, -R * 0.14, -R * 0.2, R * 0.2, R * 0.4, R * 0.05);
    ctx.fill();
    ctx.restore();
  }
  // multicolour "neon" print dots instead of lettering
  const cols = ['#00b3e6', '#ff2d87', '#ffb000', '#22c55e', '#7c3aed'];
  cols.forEach((c, i) => {
    ctx.fillStyle = c;
    rr(ctx, -R * 0.5 + i * R * 0.21, -R * 0.12, R * 0.16, R * 0.24, R * 0.06);
    ctx.fill();
  });
  printBars(ctx, -R * 0.4, R * 0.24, R * 0.8, R * 0.08, '#ff6a1a', 1);
  hexPath(ctx, R);
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.strokeStyle = 'rgba(120,40,0,0.55)';
  ctx.stroke();
}

// ---------- the pencil stub seen from above (centre of the top) ----------
export function drawLeadTop(ctx, id, r, snapped) {
  const L = LEAD_ART[id];
  if (!L) return;
  const R = r * 0.2;
  hexPath(ctx, R, 0);
  ctx.fillStyle = L.barrel;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.strokeStyle = L.stripe;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = WOOD;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = snapped ? '#8a8a92' : GRAPHITE;
  ctx.fill();
  if (snapped) {
    ctx.strokeStyle = '#c0262b';
    ctx.lineWidth = Math.max(1.2, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(-R * 0.7, -R * 0.2); ctx.lineTo(-R * 0.1, R * 0.15); ctx.lineTo(R * 0.25, -R * 0.25); ctx.lineTo(R * 0.7, R * 0.2);
    ctx.stroke();
  }
}

// ---------- print on sleeves and pencils (plain words only, no brand names) ----------
const ERASER_PRINT = {
  'apsara-nondust': { big: 'non dust', small: 'eraser' },
  'apsara-jumbo': { big: 'JUMBO', small: 'non dust eraser' },
  'nataraj-621': { big: 'ERASER', small: '621 · plastic' },
  'camlin-dustfree': { big: 'XL ERASER', small: 'all clear' },
  'faber-dustfree': { big: 'DUST-FREE', small: 'non-toxic' },
  'fruit-scented': { big: '', small: '' },
  'doms-cubo': { big: 'neon', small: 'eraser' },
};
const LEAD_PRINT = {
  'nataraj-hb': { text: '621  HB  ★★ BOLD ★', pattern: 'lines' },
  'apsara-platinum': { text: 'PLATINUM  EXTRA DARK', pattern: 'facets' },
  'apsara-absolute': { text: 'ABSOLUTE  HB  BREAK-PROOF', pattern: 'lines' },
  'doms-y1': { text: 'Y1+  HB/2', pattern: 'solid' },
  'camlin-exam': { text: 'EXAM  HB  ✓', pattern: 'solid' },
  'faber-2b': { text: '9000  2B', pattern: 'solid' },
};

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speckle(ctx, x, y, w, h, n, seed) {
  const rnd = seeded(seed);
  ctx.fillStyle = 'rgba(90,90,100,0.18)';
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(x + rnd() * w, y + rnd() * h, 0.4 + rnd() * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function text(ctx, str, x, y, size, color, weight = 800, align = 'left', font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif') {
  if (!str) return;
  ctx.font = `${weight} ${Math.max(5, size)}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// The printed sleeve as seen on the front face of the eraser (box x..x+w, y..y+h).
function sleeveFront(ctx, id, a, x, y, w, h) {
  const p = ERASER_PRINT[id] || {};
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  switch (a.sleeve) {
    case 'apsara': {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, shade(a.base, 0.08));
      g.addColorStop(1, shade(a.base, -0.08));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = a.accent; // diagonal flash
      ctx.beginPath();
      ctx.moveTo(x + w * 0.42, y + h); ctx.lineTo(x + w * 0.62, y + h);
      ctx.lineTo(x + w * 0.98, y); ctx.lineTo(x + w * 0.78, y);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.translate(x + w * 0.68, y + h * 0.5);
      ctx.rotate(-0.95);
      text(ctx, p.big, 0, -h * 0.02, h * 0.2, '#ffffff', 900, 'center');
      text(ctx, p.small, 0, h * 0.17, h * 0.12, '#ffffff', 700, 'center');
      ctx.restore();
      ctx.fillStyle = '#ffffff'; // barcode label
      ctx.fillRect(x + w * 0.06, y + h * 0.56, w * 0.3, h * 0.3);
      ctx.fillStyle = '#222';
      const rnd = seeded(7);
      for (let i = 0; i < 16; i++) ctx.fillRect(x + w * 0.08 + i * w * 0.016, y + h * 0.6, w * (0.004 + rnd() * 0.008), h * 0.17);
      text(ctx, 'for neat & clean erasing', x + w * 0.06, y + h * 0.32, h * 0.11, '#ffffff', 700);
      break;
    }
    case 'band': {
      const bx = x + w * 0.12, bw = w * 0.7;
      ctx.fillStyle = a.base;
      ctx.fillRect(bx, y, bw, h);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(bx, y, bw, h * 0.25);
      text(ctx, p.big, bx + bw / 2, y + h * 0.4, h * 0.27, '#ffffff', 900, 'center');
      text(ctx, p.small, bx + bw / 2, y + h * 0.72, h * 0.16, '#ffffff', 800, 'center');
      break;
    }
    case 'camlin': {
      ctx.fillStyle = a.base;
      ctx.fillRect(x, y, w, h);
      const blob = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
      blob(x + w * 0.84, y + h * 0.3, h * 0.42, '#c2185b');
      blob(x + w * 0.98, y + h * 0.75, h * 0.38, '#7b1fa2');
      blob(x + w * 0.76, y + h * 0.86, h * 0.24, '#ff8f00');
      text(ctx, p.big, x + w * 0.06, y + h * 0.42, h * 0.2, '#d63a2f', 900);
      text(ctx, p.small.toUpperCase(), x + w * 0.06, y + h * 0.66, h * 0.13, '#222', 800);
      ctx.fillStyle = '#222';
      ctx.fillRect(x + w * 0.06, y + h * 0.16, w * 0.38, h * 0.1);
      break;
    }
    case 'faber': {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, shade(a.base, 0.06));
      g.addColorStop(1, shade(a.base, -0.1));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1, h * 0.03);
      ctx.strokeRect(x + w * 0.05, y + h * 0.12, w * 0.9, h * 0.76);
      text(ctx, p.big, x + w * 0.1, y + h * 0.38, h * 0.21, '#ffffff', 900);
      text(ctx, p.small, x + w * 0.1, y + h * 0.66, h * 0.12, '#ffffff', 700);
      ctx.beginPath(); // arrow motif
      ctx.moveTo(x + w * 0.66, y + h * 0.42); ctx.lineTo(x + w * 0.88, y + h * 0.42); ctx.lineTo(x + w * 0.82, y + h * 0.32);
      ctx.moveTo(x + w * 0.88, y + h * 0.42); ctx.lineTo(x + w * 0.82, y + h * 0.52);
      ctx.stroke();
      break;
    }
  }
  // sleeve shading: rounds it over the edges
  const sh = ctx.createLinearGradient(x, y, x, y + h);
  sh.addColorStop(0, 'rgba(255,255,255,0.22)');
  sh.addColorStop(0.2, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = sh;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ---------- a whole pencil, lying flat, tip to the right ----------
export function drawPencil(ctx, id, x, y, len, th) {
  const L = LEAD_ART[id];
  if (!L) return;
  const P = LEAD_PRINT[id] || { pattern: 'solid', text: '' };
  const tipLen = Math.min(len * 0.17, th * 3.2), endLen = len * 0.07;
  const bx0 = x + endLen, bx1 = x + len - tipLen;
  const top = y - th / 2;
  const facets = [[0, 0.3, 0.2], [0.3, 0.4, 0], [0.7, 0.3, -0.2]];

  // soft shadow on the desk
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  rr(ctx, x + 3, top + th * 0.55, len - 3, th * 0.7, th * 0.35);
  ctx.fill();

  // barrel facets
  facets.forEach(([f0, fh, amt], k) => {
    let col = L.barrel;
    if (P.pattern === 'facets' && k !== 1) col = L.stripe;
    ctx.fillStyle = shade(col, amt);
    ctx.fillRect(bx0, top + th * f0, bx1 - bx0, th * fh + 0.6);
  });
  if (P.pattern === 'lines') {
    const sw = Math.max(1, th * (L.stripeW || 0.08));
    ctx.fillStyle = L.stripe;
    ctx.fillRect(bx0, top + th * 0.3 - sw / 2, bx1 - bx0, sw);
    ctx.fillRect(bx0, top + th * 0.7 - sw / 2, bx1 - bx0, sw);
  }
  // facet seams + top shine
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(bx0, top + th * 0.3, bx1 - bx0, 0.7);
  ctx.fillRect(bx0, top + th * 0.7, bx1 - bx0, 0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(bx0, top + th * 0.08, bx1 - bx0, Math.max(1, th * 0.07));
  // foil print
  if (P.text && th >= 8) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx0, top, bx1 - bx0, th);
    ctx.clip();
    text(ctx, P.text, bx0 + (bx1 - bx0) * 0.3, y + 0.5, th * 0.32, L.label, 800);
    ctx.restore();
  }

  // end
  if (L.end === 'ferrule') {
    const g = ctx.createLinearGradient(0, top, 0, top + th);
    g.addColorStop(0, '#fff1b8'); g.addColorStop(0.4, L.endColor); g.addColorStop(1, shade(L.endColor, -0.25));
    ctx.fillStyle = g;
    ctx.fillRect(x, top, endLen, th);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 1; i < 4; i++) ctx.fillRect(x + (endLen * i) / 4, top, 1, th);
  } else {
    const g = ctx.createLinearGradient(0, top, 0, top + th);
    g.addColorStop(0, shade(L.endColor, 0.22)); g.addColorStop(0.45, L.endColor); g.addColorStop(1, shade(L.endColor, -0.2));
    ctx.fillStyle = g;
    rr(ctx, x, top, endLen + 2, th, th * 0.22);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; // gloss
    ctx.fillRect(x + 2, top + th * 0.12, endLen - 2, th * 0.14);
    if (L.end === 'dip') { // dipped paint edge
      ctx.fillStyle = shade(L.endColor, 0.1);
      ctx.fillRect(bx0 - 1, top, 2, th);
    }
  }

  // sharpened wood cone, scalloped where the paint ends, with grain
  const coneEnd = x + len - tipLen * 0.3;
  ctx.beginPath();
  ctx.moveTo(bx1, top);
  for (let i = 0; i <= 4; i++) ctx.quadraticCurveTo(bx1 + tipLen * 0.14, top + (th * (i + 0.5)) / 5, bx1, top + (th * (i + 1)) / 5);
  ctx.lineTo(coneEnd, y + th * 0.1);
  ctx.lineTo(coneEnd, y - th * 0.1);
  ctx.closePath();
  const wg = ctx.createLinearGradient(0, top, 0, top + th);
  wg.addColorStop(0, '#f6dcb2'); wg.addColorStop(0.5, WOOD); wg.addColorStop(1, WOOD_DARK);
  ctx.fillStyle = wg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,100,40,0.35)';
  ctx.lineWidth = 0.8;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(bx1 + tipLen * 0.1, top + (th * i) / 4);
    ctx.lineTo(coneEnd, y + (i - 2) * th * 0.03);
    ctx.stroke();
  }
  // graphite point with a glint
  ctx.beginPath();
  ctx.moveTo(coneEnd, y - th * 0.1);
  ctx.lineTo(x + len, y);
  ctx.lineTo(coneEnd, y + th * 0.1);
  ctx.closePath();
  ctx.fillStyle = GRAPHITE;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(coneEnd, y - th * 0.05, tipLen * 0.15, Math.max(0.8, th * 0.04));

  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(bx0, top, bx1 - bx0, th);
}

// ---------- erasers as product shots, 3/4 view (menus, intro) ----------
export function drawEraserSide(ctx, id, width) {
  const a = ERASER_ART[id];
  if (!a) return;
  if (a.shape === 'hex') return neonHexSide(ctx, a, width);
  const round = a.shape === 'pill';
  const w = width * (a.w / 1.95), h = width * 0.34 * (a.h / 1.12);
  const dx = width * 0.15, dy = width * 0.11; // depth offset for the top face
  const x = -w / 2 - dx / 2, y = -h / 2 + dy / 2;
  const s0 = x + w * 0.36; // sleeve starts here (rubber end on the left, like the photos)

  // shadow on the desk
  const sg = ctx.createRadialGradient(x + w / 2 + dx / 2, y + h + 2, 2, x + w / 2 + dx / 2, y + h + 2, w * 0.65);
  sg.addColorStop(0, 'rgba(0,0,0,0.28)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + dx / 2, y + h + 1, w * 0.62, h * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  if (round) {
    // a squishy pill: top ellipse + body
    const body = ctx.createLinearGradient(0, y - dy, 0, y + h);
    body.addColorStop(0, shade(a.rubber, 0.12));
    body.addColorStop(1, shade(a.rubber, -0.18));
    rr(ctx, x, y - dy * 0.5, w + dx, h + dy * 0.5, (h + dy * 0.5) / 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    rr(ctx, x + w * 0.12, y - dy * 0.3, w * 0.55, h * 0.22, h * 0.11);
    ctx.fill();
    const rnd = seeded(31);
    ctx.fillStyle = a.accent;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.ellipse(x + w * 0.1 + rnd() * (w * 0.9), y + rnd() * h * 0.85, w * 0.012, w * 0.02, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3c9a3c';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.06, y + h * 0.25, w * 0.07, w * 0.03, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,30,60,0.35)';
    ctx.lineWidth = 1;
    rr(ctx, x, y - dy * 0.5, w + dx, h + dy * 0.5, (h + dy * 0.5) / 2);
    ctx.stroke();
    return;
  }

  // top face
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + dx, y - dy); ctx.lineTo(x + dx + w, y - dy); ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fillStyle = shade(a.rubber, 0.05);
  ctx.fill();
  speckle(ctx, x + dx * 0.3, y - dy * 0.9, (s0 - x), dy * 0.8, 10, 3);
  // sleeve over the top
  ctx.beginPath();
  ctx.moveTo(s0, y); ctx.lineTo(s0 + dx, y - dy); ctx.lineTo(x + dx + w, y - dy); ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fillStyle = shade(a.base, 0.12);
  ctx.fill();
  if (a.sleeve === 'apsara') {
    ctx.fillStyle = shade(a.accent, 0.08);
    ctx.beginPath();
    ctx.moveTo(s0 + (x + w - s0) * 0.78, y); ctx.lineTo(s0 + (x + w - s0) * 0.98, y);
    ctx.lineTo(s0 + (x + w - s0) * 0.98 + dx * 0.6, y - dy); ctx.lineTo(s0 + (x + w - s0) * 0.78 + dx * 0.6, y - dy);
    ctx.fill();
  }
  // right face
  ctx.beginPath();
  ctx.moveTo(x + w, y); ctx.lineTo(x + w + dx, y - dy); ctx.lineTo(x + w + dx, y - dy + h); ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fillStyle = a.sleeve === 'band' ? shade(a.rubber, -0.16) : shade(a.base, -0.18);
  ctx.fill();

  // front face: rubber, then the printed sleeve
  rr(ctx, x, y, w, h, Math.min(h * 0.1, 4));
  const fg = ctx.createLinearGradient(0, y, 0, y + h);
  fg.addColorStop(0, shade(a.rubber, 0.02));
  fg.addColorStop(1, shade(a.rubber, -0.1));
  ctx.fillStyle = fg;
  ctx.fill();
  speckle(ctx, x + 2, y + 2, s0 - x - 4, h - 4, 18, 5);
  // worn, rubbed corner with graphite smudge
  const sm = ctx.createRadialGradient(x + w * 0.06, y + h * 0.65, 0, x + w * 0.06, y + h * 0.65, h * 0.45);
  sm.addColorStop(0, 'rgba(70,70,80,0.13)');
  sm.addColorStop(1, 'rgba(70,70,80,0)');
  ctx.fillStyle = sm;
  ctx.fillRect(x, y, w * 0.3, h);
  if (a.sleeve === 'band') sleeveFront(ctx, id, a, x, y, w, h);
  else sleeveFront(ctx, id, a, s0, y, x + w - s0, h);
  // sleeve edge casts a hairline shadow on the rubber
  if (a.sleeve !== 'band') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(s0 - 1.2, y, 1.2, h);
  }
  // edge highlights
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 2, y + 0.5); ctx.lineTo(x + w - 1, y + 0.5); ctx.stroke();
  ctx.strokeStyle = 'rgba(30,30,40,0.35)';
  rr(ctx, x, y, w, h, Math.min(h * 0.1, 4));
  ctx.stroke();
}

function neonHexSide(ctx, a, width) {
  const R = width * 0.4, k = 0.5, th = width * 0.15;
  ctx.save();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, th + R * k * 0.6, R * 1.05, R * k * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  // clear plastic case base (orange band) + sides
  ctx.fillStyle = shade(a.base, -0.1);
  ctx.beginPath();
  ctx.moveTo(-R, 0); ctx.lineTo(-R, th); ctx.lineTo(-R / 2, R * k + th); ctx.lineTo(R / 2, R * k + th); ctx.lineTo(R, th); ctx.lineTo(R, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-R, th * 0.42, R * 2, th * 0.14);
  // top face
  ctx.save();
  ctx.scale(1, k);
  hexPath(ctx, R, 0);
  ctx.fillStyle = a.base;
  ctx.fill();
  hexPath(ctx, R * 0.84, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  // neon lettering as colour blocks
  const cols = ['#00b3e6', '#ff2d87', '#ffb000', '#22c55e', '#7c3aed'];
  cols.forEach((c, i) => {
    ctx.fillStyle = c;
    rr(ctx, -R * 0.5 + i * R * 0.2, -R * k * 0.2, R * 0.15, R * k * 0.3, R * 0.04);
    ctx.fill();
  });
  text(ctx, 'ERASER', -R * 0.42, R * k * 0.3, R * 0.13, '#ff6a1a', 900);
  // the clear lid, tipped back like in the photo
  ctx.globalAlpha = 0.5;
  ctx.save();
  ctx.translate(0, -R * k * 1.05);
  ctx.scale(1, k * 0.9);
  hexPath(ctx, R * 1.02, 0);
  const lid = ctx.createLinearGradient(-R, -R, R, R);
  lid.addColorStop(0, 'rgba(255,255,255,0.75)');
  lid.addColorStop(1, 'rgba(200,220,235,0.35)');
  ctx.fillStyle = lid;
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,180,200,0.9)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.scale(1, k);
  hexPath(ctx, R, 0);
  ctx.strokeStyle = 'rgba(120,40,0,0.5)';
  ctx.lineWidth = Math.max(1, width * 0.015);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ---------- the assembled top: eraser with the pencil lead poking out underneath ----------
export function drawTopSide(ctx, eraserId, leadId, width) {
  const L = LEAD_ART[leadId];
  const stubH = width * 0.5, stubW = width * 0.12;
  const baseY = width * 0.14;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, baseY + stubH + 2, width * 0.3, width * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  if (L) {
    const P = LEAD_PRINT[leadId] || { pattern: 'solid' };
    const bh = stubH * 0.45;
    // hex barrel stub: three facets
    const fw = stubW / 3;
    [[0, 0.2], [1, 0], [2, -0.2]].forEach(([k, amt]) => {
      const col = P.pattern === 'facets' && k !== 1 ? L.stripe : L.barrel;
      ctx.fillStyle = shade(col, amt);
      ctx.fillRect(-stubW / 2 + k * fw, baseY - 4, fw + 0.5, bh);
    });
    if (P.pattern === 'lines') {
      ctx.fillStyle = L.stripe;
      ctx.fillRect(-stubW / 2 + fw - 1, baseY - 4, 2, bh);
      ctx.fillRect(-stubW / 2 + fw * 2 - 1, baseY - 4, 2, bh);
    }
    // wood cone
    ctx.beginPath();
    ctx.moveTo(-stubW / 2, baseY + bh - 4);
    ctx.lineTo(stubW / 2, baseY + bh - 4);
    ctx.lineTo(stubW * 0.12, baseY + stubH * 0.88);
    ctx.lineTo(-stubW * 0.12, baseY + stubH * 0.88);
    ctx.closePath();
    const wg = ctx.createLinearGradient(-stubW / 2, 0, stubW / 2, 0);
    wg.addColorStop(0, '#f6dcb2'); wg.addColorStop(0.6, WOOD); wg.addColorStop(1, WOOD_DARK);
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-stubW * 0.12, baseY + stubH * 0.88);
    ctx.lineTo(stubW * 0.12, baseY + stubH * 0.88);
    ctx.lineTo(0, baseY + stubH);
    ctx.closePath();
    ctx.fillStyle = GRAPHITE;
    ctx.fill();
  }
  drawEraserSide(ctx, eraserId, width);
}
