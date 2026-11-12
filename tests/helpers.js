import { buildTop } from '../src/parts.js';
import { createWorld } from '../src/physics.js';

export const still = () => 0.5; // rng that makes random drift zero

export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const NO_INTENT = [{ steer: { x: 0, y: 0 }, special: false }, { steer: { x: 0, y: 0 }, special: false }];

export function launch(x, y, rpm, wobble = 0) {
  return { x, y, rpm, wobble, perfect: false };
}

export function world2({
  a = ['apsara-nondust', 'nataraj-hb'],
  b = ['apsara-nondust', 'nataraj-hb'],
  la, lb, rng = still, opts,
} = {}) {
  const sa = buildTop(...a);
  const sb = buildTop(...b);
  return createWorld(
    [sa, sb],
    [la || launch(0.6, 0, sa.maxRPM), lb || launch(-0.6, 0, sb.maxRPM)],
    rng,
    opts,
  );
}

export function runUntilOver(world, step, intents = NO_INTENT, maxSeconds = 120) {
  const n = Math.ceil(maxSeconds * 120);
  for (let i = 0; i < n && !world.over; i++) step(world, intents);
  return world;
}
