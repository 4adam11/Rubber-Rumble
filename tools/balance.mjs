// Headless balance check: CPU(medium) vs CPU(medium) rounds.
// Usage: node tools/balance.mjs [roundsPerMatchup] [seed]
// Seeded, so the same arguments always print the same numbers.
import { ERASERS, LEADS, buildTop } from '../src/parts.js';
import { createWorld, step } from '../src/physics.js';
import { cpuLaunch, createCpu } from '../src/ai.js';

const N = Number(process.argv[2]) || 200;
const SEED = Number(process.argv[3]) || 1;
const DIFF = 'medium';

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

function playRound(pa, pb) {
  const sa = buildTop(...pa), sb = buildTop(...pb);
  const w = createWorld([sa, sb], [cpuLaunch(sa, DIFF, 0, rng), cpuLaunch(sb, DIFF, 1, rng)], rng);
  const cpus = [createCpu(DIFF, 0, rng), createCpu(DIFF, 1, rng)];
  while (!w.over) step(w, cpus.map((c) => c.think(w, 1 / 120)));
  return { winner: w.result.winner, reason: w.result.reason, time: w.time };
}

// side-swapped so neither combo gets the left/right spot more often
function matchup(a, b, n = N) {
  let winsA = 0, winsB = 0, time = 0;
  const reasons = {};
  for (let i = 0; i < n; i++) {
    const swap = i % 2 === 1;
    const r = swap ? playRound(b, a) : playRound(a, b);
    time += r.time;
    reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    if (r.winner === null) continue;
    const aWon = swap ? r.winner === 1 : r.winner === 0;
    aWon ? winsA++ : winsB++;
  }
  return { winRateA: winsA / Math.max(1, winsA + winsB), avgTime: time / n, reasons };
}

const label = ([e, l]) => {
  const c = buildTop(e, l).combo;
  return `${e}+${l}${c ? ` [${c.name}]` : ''}`;
};

const DUO = ['apsara-nondust', 'nataraj-hb'];
const SLEEPY = ['apsara-jumbo', 'faber-2b'];
const pairs = [
  [DUO, ['camlin-dustfree', 'camlin-exam']],
  [DUO, ['doms-cubo', 'doms-y1']],
  [DUO, ['faber-dustfree', 'faber-2b']],
  [DUO, ['nataraj-621', 'apsara-absolute']],
  [SLEEPY, ['apsara-nondust', 'doms-y1']],
  [SLEEPY, ['camlin-dustfree', 'nataraj-hb']],
  [['nataraj-621', 'apsara-platinum'], ['faber-dustfree', 'faber-2b']],
  [['doms-cubo', 'nataraj-hb'], ['apsara-jumbo', 'apsara-absolute']],
  [['camlin-dustfree', 'camlin-exam'], ['faber-dustfree', 'faber-2b']],
  [['fruit-scented', 'apsara-platinum'], ['camlin-dustfree', 'doms-y1']],
  [['fruit-scented', 'nataraj-hb'], ['apsara-jumbo', 'nataraj-hb']],
  [['doms-cubo', 'doms-y1'], ['camlin-dustfree', 'camlin-exam']],
];

let totalTime = 0, worst = 0;
const rows = [];
for (const [a, b] of pairs) {
  const r = matchup(a, b);
  totalTime += r.avgTime;
  const bad = buildTop(...a).combo?.bad || buildTop(...b).combo?.bad;
  if (!bad) worst = Math.max(worst, r.winRateA, 1 - r.winRateA);
  rows.push(`${(r.winRateA * 100).toFixed(0).padStart(3)}%  ${r.avgTime.toFixed(1).padStart(5)}s  ${label(a)}  vs  ${label(b)}   ${JSON.stringify(r.reasons)}`);
}
console.log(`win% of left combo · mean round length · ${N} rounds each · seed ${SEED}\n`);
console.log(rows.join('\n'));

// Deadly Duo and Sleepy Bench vs the field of all non-bad pairs
function vsField(p, n = Math.max(4, Math.round(N / 20))) {
  let w = 0, l = 0;
  for (const e of ERASERS) for (const ld of LEADS) {
    if (buildTop(e.id, ld.id).combo?.bad) continue;
    const r = matchup(p, [e.id, ld.id], n);
    w += r.winRateA; l += 1;
  }
  return w / l;
}
const duo = vsField(DUO), sleepy = vsField(SLEEPY);
const meanLen = totalTime / pairs.length;
console.log(`\nmean round length: ${meanLen.toFixed(1)}s (target 15–40)`);
console.log(`most lopsided non-bad matchup: ${(worst * 100).toFixed(0)}% (target ≤ 80)`);
console.log(`Deadly Duo vs field: ${(duo * 100).toFixed(0)}% (target ≥ 55)`);
console.log(`Sleepy Bench vs field: ${(sleepy * 100).toFixed(0)}% (target < 50)`);
const ok = meanLen >= 15 && meanLen <= 40 && worst <= 0.8 && duo >= 0.55 && sleepy < 0.5;
console.log(ok ? '\nBALANCE OK' : '\nBALANCE OFF TARGET');
process.exitCode = ok ? 0 : 1;
