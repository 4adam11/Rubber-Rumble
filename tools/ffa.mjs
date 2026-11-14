// Free-for-all balance check for friends mode: 3–4 medium CPU tops with random parts in one bowl.
// Usage: node tools/ffa.mjs [rounds] [seed] [tops] [arena|all]
import { ERASERS, LEADS, buildTop } from '../src/parts.js';
import { createWorld, step } from '../src/physics.js';
import { cpuLaunch, createCpu, pickAbility } from '../src/ai.js';
import { ARENAS, ARENA_IDS } from '../src/arenas.js';
import { seeded } from '../tests/helpers.js';

const ROUNDS = Number(process.argv[2]) || 200;
const rng = seeded(Number(process.argv[3]) || 1);
const TOPS = Number(process.argv[4]) || 4;
const ARENA = process.argv[5] || 'all';
const pick = (a) => a[Math.floor(rng() * a.length)];

let time = 0, draws = 0;
const reasons = {}, winsByArch = {}, seenByArch = {};
for (let r = 0; r < ROUNDS; r++) {
  const specs = Array.from({ length: TOPS }, () => buildTop(pick(ERASERS).id, pick(LEADS).id));
  const arena = ARENAS[ARENA === 'all' ? ARENA_IDS[r % ARENA_IDS.length] : ARENA];
  const abilities = specs.map((s, i) => pickAbility('medium', s, specs[(i + 1) % TOPS], rng));
  const w = createWorld(specs, specs.map((s, i) => cpuLaunch(s, 'medium', i, rng, TOPS)), rng, { arena, abilities });
  const cpus = specs.map((_, i) => createCpu('medium', i, rng));
  while (!w.over) step(w, cpus.map((c) => c.think(w, 1 / 120)));
  time += w.time;
  reasons[w.result.reason] = (reasons[w.result.reason] || 0) + 1;
  for (const s of specs) seenByArch[s.archetype] = (seenByArch[s.archetype] || 0) + 1;
  if (w.result.winner === null) draws++;
  else winsByArch[specs[w.result.winner].archetype] = (winsByArch[specs[w.result.winner].archetype] || 0) + 1;
}
console.log(`${TOPS} tops, ${ROUNDS} rounds: mean round ${(time / ROUNDS).toFixed(1)} s, draws ${draws}`);
console.log('finishes', reasons);
for (const a of Object.keys(seenByArch)) {
  const fair = (seenByArch[a] / (ROUNDS * TOPS)) * (ROUNDS - draws);
  console.log(`${a.padEnd(9)} wins ${String(winsByArch[a] || 0).padStart(4)} (fair share ${fair.toFixed(0)})`);
}
