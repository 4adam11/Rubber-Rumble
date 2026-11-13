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

// ---------- a whole pencil, lying flat, tip to the right ----------
export function drawPencil(ctx, id, x, y, len, th) {
  const L = LEAD_ART[id];
  if (!L) return;
  const tipLen = len * 0.16, endLen = len * 0.07;
  const bx0 = x + endLen, bx1 = x + len - tipLen;
  const top = y - th / 2;

  // barrel with three hex facets
  const facets = [[0, 0.32, 0.18], [0.32, 0.36, 0], [0.68, 0.32, -0.16]];
  for (const [f0, fh, amt] of facets) {
    ctx.fillStyle = shade(L.barrel, amt);
    ctx.fillRect(bx0, top + th * f0, bx1 - bx0, th * fh + 0.5);
  }
  ctx.fillStyle = L.stripe; // facet stripes (Nataraj red lines etc.)
  const sw = Math.max(1, th * (L.stripeW || 0.05));
  ctx.fillRect(bx0, top + th * 0.3 - sw / 2, bx1 - bx0, sw);
  ctx.fillRect(bx0, top + th * 0.68 - sw / 2, bx1 - bx0, sw);
  printBars(ctx, bx0 + (bx1 - bx0) * 0.35, top + th * 0.42, (bx1 - bx0) * 0.3, th * 0.12, L.label, 1);

  // end
  if (L.end === 'ferrule') {
    ctx.fillStyle = L.endColor;
    ctx.fillRect(x, top, endLen, th);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 1; i < 4; i++) ctx.fillRect(x + (endLen * i) / 4, top, 1, th);
  } else {
    ctx.fillStyle = L.endColor;
    rr(ctx, x, top, endLen + 2, th, th * 0.18);
    ctx.fill();
    if (L.end === 'cap') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + 2, top + th * 0.15, endLen - 2, th * 0.18);
    }
  }

  // sharpened wood cone with a scalloped edge
  ctx.beginPath();
  ctx.moveTo(bx1, top);
  for (let i = 0; i <= 4; i++) ctx.quadraticCurveTo(bx1 + tipLen * 0.12, top + (th * (i + 0.5)) / 5, bx1, top + (th * (i + 1)) / 5);
  ctx.lineTo(x + len - tipLen * 0.3, y + th * 0.1);
  ctx.lineTo(x + len - tipLen * 0.3, y - th * 0.1);
  ctx.closePath();
  ctx.fillStyle = WOOD;
  ctx.fill();
  ctx.fillStyle = 'rgba(160,110,50,0.25)';
  ctx.beginPath();
  ctx.moveTo(bx1, y);
  ctx.lineTo(x + len - tipLen * 0.3, y + th * 0.1);
  ctx.lineTo(bx1, top + th);
  ctx.fill();
  // graphite tip
  ctx.beginPath();
  ctx.moveTo(x + len - tipLen * 0.3, y - th * 0.1);
  ctx.lineTo(x + len, y);
  ctx.lineTo(x + len - tipLen * 0.3, y + th * 0.1);
  ctx.closePath();
  ctx.fillStyle = GRAPHITE;
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx0, top, bx1 - bx0, th);
}

// ---------- erasers, 3/4 view (menus, intro) ----------
export function drawEraserSide(ctx, id, width) {
  const a = ERASER_ART[id];
  if (!a) return;
  if (a.shape === 'hex') return neonHexSide(ctx, a, width);
  const w = width, h = width * 0.34, d = width * 0.2; // front face w×h, depth skew d
  const x = -w / 2 - d / 2, y = -h / 2 + d / 2;
  const round = a.shape === 'pill';

  // top face
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + d, y - d);
  ctx.lineTo(x + d + w, y - d);
  ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fillStyle = shade(a.rubber, 0.05);
  ctx.fill();
  // right face
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w + d, y - d);
  ctx.lineTo(x + w + d, y - d + h);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fillStyle = shade(a.rubber, -0.14);
  ctx.fill();
  // front face
  if (round) rr(ctx, x, y, w, h, h / 2); else rr(ctx, x, y, w, h, h * 0.12);
  ctx.fillStyle = shade(a.rubber, -0.04);
  ctx.fill();

  // sleeve wraps top + front + side
  if (a.sleeve !== 'fruit') {
    const s0 = x + w * 0.38, s1 = x + w;
    const sleeveCol = a.base;
    ctx.fillStyle = shade(sleeveCol, 0.06);
    ctx.beginPath();
    ctx.moveTo(s0, y); ctx.lineTo(s0 + d, y - d); ctx.lineTo(s1 + d, y - d); ctx.lineTo(s1, y);
    ctx.fill();
    ctx.fillStyle = shade(sleeveCol, -0.1);
    ctx.beginPath();
    ctx.moveTo(s1, y); ctx.lineTo(s1 + d, y - d); ctx.lineTo(s1 + d, y - d + h); ctx.lineTo(s1, y + h);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(s0, y, s1 - s0, h);
    ctx.clip();
    ctx.translate(s0 + (s1 - s0) / 2, y + h / 2);
    // reuse the top-down sleeve art, stretched over the front face
    sleeveTop(ctx, a, (s1 - s0) / 0.62, h);
    ctx.restore();
  } else {
    ctx.fillStyle = a.accent;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.ellipse(x + w * (0.12 + i * 0.11), y + h * (i % 2 ? 0.35 : 0.65), w * 0.012, w * 0.02, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(30,30,40,0.4)';
  ctx.lineWidth = Math.max(1, width * 0.012);
  if (round) rr(ctx, x, y, w, h, h / 2); else rr(ctx, x, y, w, h, h * 0.12);
  ctx.stroke();
}

function neonHexSide(ctx, a, width) {
  const R = width * 0.42, k = 0.45, th = width * 0.16; // squashed hexagon prism
  ctx.save();
  // sides
  ctx.fillStyle = shade(a.base, -0.12);
  ctx.beginPath();
  ctx.moveTo(-R, 0); ctx.lineTo(-R, th); ctx.lineTo(-R / 2, R * k + th); ctx.lineTo(R / 2, R * k + th); ctx.lineTo(R, th); ctx.lineTo(R, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-R, th * 0.45, R * 2, th * 0.15);
  // top
  ctx.scale(1, k);
  hexPath(ctx, R, 0);
  ctx.fillStyle = a.base;
  ctx.fill();
  hexPath(ctx, R * 0.82, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const cols = ['#00b3e6', '#ff2d87', '#ffb000', '#22c55e'];
  cols.forEach((c, i) => {
    ctx.fillStyle = c;
    rr(ctx, -R * 0.45 + i * R * 0.24, -R * 0.15, R * 0.18, R * 0.3, R * 0.06);
    ctx.fill();
  });
  hexPath(ctx, R, 0);
  ctx.strokeStyle = 'rgba(120,40,0,0.5)';
  ctx.lineWidth = Math.max(1, width * 0.02);
  ctx.stroke();
  ctx.restore();
}

// ---------- the assembled top: eraser with the pencil lead poking out underneath ----------
export function drawTopSide(ctx, eraserId, leadId, width) {
  const L = LEAD_ART[leadId];
  const stubH = width * 0.5, stubW = width * 0.12;
  const baseY = width * 0.14;
  // shadow on the desk
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, baseY + stubH + 2, width * 0.3, width * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  if (L) {
    // barrel stub
    ctx.fillStyle = L.barrel;
    ctx.fillRect(-stubW / 2, baseY - 4, stubW, stubH * 0.45);
    ctx.fillStyle = L.stripe;
    ctx.fillRect(-stubW * 0.1, baseY - 4, Math.max(1, stubW * 0.18), stubH * 0.45);
    // wood cone
    ctx.beginPath();
    ctx.moveTo(-stubW / 2, baseY + stubH * 0.45 - 4);
    ctx.lineTo(stubW / 2, baseY + stubH * 0.45 - 4);
    ctx.lineTo(stubW * 0.12, baseY + stubH * 0.88);
    ctx.lineTo(-stubW * 0.12, baseY + stubH * 0.88);
    ctx.closePath();
    ctx.fillStyle = WOOD;
    ctx.fill();
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(stubW * 0.05, baseY + stubH * 0.45 - 4, stubW * 0.2, stubH * 0.3);
    // graphite point
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
