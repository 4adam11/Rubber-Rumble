// The pre-fight VS sequence. p runs 0 → 1 over INTRO_SECONDS.
import { drawTopSide } from './art.js';
import { ABILITIES } from './abilities.js';

export const INTRO_SECONDS = 3.0;

const HAND = '"Kalam", "Comic Sans MS", cursive';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const ease = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const back = (t) => { t = Math.min(1, Math.max(0, t)); const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const seg = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));

function outlined(ctx, text, x, y, fill, stroke, lw) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export function drawIntro(ctx, L, p, data, clock) {
  const W = L.width, H = L.height;
  const portrait = H > W;
  const outro = seg(p, 0.86, 1);

  // darken the desk
  ctx.fillStyle = `rgba(10,8,20,${0.72 * (1 - outro)})`;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 2; i++) {
    const pl = data.players[i];
    const inT = back(seg(p, 0.02 + i * 0.06, 0.24 + i * 0.06));
    const out = ease(outro);
    ctx.save();
    // the panel: a slanted slab in the player's colour, sliding in from its own side
    let ox, oy;
    if (!portrait) {
      ox = (i === 0 ? -1 : 1) * W * (1 - inT + out) * 0.6;
      oy = 0;
    } else {
      ox = 0;
      oy = (i === 0 ? 1 : -1) * H * (1 - inT + out) * 0.6;
    }
    ctx.translate(ox, oy);
    ctx.beginPath();
    if (!portrait) {
      const x0 = i === 0 ? 0 : W / 2 + 40, x1 = i === 0 ? W / 2 - 40 : W;
      if (i === 0) { ctx.moveTo(x0, 0); ctx.lineTo(x1 + 70, 0); ctx.lineTo(x1 - 10, H); ctx.lineTo(x0, H); }
      else { ctx.moveTo(x0 + 10, 0); ctx.lineTo(x1, 0); ctx.lineTo(x1, H); ctx.lineTo(x0 - 70, H); }
    } else {
      const y0 = i === 0 ? H / 2 + 30 : 0, y1 = i === 0 ? H : H / 2 - 30;
      if (i === 0) { ctx.moveTo(0, y0 + 50); ctx.lineTo(W, y0 - 20); ctx.lineTo(W, y1); ctx.lineTo(0, y1); }
      else { ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.lineTo(W, y1 - 50); ctx.lineTo(0, y1 + 20); }
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, shade(pl.color, i === 0 ? 0.08 : -0.25));
    g.addColorStop(1, shade(pl.color, i === 0 ? -0.25 : 0.08));
    ctx.fillStyle = g;
    ctx.fill();
    // speed streaks
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 14; k++) {
      const yy = ((k * 97 + clock * 400 * (i ? -1 : 1)) % (H + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(-50, yy);
      ctx.lineTo(W + 50, yy - 120);
      ctx.stroke();
    }
    ctx.restore();

    // the fighter: assembled top, bobbing
    const cx = !portrait ? (i === 0 ? W * 0.25 : W * 0.75) : W / 2;
    const cy = !portrait ? H * 0.42 : (i === 0 ? H * 0.74 : H * 0.2);
    const size = Math.min(!portrait ? W * 0.22 : W * 0.42, 220);
    ctx.save();
    ctx.translate(cx, cy + Math.sin(clock * 3 + i) * 5);
    ctx.rotate(Math.sin(clock * 2.4 + i) * 0.06);
    drawTopSide(ctx, pl.eraserId, pl.leadId, size, pl.skin);
    ctx.restore();

    // name + combo + ability
    const ty = !portrait ? H * 0.42 + size * 0.75 : (i === 0 ? H * 0.74 + size * 0.62 : H * 0.2 + size * 0.62);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.min(46, size * 0.24)}px ${HAND}`;
    outlined(ctx, pl.name.toUpperCase(), cx, ty, '#fff', 'rgba(0,0,0,0.75)', 6);
    ctx.font = `700 ${Math.min(17, size * 0.09)}px ${SANS}`;
    outlined(ctx, pl.subtitle, cx, ty + Math.min(30, size * 0.17), '#ffe9a8', 'rgba(0,0,0,0.6)', 4);
    const a = ABILITIES[pl.ability];
    if (a) {
      ctx.font = `700 ${Math.min(15, size * 0.08)}px ${SANS}`;
      outlined(ctx, `${a.icon} ${a.name}`, cx, ty + Math.min(52, size * 0.3), '#fff', 'rgba(0,0,0,0.6)', 4);
    }
    ctx.restore();
  }

  // VS slam
  const vsT = seg(p, 0.3, 0.42);
  if (vsT > 0 && outro < 1) {
    const sc = vsT < 1 ? 3 - 2 * ease(vsT) : 1 + Math.sin(clock * 6) * 0.03;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    ctx.rotate(-0.12);
    ctx.globalAlpha = Math.min(1, vsT * 3) * (1 - outro);
    ctx.font = `900 ${Math.min(120, Math.min(W, H) * 0.24)}px ${HAND}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlined(ctx, 'VS', 0, 0, '#ffd23f', '#161616', 14);
    ctx.restore();
    if (vsT > 0.9 && vsT < 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  // arena + round caption
  const capT = ease(seg(p, 0.48, 0.62));
  if (capT > 0) {
    ctx.save();
    ctx.globalAlpha = capT * (1 - outro);
    const y = !portrait ? H - 46 : H / 2 + (W < 420 ? 64 : 80);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.min(26, W * 0.06)}px ${HAND}`;
    outlined(ctx, `${data.round} · ${data.arenaName}`, W / 2, y, '#fff', 'rgba(0,0,0,0.7)', 6);
    ctx.font = `800 12px ${SANS}`;
    outlined(ctx, data.arenaLevel.toUpperCase(), W / 2, y + 22, '#ffd23f', 'rgba(0,0,0,0.7)', 4);
    ctx.restore();
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v + amt * 255))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
