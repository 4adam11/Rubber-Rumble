// Game loop and round flow: launch -> battle -> result.
import { buildTop, SPECIAL_NAMES } from './parts.js';
import { createWorld, simulate } from './physics.js';
import {
  LAUNCH, createLaunch, slide, setPlace, keyStroke, addStroke, release, updateLaunch,
} from './launch.js';
import { cpuLaunch, createCpu } from './ai.js';
import { createRenderer, PLAYER_COLORS, arenaToScreen } from './render.js';
import { createInput, specialButton } from './input.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
renderer.resize();
const coarse = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } })();

let game = null; // current match
const input = createInput(canvas, () => renderer.layout, {
  players: 1,
  getAnchor: (p) => {
    const s = game?.launches?.[p];
    if (!s) return null;
    return arenaToScreen(renderer.layout, LAUNCH.START_RADIUS * Math.cos(s.rimAngle), LAUNCH.START_RADIUS * Math.sin(s.rimAngle));
  },
  onPause: () => {},
});

addEventListener('resize', () => renderer.resize());

function startMatch(config) {
  input.setPlayers(config.mode === '2p' ? 2 : 1);
  game = {
    config,
    specs: config.parts.map((p) => buildTop(p.eraserId, p.leadId)),
    wins: [0, 0],
    round: 0,
    phase: 'idle',
    world: null,
    launches: null,
    cpuPlan: null,
    cpu: null,
    timer: 0,
  };
  startRound();
}

function isCpu(i) { return game.config.mode === 'cpu' && i === 1; }

function startRound() {
  game.round++;
  game.phase = 'launch';
  game.timer = 0;
  game.world = null;
  game.launches = game.specs.map((spec, i) => createLaunch(spec, i));
  game.cpuPlan = isCpu(1) ? cpuLaunch(game.specs[1], game.config.difficulty, 1) : null;
  game.cpu = isCpu(1) ? createCpu(game.config.difficulty, 1) : null;
  input.setPhase('launch');
  renderer.banner(`Round ${game.round}`, { sub: 'Place your top on the rim', size: 54, life: 1.3 });
}

function stepLaunch(dt) {
  game.launches.forEach((s, i) => {
    if (isCpu(i)) {
      const plan = game.cpuPlan;
      if (s.phase === 'place') {
        const target = Math.atan2(plan.y, plan.x);
        s.rimAngle += (target - s.rimAngle) * Math.min(1, dt * 3);
      } else if (s.phase === 'twist') {
        const k = Math.min(1, (s.t - LAUNCH.PLACE_TIME) / (LAUNCH.TWIST_TIME * 0.9));
        s.rpm = (plan.rpm / (plan.perfect ? 1.05 : 1)) * k;
      }
      updateLaunch(s, dt);
      if (s.phase === 'done') s.result = plan;
      return;
    }
    const inp = input.poll(i);
    if (inp.slide) slide(s, inp.slide, dt);
    if (inp.placeAngle !== null) setPlace(s, inp.placeAngle);
    for (const k of inp.keyStrokes) keyStroke(s, k);
    for (const v of inp.strokes) addStroke(s, v);
    if (inp.release) release(s);
    const before = s.phase;
    updateLaunch(s, dt);
    if (before !== 'done' && s.phase === 'done' && s.result.perfect) {
      const p = arenaToScreen(renderer.layout, s.result.x, s.result.y);
      renderer.banner('PERFECT!', { x: p.x, y: p.y - 50, color: '#22a34a', size: 30, life: 1.2 });
    }
  });
  if (game.launches.every((s) => s.phase === 'done')) {
    game.timer += dt;
    if (game.timer > 0.45) startBattle();
  }
}

function startBattle() {
  game.phase = 'battle';
  game.timer = 0;
  game.acc = 0;
  game.world = createWorld(game.specs, game.launches.map((s) => s.result));
  input.setPhase('battle');
  renderer.banner('GHUMAO!', { sub: 'Spin it!', size: 70, life: 1.1 });
}

function stepBattle(dt) {
  const w = game.world;
  const intents = [0, 1].map((i) => {
    if (isCpu(i)) return game.cpu.think(w, dt);
    const inp = input.poll(i);
    return { steer: inp.steer, special: inp.special };
  });
  game.acc = simulate(w, game.acc + dt, intents);
  renderer.spawnFromEvents(w.events, w);
  for (const e of w.events) if (e.type === 'end') endRound(e.result);
  w.events.length = 0;
  if (game.phase === 'over') {
    game.timer += dt;
    if (game.timer > 2.4) startRound();
  }
}

const REASON = {
  stopped: 'stopped spinning', tipped: 'tipped over', ringout: 'knocked out of the thali',
  time: 'more spin at the bell', draw: 'replay the round',
};

function playerName(i) {
  if (game.config.mode === 'cpu') return i === 0 ? 'You' : 'CPU';
  return `Player ${i + 1}`;
}

function endRound(result) {
  game.phase = 'over';
  game.timer = 0;
  input.setPhase('menu');
  if (result.winner === null) {
    renderer.banner('Draw!', { sub: REASON.draw, size: 64, life: 2.2 });
    return;
  }
  game.wins[result.winner]++;
  const loser = 1 - result.winner;
  const sub = result.reason === 'time' ? REASON.time : `${playerName(loser)} ${REASON[result.reason]}`;
  renderer.banner(`${playerName(result.winner)} win${game.config.mode === 'cpu' && result.winner === 0 ? '' : 's'}!`,
    { sub, color: PLAYER_COLORS[result.winner], size: 60, life: 2.2 });
}

function hints(i) {
  const s = game.launches[i];
  if (isCpu(i)) return s.phase === 'twist' ? 'Twisting…' : s.phase === 'done' ? (s.result?.perfect ? 'PERFECT!' : '') : '';
  const twoP = game.config.mode === '2p';
  const keys = twoP && i === 1 ? ['←', '→', '↑'] : ['A', 'D', 'W'];
  if (s.phase === 'place') {
    const left = Math.max(0, LAUNCH.PLACE_TIME - s.t).toFixed(1);
    return coarse ? `Drag to place · ${left}s` : `${keys[0]}/${keys[1]} to place · ${left}s`;
  }
  if (s.phase === 'twist') return coarse ? 'Flick 2 thumbs! Lift to let go' : `Mash ${keys[0]}↔${keys[1]}! ${keys[2]} to let go`;
  return s.result?.perfect ? 'PERFECT!' : 'Released';
}

function hud() {
  const tops = game.world?.tops;
  return {
    names: [0, 1].map(playerName),
    roundWins: game.wins,
    specialsReady: tops ? tops.map((t) => !t.specialUsed) : [true, true],
    specialNames: tops ? tops.map((t) => SPECIAL_NAMES[t.specialKind]) : game.specs.map((s) => SPECIAL_NAMES[s.special]),
    specialKeys: coarse ? ['', ''] : game.config.mode === '2p' ? ['Space', 'Enter'] : ['Space', ''],
    launchLabels: game.phase === 'launch' ? [0, 1].map(hints) : null,
    overlay: drawTouchControls,
  };
}

function drawTouchControls(ctx, L) {
  if (!coarse || game.phase !== 'battle') return;
  const humans = game.config.mode === '2p' ? [0, 1] : [0];
  for (const i of humans) {
    const b = specialButton(i, L.width, L.height, input.players);
    const ready = !game.world.tops[i].specialUsed;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = ready ? 'rgba(255,253,246,0.92)' : 'rgba(255,253,246,0.45)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PLAYER_COLORS[i];
    ctx.stroke();
    ctx.fillStyle = ready ? PLAYER_COLORS[i] : 'rgba(60,60,70,0.4)';
    ctx.font = '700 26px "Kalam", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', b.x, b.y + 1);
    const j = input.joystick(i);
    if (j) {
      ctx.beginPath();
      ctx.arc(j.x, j.y, 60, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const m = Math.hypot(j.dx, j.dy), k = m > 60 ? 60 / m : 1;
      ctx.beginPath();
      ctx.arc(j.x + j.dx * k, j.y + j.dy * k, 18, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_COLORS[i];
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

// Debug handle for the console: inspect state, or step frames by hand
// (useful when the tab is in the background and requestAnimationFrame is paused).
window.rubberRumble = {
  get game() { return game; },
  advance(seconds, fps = 60) { for (let i = 0; i < Math.round(seconds * fps); i++) tick(1 / fps); },
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tick(dt);
  requestAnimationFrame(frame);
}

function tick(dt) {
  if (game) {
    if (game.phase === 'launch') stepLaunch(dt);
    else if (game.phase === 'battle' || game.phase === 'over') stepBattle(dt);
  }
  renderer.update(dt);
  if (!game) renderer.drawIdle();
  else if (game.phase === 'launch') renderer.drawLaunch(game.launches, hud());
  else renderer.drawBattle(game.world, hud());
}
requestAnimationFrame(frame);

// Temporary until menus exist: straight into a vs-CPU match.
startMatch({
  mode: 'cpu', difficulty: 'medium',
  parts: [{ eraserId: 'apsara-nondust', leadId: 'nataraj-hb' }, { eraserId: 'doms-cubo', leadId: 'doms-y1' }],
});
