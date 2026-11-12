// Game flow: title -> (difficulty) -> picker(s) -> launch -> battle -> results.
import { buildTop, SPECIAL_NAMES } from './parts.js';
import { createWorld, simulate } from './physics.js';
import {
  LAUNCH, createLaunch, slide, setPlace, keyStroke, addStroke, release, updateLaunch,
} from './launch.js';
import { cpuLaunch, createCpu, pickCombo } from './ai.js';
import { createRenderer, PLAYER_COLORS, arenaToScreen } from './render.js';
import { createInput, specialButton } from './input.js';
import { createMatch } from './match.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { loadSettings, saveSettings } from './settings.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
renderer.resize();
addEventListener('resize', () => renderer.resize());
const coarse = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } })();

const settings = loadSettings();
const audio = createAudio();
audio.setMuted(settings.muted);
const unlockAudio = () => audio.unlock();
addEventListener('pointerdown', unlockAudio);
addEventListener('keydown', unlockAudio);

let game = null;     // the match being played or demoed
let session = null;  // menu choices: { mode, difficulty, parts, changing }
let paused = false;

const input = createInput(canvas, () => renderer.layout, {
  players: 1,
  getAnchor: (p) => {
    const s = game?.launches?.[p];
    if (!s) return null;
    return arenaToScreen(renderer.layout, LAUNCH.START_RADIUS * Math.cos(s.rimAngle), LAUNCH.START_RADIUS * Math.sin(s.rimAngle));
  },
  onPause: () => (paused ? resume() : pause()),
});

const ui = createUI(document.getElementById('screens'), { action: onAction, click: () => audio.click() });

// ---------- match / rounds ----------
const isDemo = () => game?.config.mode === 'demo';
const isCpu = (i) => game.config.mode === 'demo' || (game.config.mode === 'cpu' && i === 1);
const inPlay = () => game && !isDemo() && (game.phase === 'launch' || game.phase === 'battle');

function startMatch(config) {
  input.setPlayers(config.mode === '2p' ? 2 : 1);
  game = {
    config,
    specs: config.parts.map((p) => buildTop(p.eraserId, p.leadId)),
    match: createMatch(),
    round: 0,
    phase: 'idle',
    world: null, launches: null, cpuPlans: [null, null], cpus: [null, null],
    timer: 0, acc: 0, resultShown: false,
  };
  startRound();
}

function startRound() {
  const g = game;
  g.round++;
  g.phase = 'launch';
  g.timer = 0;
  g.world = null;
  g.resultShown = false;
  if (g.config.mode === 'cpu' && g.config.difficulty === 'hard' && g.round > 1) {
    const p = pickCombo('hard', g.specs[0]);
    g.config.parts[1] = p;
    g.specs[1] = buildTop(p.eraserId, p.leadId);
  }
  g.launches = g.specs.map((spec, i) => createLaunch(spec, i));
  const diff = g.config.difficulty || 'medium';
  g.cpuPlans = [0, 1].map((i) => (isCpu(i) ? cpuLaunch(g.specs[i], diff, i) : null));
  g.cpus = [0, 1].map((i) => (isCpu(i) ? createCpu(diff, i) : null));
  if (isDemo()) return;
  input.setPhase('launch');
  ui.show('hud');
  renderer.banner(`Round ${g.round}`, { sub: 'Place your top on the rim', size: 54, life: 1.3 });
}

function stepLaunch(dt) {
  const g = game;
  g.launches.forEach((s, i) => {
    if (isCpu(i)) {
      const plan = g.cpuPlans[i];
      if (s.phase === 'place') {
        const target = Math.atan2(plan.y, plan.x);
        let d = target - s.rimAngle;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.rimAngle += d * Math.min(1, dt * 3);
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
    const before = s.rpm;
    for (const k of inp.keyStrokes) keyStroke(s, k);
    for (const v of inp.strokes) addStroke(s, v);
    if (s.rpm > before) audio.stroke();
    if (inp.release) release(s);
    const was = s.phase;
    updateLaunch(s, dt);
    if (was !== 'done' && s.phase === 'done' && s.result.perfect) {
      const p = arenaToScreen(renderer.layout, s.result.x, s.result.y);
      renderer.banner('PERFECT!', { x: p.x, y: p.y - 50, color: '#22a34a', size: 30, life: 1.2 });
      audio.perfect();
    }
  });
  if (g.launches.every((s) => s.phase === 'done')) {
    g.timer += dt;
    if (g.timer > 0.45) startBattle();
  }
}

function startBattle() {
  const g = game;
  g.phase = 'battle';
  g.timer = 0;
  g.acc = 0;
  g.world = createWorld(g.specs, g.launches.map((s) => s.result));
  if (isDemo()) return;
  input.setPhase('battle');
  renderer.banner('GHUMAO!', { sub: 'Spin it!', size: 70, life: 1.1 });
  audio.go();
}

function stepBattle(dt) {
  const g = game;
  const w = g.world;
  if (!w.over) {
    const intents = [0, 1].map((i) => {
      if (isCpu(i)) return g.cpus[i].think(w, dt);
      const inp = input.poll(i);
      return { steer: inp.steer, special: inp.special };
    });
    g.acc = simulate(w, g.acc + dt, intents);
  }
  if (!isDemo()) {
    renderer.spawnFromEvents(w.events, w);
    for (const e of w.events) {
      if (e.type === 'hit') audio.clack(e.impact);
      else if (e.type === 'snap') audio.snap();
      else if (e.type === 'special') audio.special();
    }
    w.tops.forEach((t, i) => audio.hum(i, w.over ? 0 : t.rpm / t.spec.maxRPM));
  } else if (w.events.some((e) => e.type === 'hit')) {
    renderer.spawnFromEvents(w.events.filter((e) => e.type === 'hit'), w);
  }
  for (const e of w.events) if (e.type === 'end') endRound(e.result);
  w.events.length = 0;

  if (g.phase === 'over') {
    g.timer += dt;
    if (isDemo()) { if (g.timer > 1.5) startRound(); return; }
    if (g.timer > 1.7 && !g.resultShown) {
      g.resultShown = true;
      showResult();
    }
  }
}

const REASON = {
  stopped: 'stopped spinning', tipped: 'tipped over', ringout: 'got knocked out of the thali',
  time: 'had more spin at the bell', draw: 'Both tops gave up together. Replay!',
};

const SHORT = { stopped: 'outspun', tipped: 'rival tipped over', ringout: 'knock-out', time: 'on time' };

function playerName(i) {
  if (game.config.mode === 'cpu') return i === 0 ? 'You' : 'CPU';
  return `Player ${i + 1}`;
}

function describe(result) {
  if (result.winner === null) return REASON.draw;
  if (result.reason === 'time') return `${playerName(result.winner)} ${REASON.time}`;
  return `${playerName(1 - result.winner)} ${REASON[result.reason]}`;
}

function winsWord(i) { return game.config.mode === 'cpu' && i === 0 ? 'win' : 'wins'; }

function endRound(result) {
  const g = game;
  g.phase = 'over';
  g.timer = 0;
  g.lastResult = result;
  if (isDemo()) return;
  input.setPhase('menu');
  audio.silence();
  g.match.record(result);
  if (result.winner === null) {
    renderer.banner('Draw!', { sub: describe(result), size: 64, life: 1.8 });
  } else {
    renderer.banner(`${playerName(result.winner)} ${winsWord(result.winner)}!`,
      { sub: describe(result), color: PLAYER_COLORS[result.winner], size: 60, life: 1.8 });
  }
}

function showResult() {
  const g = game;
  const st = g.match.state();
  const names = [playerName(0), playerName(1)];
  const r = g.lastResult;
  if (st.over) {
    const youLost = g.config.mode === 'cpu' && st.winner === 1;
    youLost ? audio.lose() : audio.win();
    ui.show('match', {
      headline: g.config.mode === 'cpu' ? (st.winner === 0 ? 'You win the match!' : 'CPU wins the match') : `Player ${st.winner + 1} wins!`,
      color: PLAYER_COLORS[st.winner], names, wins: st.wins,
      rounds: st.rounds.map((x, k) => `Round ${k + 1}: ${x.winner === null ? 'draw, replayed' : `${names[x.winner]} (${SHORT[x.reason]})`}`),
    });
  } else {
    ui.show('round', {
      headline: r.winner === null ? 'Draw!' : `${names[r.winner]} ${winsWord(r.winner)} round ${g.round}!`,
      sub: describe(r), color: r.winner === null ? '#1f2a44' : PLAYER_COLORS[r.winner],
      names, wins: st.wins, draw: r.winner === null,
    });
  }
}

// ---------- menus ----------
function startDemo() {
  const a = pickCombo('medium', null), b = pickCombo('medium', null);
  input.setPhase('menu');
  startMatch({ mode: 'demo', difficulty: 'medium', parts: [a, b] });
}

function showTitle() {
  paused = false;
  session = null;
  audio.silence();
  startDemo();
  ui.show('title', { muted: settings.muted });
}

function openPicker(player) {
  session.picking = player;
  const twoP = session.mode === '2p';
  const parts = session.parts?.[player] || settings.lastParts[player];
  let note = '';
  if (session.mode === 'cpu') {
    note = `Versus the computer (${session.difficulty}).`;
    if (session.difficulty === 'hard') note += ' It will counter-pick whatever you build.';
  } else if (player === 1) note = 'Player 1 is ready. Player 2, your turn!';
  else note = 'Pass the device after you pick.';
  ui.show('picker', {
    player, who: twoP ? `Player ${player + 1},` : 'You,',
    color: PLAYER_COLORS[player], note,
    eraserId: parts.eraserId, leadId: parts.leadId,
  });
}

function partsReady(player, parts) {
  session.parts = session.parts || [];
  session.parts[player] = parts;
  settings.lastParts[player] = parts;
  saveSettings(settings);
  if (session.mode === '2p' && player === 0) { openPicker(1); return; }

  if (session.changing && game && !isDemo()) {
    // keep the score, swap the parts, play on
    game.config.parts[0] = session.parts[0];
    game.specs[0] = buildTop(session.parts[0].eraserId, session.parts[0].leadId);
    if (session.mode === '2p') {
      game.config.parts[1] = session.parts[1];
      game.specs[1] = buildTop(session.parts[1].eraserId, session.parts[1].leadId);
    }
    const restart = session.changing === 'match';
    session.changing = null;
    if (restart) beginMatch(); else startRound();
    return;
  }
  beginMatch();
}

function beginMatch() {
  paused = false;
  const p0 = session.parts[0];
  let p1 = session.parts[1];
  if (session.mode === 'cpu') {
    p1 = session.difficulty === 'hard'
      ? pickCombo('hard', buildTop(p0.eraserId, p0.leadId))
      : pickCombo(session.difficulty, null);
  }
  startMatch({ mode: session.mode, difficulty: session.difficulty, parts: [{ ...p0 }, { ...p1 }] });
}

function pause() {
  if (!inPlay() || paused) return;
  paused = true;
  audio.silence();
  input.setPhase('menu');
  ui.show('pause');
}

function resume() {
  if (!paused) return;
  paused = false;
  input.setPhase(game.phase === 'launch' ? 'launch' : 'battle');
  ui.show('hud');
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

function onAction(action, value) {
  switch (action) {
    case 'play-cpu': session = { mode: 'cpu' }; ui.show('difficulty'); break;
    case 'play-2p': session = { mode: '2p' }; openPicker(0); break;
    case 'difficulty': session.difficulty = value; openPicker(0); break;
    case 'howto': ui.show('howto'); break;
    case 'toggle-sound':
      settings.muted = !settings.muted;
      audio.setMuted(settings.muted);
      saveSettings(settings);
      ui.show('title', { muted: settings.muted });
      break;
    case 'ready': partsReady(session.picking, value); break;
    case 'back': back(); break;
    case 'next-round': startRound(); break;
    case 'change-parts':
      session.changing = game.match.state().over ? 'match' : 'round';
      openPicker(0);
      break;
    case 'rematch': beginMatch(); break;
    case 'menu': showTitle(); break;
    case 'pause': pause(); break;
    case 'resume': resume(); break;
  }
}

function back() {
  const screen = ui.current;
  if (screen === 'howto' || screen === 'difficulty') { showTitle(); return; }
  if (screen === 'picker') {
    if (session.picking === 1) { openPicker(0); return; }
    if (session.changing) { session.changing = null; game.resultShown = false; showResult(); return; }
    if (session.mode === 'cpu') { ui.show('difficulty'); return; }
    showTitle();
  }
}

// ---------- HUD + loop ----------
function hints(i) {
  const s = game.launches[i];
  if (isCpu(i)) return s.phase === 'twist' ? 'Twisting…' : s.phase === 'done' ? (s.result?.perfect ? 'PERFECT!' : '') : '';
  const keys = game.config.mode === '2p' && i === 1 ? ['←', '→', '↑'] : ['A', 'D', 'W'];
  if (s.phase === 'place') {
    const left = Math.max(0, LAUNCH.PLACE_TIME - s.t).toFixed(1);
    return coarse ? `Drag to place · ${left}s` : `${keys[0]}/${keys[1]} to place · ${left}s`;
  }
  if (s.phase === 'twist') {
    if (coarse) return 'Flick 2 thumbs! Lift to let go';
    if (game.config.mode === 'cpu') return `Mash ${keys[0]}↔${keys[1]} (or circle the mouse) · ${keys[2]} to let go`;
    return `Mash ${keys[0]}↔${keys[1]}! ${keys[2]} to let go`;
  }
  return s.result?.perfect ? 'PERFECT!' : 'Released';
}

function hud() {
  if (isDemo()) return null;
  const tops = game.world?.tops;
  return {
    names: [0, 1].map(playerName),
    roundWins: game.match.state().wins,
    specialsReady: tops ? tops.map((t) => !t.specialUsed) : [true, true],
    specialNames: tops ? tops.map((t) => SPECIAL_NAMES[t.specialKind]) : game.specs.map((s) => SPECIAL_NAMES[s.special]),
    specialKeys: coarse ? ['', ''] : game.config.mode === '2p' ? ['Space', 'Enter'] : ['Space', ''],
    launchLabels: game.phase === 'launch' ? [0, 1].map(hints) : null,
    overlay: drawTouchControls,
  };
}

function drawTouchControls(ctx, L) {
  if (!coarse || game.phase !== 'battle' || paused) return;
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

function tick(dt) {
  if (game && !paused) {
    if (game.phase === 'launch') stepLaunch(dt);
    else if (game.phase === 'battle' || game.phase === 'over') stepBattle(dt);
  }
  renderer.update(paused ? 0 : dt);
  if (!game) renderer.drawIdle();
  else if (game.phase === 'launch') renderer.drawLaunch(game.launches, hud());
  else renderer.drawBattle(game.world, hud());
}

// Debug handle for the console: inspect state, or step frames by hand
// (useful when the tab is in the background and requestAnimationFrame is paused).
window.rubberRumble = {
  get game() { return game; },
  get session() { return session; },
  advance(seconds, fps = 60) { for (let i = 0; i < Math.round(seconds * fps); i++) tick(1 / fps); },
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tick(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

showTitle();
