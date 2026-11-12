// Temporary game loop: vs-CPU rounds back to back, P1 steers with WASD.
import { buildTop } from './parts.js';
import { createWorld, simulate, CONST } from './physics.js';
import { cpuLaunch, createCpu } from './ai.js';
import { createRenderer } from './render.js';
import { SPECIAL_NAMES } from './parts.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
renderer.resize();
addEventListener('resize', () => renderer.resize());

const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));

let world, cpu, wins = [0, 0], restartAt = 0;

function newRound() {
  const a = buildTop('apsara-nondust', 'nataraj-hb');
  const b = buildTop('doms-cubo', 'doms-y1');
  world = createWorld([a, b], [cpuLaunch(a, 'medium', 0), cpuLaunch(b, 'medium', 1)]);
  cpu = createCpu('medium', 1);
  renderer.banner('GHUMAO!', { sub: 'Spin it!' });
}

function playerIntent() {
  const x = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const y = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
  const v = renderer.layout.rotate ? { x: -y, y: -x } : { x, y };
  const m = Math.hypot(v.x, v.y) || 1;
  return { steer: { x: v.x / m, y: v.y / m }, special: keys.has('Space') };
}

newRound();
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += dt;
  const intents = [playerIntent(), cpu.think(world, dt)];
  acc = simulate(world, acc, intents);
  renderer.spawnFromEvents(world.events, world);
  for (const e of world.events) {
    if (e.type === 'end') {
      if (e.result.winner !== null) wins[e.result.winner]++;
      renderer.banner(e.result.winner === null ? 'Draw!' : e.result.winner === 0 ? 'You win!' : 'CPU wins!', { sub: e.result.reason });
      restartAt = now + 2000;
    }
  }
  world.events.length = 0;
  if (world.over && now > restartAt) newRound();
  renderer.update(dt);
  renderer.drawBattle(world, {
    names: ['You', 'CPU'], roundWins: wins,
    specialsReady: world.tops.map((t) => !t.specialUsed),
    specialNames: world.tops.map((t) => SPECIAL_NAMES[t.specialKind]),
    specialKeys: ['Space', ''],
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
void CONST;
