// Little looping animations for "How to play". Every demo uses the same top, so players
// learn one prop doing five things. drawDemo returns the keys that are "pressed" this frame.
import { drawEraserTop, drawLeadTop, drawTopSide } from './art.js';

export const DEMO_PROP = { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' };

export const DEMOS = [
  { id: 'place', title: '1 · Place', text: 'Slide your top along your side of the rim before the countdown ends.', touch: 'Drag your top along the rim.' },
  { id: 'twist', title: '2 · Twist', text: 'Like spinning it between two thumbs: alternate your two keys as fast as you can.', touch: 'Flick two thumbs past each other, up and down.' },
  { id: 'release', title: '3 · Let go', text: 'Let go when the ring is tight for a PERFECT release: no wobble, extra spin.', touch: 'Lift both thumbs when the ring is tight.' },
  { id: 'steer', title: '4 · Steer', text: 'Nudge your top around the arena. Every nudge costs a little health.', touch: 'Drag anywhere on your side like a joystick.' },
  { id: 'ability', title: '5 · Comeback', text: 'At 30% health your ability unlocks. Fire it once to turn the fight.', touch: 'Tap the big ability button when it lights up.' },
];

const HAND = '"Kalam", "Comic Sans MS", cursive';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const BLUE = '#2f5fd0';

function keycap(g, x, y, label, pressed, w = 34) {
  const h = 30, d = pressed ? 1 : 4;
  g.fillStyle = '#1f2a44';
  g.beginPath();
  g.roundRect ? g.roundRect(x, y + 4, w, h, 6) : g.rect(x, y + 4, w, h);
  g.fill();
  g.fillStyle = pressed ? '#ffe066' : '#ffffff';
  g.beginPath();
  g.roundRect ? g.roundRect(x, y + 4 - d, w, h, 6) : g.rect(x, y + 4 - d, w, h);
  g.fill();
  g.strokeStyle = '#1f2a44';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = '#1f2a44';
  g.font = `700 ${label.length > 2 ? 11 : 14}px ${SANS}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, x + w / 2, y + 4 - d + h / 2 + 1);
}

function keyRow(g, w, h, keys, pressed) {
  const widths = keys.map((k) => (k.length > 2 ? 64 : 34));
  const total = widths.reduce((a, b) => a + b, 0) + (keys.length - 1) * 8;
  let x = (w - total) / 2;
  keys.forEach((k, i) => { keycap(g, x, h - 40, k, pressed.includes(k), widths[i]); x += widths[i] + 8; });
}

function thumb(g, x, y, s, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
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

function miniArena(g, cx, cy, R) {
  const bowl = g.createRadialGradient(cx - R * 0.25, cy - R * 0.3, 2, cx, cy, R);
  bowl.addColorStop(0, '#f8fafc');
  bowl.addColorStop(0.6, '#cfd5db');
  bowl.addColorStop(1, '#8f99a3');
  g.beginPath();
  g.arc(cx, cy, R + 5, 0, Math.PI * 2);
  g.fillStyle = '#aab3bd';
  g.fill();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fillStyle = bowl;
  g.fill();
}

function propTop(g, x, y, r, spin, t) {
  g.beginPath();
  g.ellipse(x + 2, y + 3, r * 1.05, r * 0.95, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.fill();
  g.save();
  g.translate(x, y);
  g.rotate(t * spin);
  if (spin > 6) {
    g.globalAlpha = 0.35;
    g.beginPath();
    g.arc(0, 0, r * 1.1, 0, Math.PI * 2);
    g.fillStyle = '#7fa8d6';
    g.fill();
    g.globalAlpha = 1;
  }
  drawEraserTop(g, DEMO_PROP.eraserId, r);
  drawLeadTop(g, DEMO_PROP.leadId, r, false);
  g.restore();
}

function caption(g, text, x, y, color = '#22a34a') {
  g.font = `800 18px ${HAND}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 5;
  g.strokeStyle = '#fff';
  g.strokeText(text, x, y);
  g.fillStyle = color;
  g.fillText(text, x, y);
}

export function drawDemo(g, id, w, h, t, mode = 'keys') {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#fbf6ea';
  g.fillRect(0, 0, w, h);
  const ah = mode === 'keys' ? h - 46 : h; // animation area
  const cx = w / 2, cy = ah / 2;
  let pressed = [];

  if (id === 'place') {
    const R = ah / 2 - 8;
    miniArena(g, cx, cy, R);
    g.setLineDash([4, 4]);
    g.strokeStyle = BLUE;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, R * 0.8, Math.PI - 1.05, Math.PI + 1.05);
    g.stroke();
    g.setLineDash([]);
    const off = Math.sin(t * 1.8) * 0.9;
    const a = Math.PI + off;
    const x = cx + Math.cos(a) * R * 0.8, y = cy + Math.sin(a) * R * 0.8;
    propTop(g, x, y, R * 0.16, 0, t);
    const moving = Math.cos(t * 1.8);
    pressed = [moving > 0 ? 'D' : 'A'];
    if (mode === 'touch') thumb(g, x + 10, y + 14, 26, 0.95);
    else keyRow(g, w, h, ['A', 'D'], pressed);
  } else if (id === 'twist') {
    const phase = Math.floor(t * 6) % 2;
    pressed = [phase ? 'D' : 'A'];
    const size = Math.min(w * 0.42, ah * 0.85);
    const k = Math.sin(t * 6 * Math.PI);
    g.save();
    g.translate(cx, cy - size * 0.12);
    g.rotate(k * 0.06);
    drawTopSide(g, DEMO_PROP.eraserId, DEMO_PROP.leadId, size);
    g.restore();
    thumb(g, cx - size * 0.62, cy - size * 0.05 + k * 12, 30);
    thumb(g, cx + size * 0.62, cy - size * 0.05 - k * 12, 30);
    // spin gauge filling up
    const fill = (t % 2.4) / 2.4;
    g.fillStyle = 'rgba(31,42,68,0.15)';
    g.fillRect(16, 12, 10, ah - 24);
    g.fillStyle = BLUE;
    g.fillRect(16, 12 + (ah - 24) * (1 - fill), 10, (ah - 24) * fill);
    if (mode === 'keys') keyRow(g, w, h, ['A', 'D'], pressed);
  } else if (id === 'release') {
    const T = t % 2.4;
    const R = ah / 2 - 8;
    miniArena(g, cx, cy, R);
    const released = T > 1.6;
    const ring = (1 - Math.cos((2 * Math.PI * Math.min(T, 1.6)) / 0.8)) / 2;
    if (!released) {
      g.beginPath();
      g.arc(cx, cy, R * 0.2 * (1.4 + ring * 1.4), 0, Math.PI * 2);
      g.strokeStyle = ring < 0.15 ? '#22c55e' : 'rgba(40,40,60,0.6)';
      g.lineWidth = ring < 0.15 ? 4 : 2;
      g.stroke();
      if (mode === 'touch') { thumb(g, cx - R * 0.55, cy, 24); thumb(g, cx + R * 0.55, cy, 24); }
    } else if (mode === 'touch') {
      const up = Math.min(1, (T - 1.6) / 0.4);
      thumb(g, cx - R * 0.55, cy - up * 30, 24, 1 - up);
      thumb(g, cx + R * 0.55, cy - up * 30, 24, 1 - up);
    }
    propTop(g, cx, cy, R * 0.2, released ? 20 : 4, t);
    if (T > 1.55 && T < 1.75) pressed = ['W'];
    if (released) caption(g, 'PERFECT!', cx, 18);
    if (mode === 'keys') keyRow(g, w, h, ['W'], pressed);
  } else if (id === 'steer') {
    const R = ah / 2 - 8;
    miniArena(g, cx, cy, R);
    const px = Math.sin(t * 1.4) * R * 0.45, py = Math.sin(t * 2.8) * R * 0.28;
    const vx = Math.cos(t * 1.4), vy = Math.cos(t * 2.8) * 1.1;
    propTop(g, cx + px, cy + py, R * 0.17, 18, t);
    if (Math.abs(vx) > Math.abs(vy)) pressed = [vx > 0 ? 'D' : 'A']; else pressed = [vy > 0 ? 'S' : 'W'];
    if (mode === 'touch') {
      const jx = w - 46, jy = ah - 46, m = Math.hypot(vx, vy) || 1;
      g.beginPath(); g.arc(jx, jy, 28, 0, Math.PI * 2); g.fillStyle = 'rgba(31,42,68,0.12)'; g.fill();
      g.beginPath(); g.arc(jx + (vx / m) * 16, jy + (vy / m) * 16, 12, 0, Math.PI * 2); g.fillStyle = BLUE; g.fill();
      thumb(g, jx + (vx / m) * 16, jy + (vy / m) * 16 + 10, 20, 0.9);
    } else keyRow(g, w, h, ['W', 'A', 'S', 'D'], pressed);
  } else if (id === 'ability') {
    const T = t % 5;
    const R = ah / 2 - 8;
    miniArena(g, cx, cy + 8, R - 8);
    const health = T < 3 ? 1 - (T / 3) * 0.72 : 0.28;
    const unlocked = health <= 0.3;
    const fired = T > 3.6;
    // mini health bar
    const bw = w * 0.6, bx = (w - bw) / 2, by = 8;
    g.fillStyle = '#161616';
    g.fillRect(bx - 2, by - 2, bw + 4, 14);
    g.fillStyle = '#3b1010';
    g.fillRect(bx, by, bw, 10);
    g.fillStyle = unlocked ? '#ff4d4d' : '#ffc531';
    g.fillRect(bx, by, bw * health, 10);
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(bx + bw * 0.3 - 1, by, 2, 10);
    const tx = cx, ty = cy + 8;
    if (unlocked && !fired) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 9);
      g.beginPath();
      g.arc(tx, ty, R * (0.32 + pulse * 0.06), 0, Math.PI * 2);
      g.fillStyle = 'rgba(71,85,105,0.25)';
      g.fill();
    }
    propTop(g, tx, ty, R * 0.18, 10, t);
    if (fired) {
      g.beginPath();
      g.arc(tx, ty, R * 0.36, 0, Math.PI * 2);
      g.fillStyle = 'rgba(150,180,255,0.35)';
      g.fill();
      g.strokeStyle = 'rgba(160,190,255,0.95)';
      g.lineWidth = 2;
      g.stroke();
      caption(g, '🛡 Shield up!', cx, ah - 14, '#475569');
    } else if (unlocked) caption(g, 'READY!', cx, ah - 14, '#d97706');
    if (T > 3.5 && T < 3.75) pressed = ['Space'];
    if (mode === 'touch') {
      const bxp = w - 34, byp = ah - 34;
      g.beginPath();
      g.arc(bxp, byp, 22, 0, Math.PI * 2);
      g.fillStyle = unlocked && !fired ? '#475569' : 'rgba(255,255,255,0.9)';
      g.fill();
      g.strokeStyle = BLUE;
      g.lineWidth = 3;
      g.stroke();
      g.font = `700 18px ${SANS}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = unlocked && !fired ? '#fff' : '#1f2a44';
      g.fillText(unlocked ? '🛡' : '🔒', bxp, byp + 1);
      if (pressed.length) thumb(g, bxp + 4, byp + 8, 20, 0.9);
    } else keyRow(g, w, h, ['Space'], pressed);
  }
  return pressed;
}
