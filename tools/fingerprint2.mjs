// Fingerprint of 2-top battles: used to prove the N-top engine leaves 2-top play unchanged.
import { buildTop } from '../src/parts.js';
import { createWorld, simulate } from '../src/physics.js';
import { createCpu } from '../src/ai.js';
import { ARENAS } from '../src/arenas.js';
import { seeded } from '../tests/helpers.js';

export function fingerprint() {
  const out = [];
  const pairs = [['apsara-nondust', 'nataraj-hb', 'doms-cubo', 'doms-y1'], ['apsara-jumbo', 'faber-2b', 'nataraj-621', 'apsara-platinum'], ['camlin-dustfree', 'camlin-exam', 'fruit-scented', 'apsara-absolute']];
  const arenas = ['thali', 'tiffin', 'geometry'];
  for (let k = 0; k < 9; k++) {
    const [e0, l0, e1, l1] = pairs[k % 3];
    const specs = [buildTop(e0, l0), buildTop(e1, l1)];
    const rng = seeded(100 + k);
    const w = createWorld(specs, [
      { x: -0.8, y: 0.05, rpm: specs[0].maxRPM * 0.95, wobble: 0.1, spinDir: 1 },
      { x: 0.8, y: -0.05, rpm: specs[1].maxRPM * 0.9, wobble: 0.15, spinDir: k % 2 ? 1 : -1 },
    ], rng, { arena: ARENAS[arenas[k % 3]], abilities: [['dash', 'crumbs', 'shield'][k % 3], ['plant', 'secondWind', 'recentre'][k % 3]] });
    const crng = seeded(900 + k);
    const cpus = [createCpu('hard', 0, crng), createCpu('medium', 1, crng)];
    let guard = 0;
    while (!w.over && guard++ < 20000) {
      const intents = cpus.map((c) => c.think(w, 1 / 60));
      simulate(w, 1 / 60, intents);
      w.events.length = 0;
    }
    out.push([w.result?.winner, w.result?.reason, +w.time.toFixed(4), ...w.tops.map((t) => +t.rpm.toFixed(3))].join(','));
  }
  return out;
}

if (process.argv[1]?.endsWith('fingerprint2.mjs')) console.log(JSON.stringify(fingerprint()));
