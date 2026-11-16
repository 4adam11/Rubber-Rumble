// Try different stat swaps for one standard combo and see how its pair fares.
// Usage: node tools/try-combo.mjs <comboId> <rounds> "up:down" ["up:down" ...]
//   e.g. node tools/try-combo.mjs sharp-corners 200 attack:stability attack:stamina speed:defense
// Prints, for each option, the pair's win rate against a spread of rivals. Changes nothing on disk.
import { ERASERS, LEADS, COMBOS, buildTop } from '../src/parts.js';
import { createWorld, step } from '../src/physics.js';
import { cpuLaunch, createCpu, pickAbility } from '../src/ai.js';
import { ARENAS, ARENA_IDS } from '../src/arenas.js';

const [id, roundsArg, ...options] = process.argv.slice(2);
const N = Number(roundsArg) || 100;
const combo = COMBOS.find((c) => c.id === id);
if (!combo || combo.star || combo.bad) { console.error(`not a standard combo: ${id}`); process.exit(1); }
const pair = [combo.erasers[0], combo.leads[0]];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function rate(rival, rounds, seed) {
  const rng = mulberry32(seed);
  let w = 0, l = 0;
  for (let k = 0; k < rounds; k++) {
    const swap = k % 2 === 1;
    const [pa, pb] = swap ? [rival, pair] : [pair, rival];
    const sa = buildTop(...pa), sb = buildTop(...pb);
    const abilities = [pickAbility('medium', sa, sb, rng), pickAbility('medium', sb, sa, rng)];
    const world = createWorld([sa, sb], [cpuLaunch(sa, 'medium', 0, rng), cpuLaunch(sb, 'medium', 1, rng)], rng, { arena: ARENAS[ARENA_IDS[k % ARENA_IDS.length]], abilities });
    const cpus = [createCpu('medium', 0, rng), createCpu('medium', 1, rng)];
    while (!world.over) step(world, cpus.map((c) => c.think(world, 1 / 120)));
    if (world.result.winner === null) continue;
    (swap ? world.result.winner === 1 : world.result.winner === 0) ? w++ : l++;
  }
  return w / Math.max(1, w + l);
}
const rivals = ERASERS.flatMap((e) => LEADS.map((l) => [e.id, l.id])).filter((p) => p.join() !== pair.join());
const original = { ...combo.mods };
for (const opt of [Object.entries(original).sort((a, b) => b[1] - a[1]).map(([k]) => k).join(':') + ' (now)', ...options]) {
  const [up, down] = opt.replace(' (now)', '').split(':');
  for (const k of Object.keys(combo.mods)) delete combo.mods[k];
  combo.mods[up] = 1; combo.mods[down] = -1;
  const perRival = Math.max(2, Math.round(N / 10));
  const field = rivals.reduce((s, r, i) => s + rate(r, perRival, 50 + i), 0) / rivals.length;
  const worst = Math.max(...[['apsara-jumbo', 'apsara-absolute'], ['faber-dustfree', 'faber-2b'], ['camlin-dustfree', 'camlin-exam']].map((r, i) => rate(r, N, 7 + i)));
  console.log(`${opt.padEnd(28)} vs field ${(field * 100).toFixed(1)}%   hardest-hit rival ${(worst * 100).toFixed(0)}%`);
}
