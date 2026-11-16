// Can each School Tournament opponent be beaten with the kit a player has when they reach it?
// For every rung: each top the player could build on arrival is played by the Hard computer against
// that rung's opponent (its own difficulty, arena, twist and boss size). Prints the best top's win rate.
// Usage: node tools/kit-check.mjs [roundsPerTop] [seed] [--full]   (exit code 1 if any rung is under 35%)
import { buildTop } from '../src/parts.js';
import { createWorld, step } from '../src/physics.js';
import { cpuLaunch, createCpu, pickAbility } from '../src/ai.js';
import { ARENAS } from '../src/arenas.js';
import { RUNGS, MODIFIERS, bossSpec } from '../src/tournament.js';
import { earnedKit, FULL_KIT } from '../src/kit.js';

const FULL = process.argv.includes('--full'); // compare: every part available, as before the earned kit
const nums = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const N = Number(nums[0]) || 200;
const SEED = Number(nums[1]) || 1;
const NEED = 0.35;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

let ok = true;
RUNGS.forEach((r, i) => {
  const kit = FULL ? FULL_KIT : earnedKit({ rung: i, champion: false }); // what the player owns on arriving at rung i
  const foe0 = buildTop(r.parts.eraserId, r.parts.leadId);
  const foe = r.boss ? bossSpec(foe0) : foe0;
  const results = [];
  for (const e of kit.erasers) for (const l of kit.leads) {
    const rng = mulberry32(SEED + i * 1000 + results.length);
    const mine = buildTop(e, l);
    let w = 0, n = 0;
    for (let k = 0; k < N; k++) {
      const abilities = [pickAbility('hard', mine, foe, rng, kit), r.ability];
      const world = createWorld([mine, foe], [cpuLaunch(mine, 'hard', 0, rng), cpuLaunch(foe, r.difficulty, 1, rng)], rng,
        { arena: ARENAS[r.arena], abilities, mods: r.modifier ? MODIFIERS[r.modifier].mods : null });
      const cpus = [createCpu('hard', 0, rng), createCpu(r.difficulty, 1, rng)];
      while (!world.over) step(world, cpus.map((c) => c.think(world, 1 / 120)));
      if (world.result.winner === null) continue;
      n++; if (world.result.winner === 0) w++;
    }
    results.push({ top: `${e}+${l}`, combo: mine.combo?.name, rate: w / Math.max(1, n) });
  }
  results.sort((a, b) => b.rate - a.rate);
  const best = results[0], pass = best.rate >= NEED;
  ok &&= pass;
  const beatable = results.filter((x) => x.rate >= NEED).length;
  console.log(`rung ${i + 1} ${r.name.padEnd(16)} (${r.difficulty}${r.boss ? ', boss' : ''}): best top ${best.top} [${best.combo}] wins ${(best.rate * 100).toFixed(0)}%  · ${beatable} of ${results.length} tops reach ${NEED * 100}%  ${pass ? '' : '  <-- TOO HARD'}`);
});
console.log(ok ? '\nEVERY RUNG IS WINNABLE' : '\nA RUNG IS TOO HARD FOR THE KIT');
process.exitCode = ok ? 0 : 1;
