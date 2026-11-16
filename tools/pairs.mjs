// Every eraser + lead pair against every other pair: CPU(medium) vs CPU(medium), arenas in rotation.
// Prints each pair's overall win rate as JSON. Seeded, so the same arguments give the same numbers.
// Usage: node tools/pairs.mjs [roundsPerMatchup] [seed] [--compare baseline.json]
//   --compare: check the spread has not grown by more than 3 points past the baseline's best and worst.
import fs from 'node:fs';
import { ERASERS, LEADS, buildTop } from '../src/parts.js';
import { createWorld, step } from '../src/physics.js';
import { cpuLaunch, createCpu, pickAbility } from '../src/ai.js';
import { ARENAS, ARENA_IDS } from '../src/arenas.js';

const args = process.argv.slice(2);
const cmp = args.indexOf('--compare');
const baselineFile = cmp >= 0 ? args[cmp + 1] : null;
const nums = args.filter((a, i) => !(cmp >= 0 && (i === cmp || i === cmp + 1)));
const N = Number(nums[0]) || 20;
const SEED = Number(nums[1]) || 1;
const DIFF = 'medium';
const SLACK = 0.03;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
let roundNo = 0;

function playRound(pa, pb) {
  const sa = buildTop(...pa), sb = buildTop(...pb);
  const arena = ARENAS[ARENA_IDS[roundNo++ % ARENA_IDS.length]];
  const abilities = [pickAbility(DIFF, sa, sb, rng), pickAbility(DIFF, sb, sa, rng)];
  const w = createWorld([sa, sb], [cpuLaunch(sa, DIFF, 0, rng), cpuLaunch(sb, DIFF, 1, rng)], rng, { arena, abilities });
  const cpus = [createCpu(DIFF, 0, rng), createCpu(DIFF, 1, rng)];
  while (!w.over) step(w, cpus.map((c) => c.think(w, 1 / 120)));
  return w.result.winner;
}

const pairs = ERASERS.flatMap((e) => LEADS.map((l) => [e.id, l.id]));
const key = (p) => `${p[0]}+${p[1]}`;
const wins = Object.fromEntries(pairs.map((p) => [key(p), 0]));
const games = Object.fromEntries(pairs.map((p) => [key(p), 0]));
for (let i = 0; i < pairs.length; i++) {
  for (let j = i + 1; j < pairs.length; j++) {
    for (let k = 0; k < N; k++) {
      const swap = k % 2 === 1; // side-swapped so neither pair gets the left spot more often
      const winner = swap ? playRound(pairs[j], pairs[i]) : playRound(pairs[i], pairs[j]);
      if (winner === null) continue;
      const iWon = swap ? winner === 1 : winner === 0;
      wins[key(pairs[iWon ? i : j])]++;
      games[key(pairs[i])]++; games[key(pairs[j])]++;
    }
  }
}
const rates = Object.fromEntries(pairs.map((p) => [key(p), +(wins[key(p)] / Math.max(1, games[key(p)])).toFixed(4)]));

if (!baselineFile) {
  console.log(JSON.stringify(rates, null, 1));
} else {
  const base = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  const isBad = (k) => !!buildTop(...k.split('+')).combo?.bad;
  const fair = (o) => Object.entries(o).filter(([k]) => !isBad(k)); // the joke combo is meant to lose
  const hi = Math.max(...fair(base).map(([, v]) => v)), lo = Math.min(...fair(base).map(([, v]) => v));
  const sorted = fair(rates).sort((a, b) => b[1] - a[1]);
  const off = sorted.filter(([, v]) => v > hi + SLACK || v < lo - SLACK);
  const show = ([k, v]) => `  ${(v * 100).toFixed(1).padStart(5)}%  (was ${((base[k] ?? 0) * 100).toFixed(1)}%)  ${k}  [${buildTop(...k.split('+')).combo?.name || 'no combo'}]`;
  console.log(`baseline range ${(lo * 100).toFixed(1)}%–${(hi * 100).toFixed(1)}%; allowed ${((lo - SLACK) * 100).toFixed(1)}%–${((hi + SLACK) * 100).toFixed(1)}%`);
  console.log('strongest:\n' + sorted.slice(0, 5).map(show).join('\n'));
  console.log('weakest:\n' + sorted.slice(-5).map(show).join('\n'));
  if (off.length) { console.log('\nOUT OF RANGE:\n' + off.map(show).join('\n')); process.exitCode = 1; } else console.log('\nOK');
}
