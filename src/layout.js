// Screen <-> arena mapping. Pure.
// Landscape: player 0 on the left. Portrait: arena rotated so player 0 is at the bottom.
// The health bars sit beside the thali when there is room ('side'), otherwise across the top ('top').

export const THALI_OUTER = 1.08; // rim edge in arena units
export const GUTTER = 16;
export const PORTRAIT_HUD = 60; // kept for older callers
export const TOP_HUD = 84;      // space for the health bars when they run across the top
export const BOTTOM_PAD = 70;   // portrait: room for thumbs and the ability button
export const SIDE_HUD = 210;    // width of a health-bar block beside the thali

// How far this device turns the bowl so its own seat starts nearest the player
// (bottom on a phone, left on a laptop). Seat 0 needs no turn.
export function viewFor(seat, seats = 2) {
  return seat ? -(seat * 2 * Math.PI) / seats : 0;
}

export function computeLayout(width, height, view = 0) {
  const rotate = height > width;
  const availW = width - GUTTER * 2;
  let availH = height - GUTTER * 2;
  let hud = 'side';
  const d0 = Math.min(availW, availH);
  if (rotate || (width - d0) / 2 < SIDE_HUD + GUTTER) {
    hud = 'top';
    availH = height - GUTTER * 2 - TOP_HUD - (rotate ? BOTTOM_PAD : 0);
  }
  const scale = Math.max(10, Math.min(availW, availH) / (2 * THALI_OUTER));
  const cy = hud === 'top' ? GUTTER + TOP_HUD + availH / 2 : height / 2;
  return { width, height, rotate, hud, scale, cx: width / 2, cy, view };
}

// turn an arena point by a; no-op (and exactly as before) when a is 0
function turn(x, y, a) {
  if (!a) return { x, y };
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
}

export function arenaToScreen(L, ax, ay) {
  const { x, y } = turn(ax, ay, L.view);
  return L.rotate
    ? { x: L.cx - y * L.scale, y: L.cy - x * L.scale }
    : { x: L.cx + x * L.scale, y: L.cy + y * L.scale };
}

export function screenToArena(L, sx, sy) {
  return screenToArenaVec(L, sx - L.cx, sy - L.cy);
}

export function screenToArenaVec(L, dx, dy) {
  const v = L.rotate
    ? { x: -dy / L.scale, y: -dx / L.scale }
    : { x: dx / L.scale, y: dy / L.scale };
  return turn(v.x, v.y, -(L.view || 0));
}
