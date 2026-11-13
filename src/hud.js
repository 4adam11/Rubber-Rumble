// Fighting-game health bars. Health is spin: full at launch, drained by time and hits.
import { THALI_OUTER } from './layout.js';
import { drawEraserTop } from './art.js';
import { ABILITIES, UNLOCK_AT } from './abilities.js';

const HAND = '"Kalam", "Comic Sans MS", cursive';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createHud() {
  const st = [0, 1].map(() => ({ shown: 1, ghost: 1, hold: 0, flash: 0, shake: 0 }));

  function update(dt, healths) {
    st.forEach((s, i) => {
      const h = healths?.[i];
      if (h == null) { s.shown = s.ghost = 1; return; }
      const target = clamp01(h);
      s.shown += (target - s.shown) * Math.min(1, dt * 14);
      if (s.ghost < s.shown) s.ghost = s.shown;
      if (s.hold > 0) s.hold -= dt;
      else if (s.ghost > s.shown) s.ghost = Math.max(s.shown, s.ghost - dt * 0.55);
      s.flash = Math.max(0, s.flash - dt);
      s.shake = Math.max(0, s.shake - dt * 30);
    });
  }

  function hit(i, amount) {
    const s = st[i];
    s.hold = 0.5;
    s.flash = 0.22;
    s.shake = Math.min(8, 2 + amount / 25);
  }

  function reset() { st.forEach((s) => { s.shown = s.ghost = 1; s.hold = s.flash = s.shake = 0; }); }

  function slab(ctx, x, y, w, h, skew, mirror) {
    // a slanted bar, slant pointing toward the centre of the screen
    ctx.beginPath();
    if (!mirror) {
      ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - skew, y + h); ctx.lineTo(x, y + h);
    } else {
      ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + skew, y + h);
    }
    ctx.closePath();
  }

  function block(ctx, i, x, y, w, p, clock, compact) {
    const s = st[i];
    const mirror = i === 1;
    const shakeX = s.shake ? (Math.random() - 0.5) * s.shake : 0;
    const port = compact ? 38 : 48;
    const barH = compact ? 16 : 20;
    const skew = barH * 0.6;
    ctx.save();
    ctx.translate(shakeX, 0);

    // portrait
    const px = mirror ? x + w - port : x;
    ctx.fillStyle = '#161616';
    ctx.fillRect(px - 2, y - 2, port + 4, port + 4);
    const pg = ctx.createLinearGradient(px, y, px, y + port);
    pg.addColorStop(0, p.color);
    pg.addColorStop(1, shadeHex(p.color, -0.35));
    ctx.fillStyle = pg;
    ctx.fillRect(px, y, port, port);
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, y, port, port);
    ctx.clip();
    ctx.translate(px + port / 2, y + port / 2);
    ctx.rotate(clock * (p.health == null ? 0.6 : 2.5 * Math.max(0.15, s.shown)));
    drawEraserTop(ctx, p.eraserId, port * 0.32);
    ctx.restore();
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 0.75, y + 0.75, port - 1.5, port - 1.5);

    // bar
    const bx = mirror ? x : x + port + 6;
    const bw = w - port - 6;
    const by = y + 2;
    slab(ctx, bx - 2, by - 2, bw + 4, barH + 4, skew, mirror);
    ctx.fillStyle = '#161616';
    ctx.fill();
    slab(ctx, bx, by, bw, barH, skew, mirror);
    ctx.fillStyle = '#3b1010';
    ctx.fill();
    ctx.save();
    slab(ctx, bx, by, bw, barH, skew, mirror);
    ctx.clip();
    // damage trail (red), then health (yellow, red when low); both drain toward the centre
    const fillFrom = (frac, style) => {
      const fw = bw * frac;
      ctx.fillStyle = style;
      if (!mirror) ctx.fillRect(bx, by, fw, barH); else ctx.fillRect(bx + bw - fw, by, fw, barH);
    };
    fillFrom(s.ghost, '#d62828');
    const low = s.shown <= UNLOCK_AT + 0.001;
    let grad;
    if (low) {
      const pulse = 0.5 + 0.5 * Math.sin(clock * 10);
      grad = ctx.createLinearGradient(0, by, 0, by + barH);
      grad.addColorStop(0, `rgb(255,${Math.round(90 + 60 * pulse)},${Math.round(60 * pulse)})`);
      grad.addColorStop(1, '#a11212');
    } else {
      grad = ctx.createLinearGradient(0, by, 0, by + barH);
      grad.addColorStop(0, '#fff27a');
      grad.addColorStop(0.55, '#ffc531');
      grad.addColorStop(1, '#e08a00');
    }
    fillFrom(s.shown, grad);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(bx, by + 1, bw, barH * 0.28);
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${s.flash * 3})`;
      ctx.fillRect(bx, by, bw, barH);
    }
    // ability notch at 30%
    const nx = mirror ? bx + bw - bw * UNLOCK_AT : bx + bw * UNLOCK_AT;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(nx - 1, by, 2, barH);
    ctx.restore();
    slab(ctx, bx, by, bw, barH, skew, mirror);
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // name + medals
    const ny = by + barH + (compact ? 13 : 16);
    ctx.font = `700 ${compact ? 14 : 17}px ${HAND}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = mirror ? 'right' : 'left';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    const nameX = mirror ? bx + bw - 4 : bx + 4;
    ctx.strokeText(p.name, nameX, ny);
    ctx.fillStyle = '#fff';
    ctx.fillText(p.name, nameX, ny);
    const nameW = ctx.measureText(p.name).width;
    for (let k = 0; k < 2; k++) {
      const mx = mirror ? nameX - nameW - 14 - k * 16 : nameX + nameW + 14 + k * 16;
      ctx.beginPath();
      ctx.arc(mx, ny, 6, 0, Math.PI * 2);
      ctx.fillStyle = k < p.wins ? '#ffd23f' : 'rgba(0,0,0,0.45)';
      ctx.fill();
      ctx.strokeStyle = '#161616';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (k < p.wins) {
        ctx.fillStyle = '#7a4b00';
        ctx.font = `700 9px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText('★', mx, ny + 0.5);
        ctx.font = `700 ${compact ? 14 : 17}px ${HAND}`;
        ctx.textAlign = mirror ? 'right' : 'left';
      }
    }

    // ability chip
    if (p.ability) {
      const a = ABILITIES[p.ability.kind];
      const cy = ny + (compact ? 17 : 21);
      let label, bg, fg;
      if (p.ability.used) { label = `${a.icon} ${a.name} · used`; bg = 'rgba(0,0,0,0.35)'; fg = 'rgba(255,255,255,0.55)'; }
      else if (p.ability.unlocked) {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 9);
        label = `${a.icon} ${a.name} READY${p.ability.key ? ` [${p.ability.key}]` : '!'}`;
        bg = shadeHex(a.color, -0.15 + 0.15 * pulse);
        fg = '#fff';
      } else { label = `🔒 ${a.icon} ${a.name} · unlocks at 30%`; bg = 'rgba(0,0,0,0.42)'; fg = 'rgba(255,255,255,0.8)'; }
      ctx.font = `700 ${compact ? 11 : 12}px ${SANS}`;
      const tw = Math.min(ctx.measureText(label).width, bw);
      const chipW = tw + 16, chipH = compact ? 18 : 20;
      const cx0 = mirror ? bx + bw - chipW : bx;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(cx0, cy - chipH / 2, chipW, chipH, chipH / 2) : ctx.rect(cx0, cy - chipH / 2, chipW, chipH);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.textAlign = 'left';
      ctx.fillText(label, cx0 + 8, cy + 0.5, bw - 16);
    }
    ctx.restore();
  }

  function timer(ctx, x, y, secs, compact) {
    const r = compact ? 20 : 24;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      k ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#161616';
    ctx.fill();
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `800 ${compact ? 18 : 22}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = secs <= 10 ? '#ff5a5a' : '#fff';
    ctx.fillText(secs == null ? '∞' : String(Math.max(0, Math.ceil(secs))), x, y + 1);
  }

  function draw(ctx, L, data, clock) {
    if (!data) return;
    const W = L.width;
    if (L.hud === 'top') {
      const compact = W < 520;
      const tw = compact ? 48 : 60;
      const bw = (W - 24 - tw) / 2;
      block(ctx, 0, 12, 12, bw, data.players[0], clock, compact);
      block(ctx, 1, W - 12 - bw, 12, bw, data.players[1], clock, compact);
      timer(ctx, W / 2, 12 + (compact ? 20 : 24), data.time, compact);
    } else {
      const R = THALI_OUTER * L.scale;
      const side = (W - 2 * R) / 2;
      const bw = Math.min(330, side - 32);
      block(ctx, 0, 16, 16, bw, data.players[0], clock, false);
      block(ctx, 1, W - 16 - bw, 16, bw, data.players[1], clock, false);
      timer(ctx, 16 + bw / 2, 16 + 110, data.time, false);
    }
  }

  return { update, hit, reset, draw, get state() { return st; } };
}

function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v + amt * 255))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
