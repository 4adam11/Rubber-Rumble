// The phone twist pad: two grips stacked one above the other at the bottom of the screen.
// Put a thumb on each and swipe them past each other, back and forth, to spin the top up.
// Pure geometry + canvas drawing, no DOM.
import { THALI_OUTER } from './layout.js';

export const PAD = { ROW_H: 50, GAP: 12, GRIP_W: 66, MAX_W: 340, STROKE_PX: 40 };
export const PAD_H = PAD.ROW_H * 2 + PAD.GAP;
export const HUD_BUTTONS_W = 66; // the pause / sound column on the right edge

// Where player i's pad sits. Local coords: x right / y down from the pad centre,
// rotated half a turn (flip −1) for the player across the table in portrait 2P.
export function twistPad(i, L, players) {
  const h = PAD_H;
  const rimR = THALI_OUTER * L.scale;
  if (L.rotate) {
    const w = Math.min(PAD.MAX_W, L.width - 32);
    if (players === 2 && i === 1) {
      // across the table, at the top: stay clear of the pause / sound buttons down the right edge
      const w2 = Math.min(PAD.MAX_W, L.width - 32 - HUD_BUTTONS_W);
      return { cx: 16 + w2 / 2, cy: 12 + h / 2, w: w2, h, flip: -1 };
    }
    const below = L.height - (L.cy + rimR);
    const cy = below >= h + 24 ? L.cy + rimR + below / 2 : L.height - 12 - h / 2;
    return { cx: L.width / 2, cy, w, h, flip: 1 };
  }
  const col = L.cx - rimR; // free space beside the thali
  const w = Math.min(280, Math.max(190, col - 28));
  const right = players === 2 && i === 1;
  const cx = col - 16 >= w
    ? (right ? L.width - col / 2 : col / 2)
    : (right ? L.width - 14 - w / 2 : 14 + w / 2);
  return { cx, cy: L.height - 14 - h / 2, w, h, flip: 1 };
}

export function toPad(pad, x, y) {
  return { x: (x - pad.cx) * pad.flip, y: (y - pad.cy) * pad.flip };
}

// which grip a touch at screen (x, y) grabs: 'top', 'bottom' or null
export function gripAt(pad, x, y) {
  const p = toPad(pad, x, y);
  if (Math.abs(p.x) > pad.w / 2 + 16 || Math.abs(p.y) > pad.h / 2 + 16) return null;
  return p.y < 0 ? 'top' : 'bottom';
}

// a grip's drawn position along its track (local x), kept inside the track
export function gripX(pad, x) {
  const lim = pad.w / 2 - PAD.GRIP_W / 2 - 4;
  return Math.max(-lim, Math.min(lim, (x - pad.cx) * pad.flip));
}

export const rowY = (row) => (row === 'top' ? -1 : 1) * (PAD.GAP / 2 + PAD.ROW_H / 2);

function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function drawThumb(g, x, y, s, alpha = 1) {
  g.save();
  g.globalAlpha *= alpha;
  g.beginPath();
  g.ellipse(x, y, s * 0.55, s * 0.78, 0, 0, Math.PI * 2);
  g.fillStyle = '#f6c9a0';
  g.fill();
  g.strokeStyle = '#a8704a';
  g.lineWidth = 1.5;
  g.stroke();
  g.beginPath();
  g.ellipse(x, y - s * 0.38, s * 0.3, s * 0.22, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.fill();
  g.restore();
}

// a rubber grip: a chunky eraser-like pill with finger grooves
function drawGrip(g, x, y, color, held, arrow) {
  const gw = PAD.GRIP_W, gh = PAD.ROW_H - 6;
  g.save();
  g.translate(x, y);
  if (held) g.scale(1.07, 1.07);
  g.shadowColor = held ? color : 'rgba(0,0,0,0.35)';
  g.shadowBlur = held ? 16 : 6;
  g.shadowOffsetY = held ? 0 : 2;
  rr(g, -gw / 2, -gh / 2, gw, gh, gh / 2);
  g.fillStyle = color;
  g.fill();
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;
  rr(g, -gw / 2 + 6, -gh / 2 + 4, gw - 12, gh * 0.36, gh * 0.18);
  g.fillStyle = 'rgba(255,255,255,0.3)';
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 2;
  g.beginPath();
  for (const dx of [-13, -5, 3, 11]) { g.moveTo(dx + 1, -gh / 2 + 9); g.lineTo(dx + 1, gh / 2 - 7); }
  g.stroke();
  rr(g, -gw / 2, -gh / 2, gw, gh, gh / 2);
  g.strokeStyle = held ? '#fff' : 'rgba(255,255,255,0.75)';
  g.lineWidth = held ? 3 : 2;
  g.stroke();
  if (arrow) {
    g.fillStyle = '#fff';
    g.font = '900 18px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(arrow > 0 ? '▶' : '◀', arrow * (gw / 2 + 14), 1);
  }
  g.restore();
}

// st: { top, bottom } grip positions (local x, null when no thumb), flash 0..1 after each stroke
export function drawTwistPad(g, pad, st = {}, { color = '#2563eb', clock = 0, dim = false, label = true } = {}) {
  const { w, h } = pad;
  const R = PAD.ROW_H;
  const idle = st.top == null && st.bottom == null;
  const reach = w / 2 - PAD.GRIP_W / 2 - 8;
  const swing = Math.sin(clock * 5) * reach * 0.75;
  const goingRight = Math.cos(clock * 5) > 0 ? 1 : -1;
  g.save();
  g.translate(pad.cx, pad.cy);
  if (pad.flip < 0) g.rotate(Math.PI);
  if (dim) g.globalAlpha = 0.6;

  // backing plate
  g.shadowColor = 'rgba(0,0,0,0.25)';
  g.shadowBlur = 12;
  g.shadowOffsetY = 3;
  rr(g, -w / 2 - 8, -h / 2 - 8, w + 16, h + 16, 18);
  g.fillStyle = 'rgba(255,253,246,0.94)';
  g.fill();
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;
  g.lineWidth = 3;
  g.strokeStyle = color;
  g.stroke();

  const pos = {};
  for (const row of ['top', 'bottom']) {
    const yc = rowY(row);
    // a wooden-ruler track
    rr(g, -w / 2, yc - R / 2 + 6, w, R - 12, 10);
    const grd = g.createLinearGradient(0, yc - R / 2, 0, yc + R / 2);
    grd.addColorStop(0, '#f6e2b3');
    grd.addColorStop(1, '#d8b26a');
    g.fillStyle = grd;
    g.fill();
    g.strokeStyle = 'rgba(120,80,30,0.55)';
    g.lineWidth = 1.5;
    g.stroke();
    g.strokeStyle = 'rgba(90,60,20,0.45)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = -w / 2 + 10, n = 0; x < w / 2 - 6; x += 8, n++) {
      const len = n % 5 === 0 ? 9 : 5;
      g.moveTo(x, yc - R / 2 + 7);
      g.lineTo(x, yc - R / 2 + 7 + len);
    }
    g.stroke();
    const held = st[row] != null;
    const x = held ? st[row] : (row === 'top' ? swing : -swing);
    pos[row] = x;
    const dir = row === 'top' ? goingRight : -goingRight;
    drawGrip(g, x, yc, color, held, idle && !dim ? dir : 0);
    if (idle && !dim) drawThumb(g, x, yc + 4, 30, 0.55);
  }

  // graphite sparks where the grips rub past each other
  if (st.flash > 0) {
    const mx = (pos.top + pos.bottom) / 2;
    g.save();
    g.globalAlpha *= st.flash;
    g.strokeStyle = '#ffd23f';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + clock * 3;
      const r0 = 6, r1 = 6 + 18 * (1.2 - st.flash);
      g.moveTo(mx + Math.cos(a) * r0, Math.sin(a) * r0 * 0.6);
      g.lineTo(mx + Math.cos(a) * r1, Math.sin(a) * r1 * 0.6);
    }
    g.stroke();
    g.restore();
  }

  if (label && !dim) {
    const text = idle ? 'Swipe the grips past each other ⇄' : 'Faster! Back and forth!';
    g.font = '800 15px system-ui, sans-serif';
    const tw = g.measureText(text).width;
    if (tw > w + 12) g.font = `800 ${Math.max(10, Math.floor((15 * (w + 12)) / tw))}px system-ui, sans-serif`; // fit the pad
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 4;
    g.lineJoin = 'round';
    g.strokeStyle = '#fffdf6';
    g.strokeText(text, 0, -h / 2 - 20);
    g.fillStyle = color;
    g.fillText(text, 0, -h / 2 - 20);
  }
  g.restore();
}
