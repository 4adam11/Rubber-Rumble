// Rising difficulty: the computer's level follows how the player is doing. Pure: no DOM.
// Level 1 plays like Easy, 4 like Medium, 7 like Hard (see profile() in ai.js).
// Two match wins in a row move up one level; two losses in a row move down one.

export const RISING = { MIN: 1, MAX: 7, START: 2 };

export const newRising = () => ({ level: RISING.START, streak: 0 });

// Repair whatever was saved: the level is clamped to 1–7, the streak to −1…1 (2 always triggers a move).
export function cleanRising(raw) {
  if (!raw || typeof raw !== 'object') return newRising();
  const level = Number.isFinite(raw.level) ? Math.max(RISING.MIN, Math.min(RISING.MAX, Math.round(raw.level))) : RISING.START;
  const streak = Number.isFinite(raw.streak) ? Math.max(-1, Math.min(1, Math.round(raw.streak))) : 0;
  return { level, streak };
}

// The state after one finished match. `moved` is +1 / −1 when the level changed, else 0.
export function afterMatch(rising, won) {
  const r = cleanRising(rising);
  let streak = won ? Math.max(0, r.streak) + 1 : Math.min(0, r.streak) - 1;
  let level = r.level;
  if (streak >= 2) { level = Math.min(RISING.MAX, level + 1); streak = 0; }
  else if (streak <= -2) { level = Math.max(RISING.MIN, level - 1); streak = 0; }
  return { level, streak, moved: level - r.level };
}
