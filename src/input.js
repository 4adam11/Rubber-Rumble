// Touch / mouse / keyboard -> per-player intents.
// Pure helpers at the top; createInput touches the DOM.
import { screenToArena, screenToArenaVec, TOP_HUD } from './layout.js';
import { createPairStrokeDetector, createCircleStrokeDetector } from './launch.js';

export function playerForPoint(x, y, width, height, players) {
  if (players !== 2) return 0;
  if (height > width) return y >= height / 2 ? 0 : 1;
  return x < width / 2 ? 0 : 1;
}

export function createTouchTracker() {
  const touches = new Map();
  return {
    down(id, x, y, player) {
      if (this.touchesFor(player).length >= 2) return false;
      touches.set(id, { id, x, y, startX: x, startY: y, player, t0: performance.now?.() ?? 0 });
      return true;
    },
    move(id, x, y) {
      const t = touches.get(id);
      if (t) { t.x = x; t.y = y; }
    },
    up(id) { touches.delete(id); },
    has(id) { return touches.has(id); },
    get(id) { return touches.get(id); },
    touchesFor(player) { return [...touches.values()].filter((t) => t.player === player); },
    clear() { touches.clear(); },
  };
}

export const SPECIAL_R = 40;

// The big ability button: bottom corner of each player's own side, clear of the health bars.
export function specialButton(i, width, height, players) {
  const r = SPECIAL_R, m = 18;
  if (height > width) {
    if (players === 2 && i === 1) return { x: m + r, y: m + TOP_HUD + 10 + r, r };
    return { x: width - m - r, y: height - m - r, r };
  }
  if (players === 2 && i === 0) return { x: m + r, y: height - m - r, r };
  return { x: width - m - r, y: height - m - r, r };
}

const KEYMAP = [
  { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', release: 'KeyW', special: 'Space' },
  { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', release: 'ArrowUp', special: 'Enter' },
];
const GAME_KEYS = new Set(KEYMAP.flatMap((k) => Object.values(k)));

export function createInput(target, getLayout, opts = {}) {
  let players = opts.players || 1;
  let phase = 'menu';
  const held = new Set();
  const tracker = createTouchTracker();
  const fresh = () => ({ keyStrokes: [], strokes: [], release: false, special: false, placeAngle: null });
  let edge = [fresh(), fresh()];
  const pair = [createPairStrokeDetector(), createPairStrokeDetector()];
  const circle = [createCircleStrokeDetector(), createCircleStrokeDetector()];
  let mouse = null; // {x, y, startX, startY}
  const hadTouches = [0, 0];

  const mapsFor = (p) => (players === 1 && p === 0 ? [KEYMAP[0], KEYMAP[1]] : [KEYMAP[p]]);
  const anchor = (p) => opts.getAnchor?.(p) || null;
  const now = () => performance.now() / 1000;

  function onKeyDown(e) {
    if (e.code === 'Escape' || e.code === 'KeyP') { opts.onPause?.(); return; }
    if (phase === 'menu' || !GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    held.add(e.code);
    if (e.repeat) return;
    for (let p = 0; p < players; p++) {
      for (const k of mapsFor(p)) {
        if (phase === 'launch') {
          if (e.code === k.left) edge[p].keyStrokes.push('L');
          if (e.code === k.right) edge[p].keyStrokes.push('R');
          if (e.code === k.release) edge[p].release = true;
        } else if (phase === 'battle' && e.code === k.special) {
          edge[p].special = true;
        }
      }
    }
  }
  function onKeyUp(e) { held.delete(e.code); }
  function onBlur() { held.clear(); tracker.clear(); mouse = null; }

  function insideButton(p, x, y) {
    const L = getLayout();
    const b = specialButton(p, L.width, L.height, players);
    return Math.hypot(x - b.x, y - b.y) <= b.r + 6;
  }

  function onTouchStart(e) {
    if (phase === 'menu') return;
    e.preventDefault();
    const L = getLayout();
    for (const t of e.changedTouches) {
      const p = playerForPoint(t.clientX, t.clientY, L.width, L.height, players);
      if (phase === 'battle' && insideButton(p, t.clientX, t.clientY)) { edge[p].special = true; continue; }
      if (tracker.down(t.identifier, t.clientX, t.clientY, p)) {
        if (tracker.touchesFor(p).length === 2) pair[p].reset();
        circle[p].reset();
      }
    }
    for (let p = 0; p < 2; p++) hadTouches[p] = Math.max(hadTouches[p], tracker.touchesFor(p).length);
  }
  function onTouchMove(e) {
    if (phase === 'menu') return;
    e.preventDefault();
    for (const t of e.changedTouches) tracker.move(t.identifier, t.clientX, t.clientY);
    if (phase !== 'launch') return;
    const tNow = now();
    for (let p = 0; p < players; p++) {
      const ts = tracker.touchesFor(p);
      if (ts.length === 2) {
        const [a, b] = ts;
        const side = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y);
        const s = side ? pair[p].update(a.y, b.y, tNow) : pair[p].update(a.x, b.x, tNow);
        if (s > 0) edge[p].strokes.push(s);
      } else if (ts.length === 1) {
        feedSingle(p, ts[0].x, ts[0].y);
      }
    }
  }
  function onTouchEnd(e) {
    // always forget lifted fingers, even while a menu is up, or they go stale
    for (const t of e.changedTouches) tracker.up(t.identifier);
    for (let p = 0; p < players; p++) {
      if (hadTouches[p] > 0 && tracker.touchesFor(p).length === 0) {
        if (phase === 'launch') edge[p].release = true;
        hadTouches[p] = 0;
      }
    }
    if (phase !== 'menu') e.preventDefault();
  }

  // one pointer during launch: drag to place, circle to twist
  function feedSingle(p, x, y) {
    const L = getLayout();
    const a = screenToArena(L, x, y);
    edge[p].placeAngle = Math.atan2(a.y, a.x);
    const c = anchor(p);
    if (c) {
      const s = circle[p].update(Math.atan2(y - c.y, x - c.x));
      if (s > 0) edge[p].strokes.push(s);
    }
  }

  function onMouseDown(e) {
    if (phase === 'menu' || players !== 1) return;
    if (e.button === 2) { if (phase === 'battle') edge[0].special = true; return; }
    mouse = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
    circle[0].reset();
    if (phase === 'launch') feedSingle(0, e.clientX, e.clientY);
  }
  function onMouseMove(e) {
    if (!mouse) return;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (phase === 'launch') feedSingle(0, e.clientX, e.clientY);
  }
  function onMouseUp() {
    if (!mouse) return;
    mouse = null;
    if (phase === 'launch') edge[0].release = true;
  }
  const onContext = (e) => { if (phase !== 'menu') e.preventDefault(); };

  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  target.addEventListener('touchstart', onTouchStart, { passive: false });
  target.addEventListener('touchmove', onTouchMove, { passive: false });
  target.addEventListener('touchend', onTouchEnd, { passive: false });
  target.addEventListener('touchcancel', onTouchEnd, { passive: false });
  target.addEventListener('mousedown', onMouseDown);
  addEventListener('mousemove', onMouseMove);
  addEventListener('mouseup', onMouseUp);
  target.addEventListener('contextmenu', onContext);

  function keyVector(p) {
    let x = 0, y = 0;
    for (const k of mapsFor(p)) {
      x += (held.has(k.right) ? 1 : 0) - (held.has(k.left) ? 1 : 0);
      y += (held.has(k.down) ? 1 : 0) - (held.has(k.up) ? 1 : 0);
    }
    return { x: Math.sign(x), y: Math.sign(y) };
  }

  function steerFor(p) {
    const L = getLayout();
    let sx = 0, sy = 0, mag = 0;
    const touch = tracker.touchesFor(p)[0];
    const drag = touch || (p === 0 && players === 1 ? mouse : null);
    if (drag) {
      sx = drag.x - drag.startX; sy = drag.y - drag.startY;
      mag = Math.min(1, Math.hypot(sx, sy) / 60);
    } else {
      const k = keyVector(p);
      sx = k.x; sy = k.y;
      mag = sx || sy ? 1 : 0;
    }
    if (!mag) return { x: 0, y: 0 };
    const v = screenToArenaVec(L, sx, sy);
    const m = Math.hypot(v.x, v.y) || 1;
    return { x: (v.x / m) * mag, y: (v.y / m) * mag };
  }

  return {
    setPhase(p) {
      phase = p;
      edge = [fresh(), fresh()];
      if (p === 'battle') {
        // fingers/mouse held over from the launch steer from where they are now
        for (const pl of [0, 1]) for (const t of tracker.touchesFor(pl)) { t.startX = t.x; t.startY = t.y; }
        if (mouse) { mouse.startX = mouse.x; mouse.startY = mouse.y; }
      } else {
        mouse = null;
        tracker.clear();
        hadTouches[0] = hadTouches[1] = 0;
      }
      pair.forEach((d) => d.reset());
      circle.forEach((d) => d.reset());
    },
    setPlayers(n) { players = n; },
    get players() { return players; },
    poll(p) {
      const e = edge[p];
      edge[p] = fresh();
      const k = keyVector(p);
      return {
        slide: phase === 'launch' ? k.x : 0,
        placeAngle: e.placeAngle,
        keyStrokes: e.keyStrokes,
        strokes: e.strokes,
        release: e.release,
        steer: phase === 'battle' ? steerFor(p) : { x: 0, y: 0 },
        special: e.special,
        touching: tracker.touchesFor(p).length > 0 || (p === 0 && !!mouse),
      };
    },
    joystick(p) {
      const t = tracker.touchesFor(p)[0] || (p === 0 && players === 1 ? mouse : null);
      return t && phase === 'battle' ? { x: t.startX, y: t.startY, dx: t.x - t.startX, dy: t.y - t.startY } : null;
    },
    destroy() {
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
      removeEventListener('blur', onBlur);
      removeEventListener('mousemove', onMouseMove);
      removeEventListener('mouseup', onMouseUp);
      target.removeEventListener('touchstart', onTouchStart);
      target.removeEventListener('touchmove', onTouchMove);
      target.removeEventListener('touchend', onTouchEnd);
      target.removeEventListener('touchcancel', onTouchEnd);
      target.removeEventListener('mousedown', onMouseDown);
      target.removeEventListener('contextmenu', onContext);
    },
  };
}
