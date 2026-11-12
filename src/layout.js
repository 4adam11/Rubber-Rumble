// Screen <-> arena mapping. Pure.
// Landscape: player 0 on the left. Portrait: arena rotated so player 0 is at the bottom.

export const THALI_OUTER = 1.08; // rim edge in arena units
export const GUTTER = 16;
export const PORTRAIT_HUD = 60;

export function computeLayout(width, height) {
  const rotate = height > width;
  const availW = width - GUTTER * 2;
  const availH = height - GUTTER * 2 - (rotate ? PORTRAIT_HUD * 2 : 0);
  const scale = Math.max(10, Math.min(availW, availH) / (2 * THALI_OUTER));
  return { width, height, rotate, scale, cx: width / 2, cy: height / 2 };
}

export function arenaToScreen(L, x, y) {
  return L.rotate
    ? { x: L.cx - y * L.scale, y: L.cy - x * L.scale }
    : { x: L.cx + x * L.scale, y: L.cy + y * L.scale };
}

export function screenToArena(L, sx, sy) {
  return screenToArenaVec(L, sx - L.cx, sy - L.cy);
}

export function screenToArenaVec(L, dx, dy) {
  return L.rotate
    ? { x: -dy / L.scale, y: -dx / L.scale }
    : { x: dx / L.scale, y: dy / L.scale };
}
