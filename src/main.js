// Game flow: title -> (difficulty) -> parts -> ability -> arena -> VS intro -> launch -> battle -> results.
import { buildTop } from './parts.js';
import { createWorld, simulate, CONST } from './physics.js';
import {
  LAUNCH, createLaunch, slide, setPlace, keyStroke, addStroke, release, updateLaunch,
} from './launch.js';
import { cpuLaunch, createCpu, pickCombo, pickAbility } from './ai.js';
import { createRenderer, PLAYER_COLORS, arenaToScreen } from './render.js';
import { createInput, specialButton } from './input.js';
import { twistPad, drawTwistPad } from './twistpad.js';
import { createMatch, roundLabel, POINTS, FINISH_NAMES, TARGET_POINTS } from './match.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { loadSettings, saveSettings } from './settings.js';
import { ABILITIES, ABILITY_IDS, UNLOCK_AT } from './abilities.js';
import { ARENAS, ARENA_IDS } from './arenas.js';
import { INTRO_SECONDS } from './intro.js';
import { lineFor } from './announcer.js';
import { RUNGS, MODIFIERS, advance, bossSpec } from './tournament.js';
import { matchCoins, buy, equip } from './economy.js';
import { FINISHERS, makeSequence, createFinishInput, pickFinisher, cpuFinishes } from './finisher.js';

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

// Phone vibration: only after the player has really touched the page (browsers block it before that).
const buzz = (pattern) => {
  if (!coarse || settings.muted || !navigator.userActivation?.hasBeenActive) return;
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
};

let game = null;     // the match being played or demoed
let session = null;  // menu choices: { mode, difficulty, parts, abilities, arena, changing }
let paused = false;

const input = createInput(canvas, () => renderer.layout, {
  players: 1,
  getAnchor: (p) => {
    const s = game?.launches?.[p];
    if (!s) return null;
    return arenaToScreen(renderer.layout, LAUNCH.START_RADIUS * Math.cos(s.rimAngle), LAUNCH.START_RADIUS * Math.sin(s.rimAngle));
  },
  // phones: the stacked twist grips for each human player during the launch
  getPad: (p) => (coarse && game && !isDemo() && game.phase === 'launch' && !isCpu(p) && game.launches?.[p]?.phase !== 'done'
    ? twistPad(p, renderer.layout, input.players) : null),
  onMute: () => toggleSound(),
  onPause: () => {
    if (game?.phase === 'intro' && !isDemo()) { skipIntro(); return; }
    paused ? resume() : pause();
  },
});

const ui = createUI(document.getElementById('screens'), { action: onAction, click: () => audio.click() });

// ---------- match / rounds ----------
const isDemo = () => game?.config.mode === 'demo';
const vsCpu = () => game.config.mode === 'cpu' || game.config.mode === 'tournament';
const isCpu = (i) => game.config.mode === 'demo' || (vsCpu() && i === 1);
const rungOf = () => (game?.config.mode === 'tournament' ? RUNGS[game.config.rung] : null);
const inPlay = () => game && !isDemo() && (game.phase === 'launch' || game.phase === 'battle');

function startMatch(config) {
  input.setPlayers(config.mode === '2p' ? 2 : 1);
  renderer.setArena(config.arena || 'thali');
  renderer.hud.reset();
  game = {
    config,
    specs: config.parts.map((p, i) => {
      const spec = buildTop(p.eraserId, p.leadId);
      if (i === 0 && config.mode !== 'demo') spec.skin = { ...settings.wallet.equipped };
      return config.boss && i === 1 ? bossSpec(spec) : spec;
    }),
    match: createMatch(),
    round: 0,
    phase: 'idle',
    world: null, launches: null, cpuPlans: [null, null], cpus: [null, null],
    timer: 0, acc: 0, resultShown: false,
    bonus: { flawless: [0, 0], snapko: [0, 0] },
  };
  if (config.mode === 'demo') { startRound(); return; }
  game.phase = 'intro';
  input.setPhase('menu');
  ui.show('intro');
  audio.go();
}

function skipIntro() {
  if (game?.phase !== 'intro') return;
  startRound();
}

addEventListener('keydown', (e) => {
  if (game?.phase === 'intro' && !isDemo() && ['Space', 'Enter', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); skipIntro(); }
});

function introData() {
  const g = game;
  return {
    players: [0, 1].map((i) => ({
      name: playerName(i),
      color: PLAYER_COLORS[i],
      eraserId: g.specs[i].eraserId,
      leadId: g.specs[i].leadId,
      skin: g.specs[i].skin,
      subtitle: rungOf() && i === 1 ? `“${rungOf().taunt}”` : g.specs[i].combo ? `★ ${g.specs[i].combo.name}` : `${g.specs[i].eraserName} + ${g.specs[i].leadName}`,
      ability: g.config.abilities[i],
    })),
    round: rungOf() ? `Rung ${g.config.rung + 1}: ${rungOf().title}` : 'Round 1',
    arenaName: ARENAS[g.config.arena].name,
    arenaLevel: ARENAS[g.config.arena].level,
  };
}

function startRound() {
  const g = game;
  g.round++;
  g.phase = 'launch';
  g.timer = 0;
  g.world = null;
  g.resultShown = false;
  renderer.hud.reset();
  if (g.config.mode === 'cpu' && g.config.difficulty === 'hard' && g.round > 1) {
    const p = pickCombo('hard', g.specs[0]);
    g.config.parts[1] = p;
    g.specs[1] = buildTop(p.eraserId, p.leadId);
    g.config.abilities[1] = pickAbility('hard', g.specs[1], g.specs[0]);
  }
  g.launches = g.specs.map((spec, i) => createLaunch(spec, i));
  const diff = g.config.difficulty || 'medium';
  g.cpuPlans = [0, 1].map((i) => (isCpu(i) ? cpuLaunch(g.specs[i], diff, i) : null));
  g.cpus = [0, 1].map((i) => (isCpu(i) ? createCpu(diff, i) : null));
  if (isDemo()) return;
  input.setPhase('launch');
  ui.show('hud', { muted: settings.muted });
  const done = g.match.state().rounds;
  const label = roundLabel(done, done.length);
  const twist = rungOf()?.modifier ? MODIFIERS[rungOf().modifier] : null;
  renderer.banner(label, { sub: twist ? `${twist.icon} ${twist.name}: ${twist.desc}` : coarse ? 'Drag your top to a spot on the rim' : 'Place your top on the rim', size: 54, life: twist ? 2 : 1.3 });
  g.taken = [0, 0]; // damage taken this round, for Flawless
  g.saidTwist = false;
  audio.boom();
  audio.say(lineFor('round', { label }));
}

function stepLaunch(dt) {
  const g = game;
  if (!g.saidTwist && !isDemo() && g.launches.some((s) => s.phase === 'twist')) {
    g.saidTwist = true;
    audio.say(lineFor('twist'), { rate: 1.1 });
  }
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
    for (const v of inp.strokes) addStroke(s, Math.abs(v), Math.sign(v));
    if (s.rpm > before) { audio.stroke(); buzz(8); }
    if (inp.release) release(s);
    const was = s.phase;
    updateLaunch(s, dt);
    if (was !== 'done' && s.phase === 'done' && s.result.perfect) {
      const p = arenaToScreen(renderer.layout, s.result.x, s.result.y);
      renderer.banner('PERFECT!', { x: p.x, y: p.y - 50, color: '#22a34a', size: 30, life: 1.2 });
      audio.perfect();
      buzz([20, 30, 20]);
    }
  });
  if (g.launches.every((s) => s.phase === 'done')) {
    g.timer += dt;
    if (g.timer > 0.45) startBattle();
  }
}

// left/right speaker position for something at arena point (x, y)
function panAt(x, y) {
  const L = renderer.layout;
  const p = arenaToScreen(L, x, y);
  return Math.max(-0.85, Math.min(0.85, (p.x / L.width) * 2 - 1));
}

function startBattle() {
  const g = game;
  g.phase = 'battle';
  g.timer = 0;
  g.acc = 0;
  g.world = createWorld(g.specs, g.launches.map((s) => s.result), Math.random, {
    abilities: g.config.abilities, arena: ARENAS[g.config.arena], mods: g.config.mods || null,
  });
  if (isDemo()) return;
  input.setPhase('battle');
  renderer.banner('GHUMAO!', { sub: 'Spin it!', size: 70, life: 1.1 });
  audio.go();
  audio.boom();
  audio.say(lineFor('fight'), { rate: 1, pitch: 0.7 });
  buzz(30);
}

function stepBattle(dt) {
  const g = game;
  const w = g.world;
  if (!w.over) {
    const intents = [0, 1].map((i) => {
      if (isCpu(i)) return g.cpus[i].think(w, dt);
      const inp = input.poll(i);
      return { steer: inp.steer, special: inp.special, mash: inp.taps };
    });
    g.acc = simulate(w, g.acc + dt, intents);
  }
  if (!isDemo()) {
    renderer.spawnFromEvents(w.events, w);
    for (const e of w.events) {
      if (e.type === 'hit') { audio.hit(e.impact, panAt(e.x, e.y)); if (e.impact > 0.8) buzz(15); }
      else if (e.type === 'snap') { audio.snap(); buzz([60, 40, 90]); audio.say(lineFor('snap')); }
      else if (e.type === 'damage') g.taken[e.i] += e.amount;
      else if (e.type === 'crumble') { audio.crumble(); buzz([90, 50, 140]); }
      else if (e.type === 'clashStart') { audio.clack(2); audio.grind(true); audio.say(lineFor('clash')); buzz([40, 30, 40, 30, 40]); }
      else if (e.type === 'clashEnd') { audio.grind(false); audio.special(); buzz(60); }
      else if (e.type === 'special') { audio.special(); buzz(25); }
      else if (e.type === 'unlock') { audio.perfect(); if (!isCpu(e.i)) { buzz([30, 40, 30]); audio.say(lineFor('unlock'), { rate: 1.1 }); } }
      else if (e.type === 'block') audio.hit(1, panAt(w.tops[e.i].x, w.tops[e.i].y), 'shield');
      else if (e.type === 'bump') audio.hit(e.impact * 1.5, panAt(e.x, e.y), 'metal');
      else if (e.type === 'quake') { audio.boom(); buzz(120); }
    }
    w.tops.forEach((t, i) => audio.spin(i, w.over || w.clash ? 0 : t.rpm / t.spec.maxRPM, { wobble: t.wobble, pan: panAt(t.x, t.y) }));
    if (w.clash) audio.grind(true);
  } else {
    renderer.spawnFromEvents(w.events.filter((e) => e.type === 'hit'), w, true);
  }
  for (const e of w.events) if (e.type === 'end') endRound(e.result);
  w.events.length = 0;

  if (g.phase === 'over') {
    g.timer += dt;
    if (isDemo()) { if (g.timer > 1.5) { startRound(); } return; }
    if (g.timer > 1.9 && !g.resultShown) {
      if (g.match.state().over && !g.finish) { startFinish(); return; }
      g.resultShown = true;
      showResult();
    }
  }
}

const REASON = {
  stopped: 'ran out of health', tipped: 'tipped over', ringout: 'got knocked out of the arena', snapko: 'crumbled: lead snapped twice',
  time: 'had more health at the bell', draw: 'Both tops gave up together. Replay!',
};

const SHORT = { stopped: 'Spin Finish', tipped: 'Tip Finish', ringout: 'Knock-Out', time: 'Spin Finish', snapko: 'Snap KO' };

function playerName(i) {
  if (game.config.mode === 'tournament') return i === 0 ? 'You' : RUNGS[game.config.rung].name;
  if (game.config.mode === 'cpu') return i === 0 ? 'You' : 'CPU';
  return `Player ${i + 1}`;
}

function describe(result) {
  if (result.winner === null) return REASON.draw;
  if (result.reason === 'time') return `${playerName(result.winner)} ${REASON.time}`;
  return `${playerName(1 - result.winner)} ${REASON[result.reason]}`;
}

function winsWord(i) { return vsCpu() && i === 0 ? 'win' : 'wins'; }

function endRound(result) {
  const g = game;
  g.phase = 'over';
  g.timer = 0;
  g.lastResult = result;
  if (isDemo()) return;
  input.setPhase('menu');
  audio.silence();
  g.match.record(result);
  const flawless = result.winner !== null && (g.taken?.[result.winner] || 0) < 1;
  g.lastFlawless = flawless;
  if (result.winner !== null) {
    if (flawless) g.bonus.flawless[result.winner]++;
    if (result.reason === 'snapko') g.bonus.snapko[result.winner]++;
  }
  audio.boom();
  audio.say(lineFor('finish', { reason: result.winner === null ? 'draw' : result.reason, flawless }));
  if (result.winner === null) {
    renderer.banner('Draw!', { sub: describe(result), size: 64, life: 2 });
  } else if (flawless) {
    renderer.banner('FLAWLESS!', { sub: `${FINISH_NAMES[result.reason]} +${POINTS[result.reason] ?? 1} · ${playerName(result.winner)} took no damage`, color: PLAYER_COLORS[result.winner], size: 70, life: 2.2 });
  } else {
    const pts = POINTS[result.reason] ?? 1;
    renderer.banner(`${FINISH_NAMES[result.reason].toUpperCase()}! +${pts}`,
      { sub: `${playerName(result.winner)} · ${describe(result)}`, color: PLAYER_COLORS[result.winner], size: 64, life: 2 });
  }
  buzz(result.winner === 0 || game.config.mode === '2p' ? [40, 60, 40] : 120);
}

function showResult() {
  const g = game;
  const st = g.match.state();
  const names = [playerName(0), playerName(1)];
  const r = g.lastResult;
  if (st.over) {
    if (!g.endSoundPlayed) { // not again when coming Back from Change parts
      g.endSoundPlayed = true;
      g.coinResult = payOut(st);
      const youLost = vsCpu() && st.winner === 1;
      youLost ? audio.lose() : audio.win();
      setTimeout(() => audio.say(lineFor('match', { name: names[st.winner] })), 500);
    }
    ui.show('match', {
      headline: vsCpu() ? (st.winner === 0 ? 'You win the match!' : `${names[1]} wins the match`) : `Player ${st.winner + 1} wins!`,
      ...tournamentResult(st),
      color: PLAYER_COLORS[st.winner], names, wins: st.points,
      extra: g.rubberality ? `💥 Finished with a Rubberality: ${FINISHERS[g.finish.finisher].name}!` : '',
      coins: g.coinResult,
      rounds: st.rounds.map((x, k) => `${roundLabel(st.rounds, k)}: ${x.winner === null ? 'draw' : `${names[x.winner]} · ${SHORT[x.reason]} +${x.points}`}`),
    });
  } else {
    ui.show('round', {
      headline: r.winner === null ? 'Draw!' : `${names[r.winner]} ${winsWord(r.winner)} ${roundLabel(st.rounds, st.rounds.length - 1).replace(' (replay)', '').toLowerCase()}!`,
      sub: r.winner === null ? describe(r) : `${SHORT[r.reason]} +${st.rounds[st.rounds.length - 1].points} · first to ${TARGET_POINTS} points wins`,
      color: r.winner === null ? '#1f2a44' : PLAYER_COLORS[r.winner],
      names, wins: st.points, draw: r.winner === null,
    });
  }
}

// ---------- FINISH IT! ----------
function startFinish() {
  const g = game;
  const winner = g.match.state().winner;
  const seq = makeSequence();
  g.phase = 'finishit';
  g.finish = {
    winner, loser: 1 - winner, seq, input: createFinishInput(seq),
    finisher: pickFinisher(g.specs[winner].archetype), status: 'input', anim: 0,
    cpu: isCpu(winner), cpuAt: 1.2 + Math.random() * 1.2, cpuWill: isCpu(winner) && cpuFinishes(g.config.difficulty || 'medium'),
  };
  input.setPhase(isCpu(winner) ? 'menu' : 'finish');
  ui.show('hud', { muted: settings.muted });
  audio.boom();
  audio.say(lineFor('finishIt'), { rate: 0.85, pitch: 0.6 });
  buzz([50, 50, 50]);
}

function stepFinish(dt) {
  const g = game, f = g.finish;
  if (f.status === 'input') {
    if (f.cpu) {
      f.input.tick(dt);
      if (f.input.state.t >= f.cpuAt) {
        if (f.cpuWill) { for (const m of f.seq) f.input.feed(m); } else f.input.state.status = 'timeout';
      }
    } else {
      for (let i = 0; i < 2; i++) {
        const inp = input.poll(i);
        if (i !== f.winner) continue;
        for (const m of inp.moves) {
          const r = f.input.feed(m);
          if (r === 'progress' || r === 'done') { audio.click(); buzz(12); } else if (r === 'wrong') audio.clack(0.3);
        }
      }
      f.input.tick(dt);
    }
    if (f.input.state.status === 'done') {
      f.status = 'anim';
      f.anim = 0;
      input.setPhase('menu');
      audio.say(lineFor('rubberality'), { rate: 0.85, pitch: 0.6 });
      audio.crumble();
      buzz([80, 40, 80, 40, 160]);
    } else if (f.input.state.status === 'timeout') {
      f.status = 'fail';
      f.anim = 0;
      input.setPhase('menu');
    }
  } else {
    f.anim += dt;
    if (f.anim > (f.status === 'anim' ? 3.4 : 1.3)) {
      g.phase = 'over';
      g.resultShown = true;
      g.rubberality = f.status === 'anim';
      showResult();
    }
  }
}

function finishFrame() {
  const f = game.finish;
  if (!f) return null;
  const twoP = game.config.mode === '2p';
  const keyNames = f.winner === 1 && twoP
    ? { up: '↑', down: '↓', left: '←', right: '→', special: 'Enter' }
    : { up: 'W', down: 'S', left: 'A', right: 'D', special: 'Space' };
  return {
    status: f.status, seq: f.seq, progress: f.input.state.progress, t: f.input.state.t, anim: f.anim,
    winner: f.winner, loser: f.loser, finisher: f.finisher, name: FINISHERS[f.finisher].name,
    cpu: f.cpu, touch: coarse, keyNames,
  };
}

// ---------- menus ----------
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

function startDemo() {
  const a = pickCombo('medium', null), b = pickCombo('medium', null);
  input.setPhase('menu');
  startMatch({
    mode: 'demo', difficulty: 'medium', parts: [a, b],
    abilities: [pickOne(ABILITY_IDS), pickOne(ABILITY_IDS)], arena: pickOne(ARENA_IDS),
  });
}

function showTitle() {
  paused = false;
  session = null;
  audio.silence();
  startDemo();
  ui.show('title', { muted: settings.muted, coins: settings.wallet.coins });
}

// sound on/off from the arena button or the M key (same setting as the title screen)
function toggleSound() {
  settings.muted = !settings.muted;
  audio.setMuted(settings.muted);
  if (settings.muted) audio.silence();
  saveSettings(settings);
  if (ui.current === 'hud') ui.show('hud', { muted: settings.muted });
  if (ui.current === 'title') ui.show('title', { muted: settings.muted, coins: settings.wallet.coins });
}

// ---------- pocket money ----------
// Coins go to the human: player 1 against the computer, or the winner in a 2-player match.
function payOut(st) {
  const g = game;
  const who = vsCpu() ? 0 : st.winner;
  const won = st.winner === who;
  const rung = g.config.rung ?? 0;
  const r = matchCoins({
    mode: g.config.mode, difficulty: g.config.difficulty, won,
    roundsWon: st.wins[who], flawless: g.bonus.flawless[who], snapko: g.bonus.snapko[who],
    rubberality: !!g.rubberality && won,
    rung, champion: g.config.mode === 'tournament' && won && rung === RUNGS.length - 1,
  });
  settings.wallet = { ...settings.wallet, coins: settings.wallet.coins + r.total };
  saveSettings(settings);
  return { ...r, balance: settings.wallet.coins };
}

function showShop(message = '') {
  const parts = settings.lastParts[0];
  ui.show('shop', { wallet: settings.wallet, eraserId: parts.eraserId, leadId: parts.leadId, message });
}

// ---------- School Tournament ----------
function showLadder() {
  paused = false;
  audio.silence();
  if (!game || !isDemo()) startDemo();
  ui.show('ladder', { progress: settings.tournament });
}

function tournamentResult(st) {
  const g = game;
  if (g.config.mode !== 'tournament') return {};
  const won = st.winner === 0;
  if (!g.ladderSaved) { // move up the ladder once per match
    g.ladderSaved = true;
    if (g.config.rung === settings.tournament.rung) settings.tournament = advance(settings.tournament, won);
    saveSettings(settings);
  }
  const champ = won && g.config.rung === RUNGS.length - 1;
  const next = RUNGS[g.config.rung + 1];
  const buttons = won
    ? [
      { action: 'ladder', label: champ ? '🏆 You are School Champion!' : `Next: ${next.name} ▶`, primary: true },
      { action: 'menu', label: 'Main menu' },
    ]
    : [
      { action: 'rematch', label: 'Try again', primary: true },
      { action: 'change-parts', label: 'Change parts' },
      { action: 'ladder', label: 'Back to the ladder' },
    ];
  return { buttons, kicker: `School Tournament · ${RUNGS[g.config.rung].title}` };
}

function who(player) { return session.mode === '2p' ? `Player ${player + 1},` : 'You,'; }

function openPicker(player) {
  session.picking = player;
  const parts = session.parts?.[player] || settings.lastParts[player];
  let note = '';
  if (session.mode === 'tournament') {
    const r = RUNGS[session.rung];
    note = `Next up: ${r.name} — “${r.taunt}”`;
  } else if (session.mode === 'cpu') {
    note = `Versus the computer (${session.difficulty}).`;
    if (session.difficulty === 'hard') note += ' It will counter-pick whatever you build.';
  } else if (player === 1) note = 'Player 1 is ready. Player 2, your turn!';
  else note = 'Pass the device after you pick.';
  ui.show('picker', {
    player, who: who(player), color: PLAYER_COLORS[player], note,
    eraserId: parts.eraserId, leadId: parts.leadId,
    skin: player === 0 ? { ...settings.wallet.equipped } : undefined,
  });
}

function openAbility(player) {
  session.picking = player;
  ui.show('ability', {
    who: who(player), color: PLAYER_COLORS[player],
    selected: session.abilities?.[player] || settings.lastAbility[player],
  });
}

function partsReady(player, parts) {
  session.parts = session.parts || [];
  session.parts[player] = parts;
  settings.lastParts[player] = parts;
  saveSettings(settings);
  openAbility(player);
}

function abilityReady(player, ability) {
  session.abilities = session.abilities || [];
  session.abilities[player] = ability;
  settings.lastAbility[player] = ability;
  saveSettings(settings);
  if (session.mode === '2p' && player === 0) { openPicker(1); return; }
  if (session.changing && game && !isDemo()) { applyChanges(); return; }
  if (session.mode === 'tournament') { beginMatch(); return; } // each rung has its own arena
  ui.show('arena', { selected: session.arena || settings.lastArena });
}

function applyChanges() {
  // keep the score, swap the parts and abilities, play on
  const humans = session.mode === '2p' ? [0, 1] : [0];
  for (const i of humans) {
    game.config.parts[i] = session.parts[i];
    game.specs[i] = buildTop(session.parts[i].eraserId, session.parts[i].leadId);
    game.config.abilities[i] = session.abilities[i];
  }
  const restart = session.changing === 'match';
  session.changing = null;
  if (restart) beginMatch(); else startRound();
}

function arenaReady(id) {
  session.arena = id;
  settings.lastArena = id;
  saveSettings(settings);
  beginMatch();
}

function beginMatch() {
  paused = false;
  const p0 = session.parts[0];
  let p1 = session.parts[1];
  const abilities = [session.abilities[0], session.abilities[1]];
  if (session.mode === 'tournament') {
    const r = RUNGS[session.rung];
    startMatch({
      mode: 'tournament', rung: session.rung, difficulty: r.difficulty, parts: [{ ...p0 }, { ...r.parts }],
      abilities: [session.abilities[0], r.ability], arena: r.arena,
      mods: r.modifier ? MODIFIERS[r.modifier].mods : null, boss: !!r.boss,
    });
    return;
  }
  if (session.mode === 'cpu') {
    const mine = buildTop(p0.eraserId, p0.leadId);
    p1 = session.difficulty === 'hard' ? pickCombo('hard', mine) : pickCombo(session.difficulty, null);
    abilities[1] = pickAbility(session.difficulty, buildTop(p1.eraserId, p1.leadId), mine);
  }
  startMatch({
    mode: session.mode, difficulty: session.difficulty, parts: [{ ...p0 }, { ...p1 }],
    abilities, arena: session.arena || 'thali',
  });
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
  ui.show('hud', { muted: settings.muted });
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

function onAction(action, value) {
  switch (action) {
    case 'play-cpu': session = { mode: 'cpu' }; ui.show('difficulty'); break;
    case 'play-2p': session = { mode: '2p' }; openPicker(0); break;
    case 'tournament': session = { mode: 'tournament' }; showLadder(); break;
    case 'shop': showShop(); break;
    case 'toggle-sound-hud': toggleSound(); break;
    case 'shop-buy': {
      const res = buy(settings.wallet, value);
      if (res.ok) {
        settings.wallet = equip(res.wallet, value).wallet; // wear it straight away
        saveSettings(settings);
        audio.perfect();
        showShop();
      } else showShop(res.reason === 'coins' ? 'Not enough coins yet — win some matches!' : '');
      break;
    }
    case 'shop-equip':
      settings.wallet = equip(settings.wallet, value).wallet;
      saveSettings(settings);
      showShop();
      break;
    case 'ladder': session = { mode: 'tournament', parts: session?.parts, abilities: session?.abilities }; showLadder(); break;
    case 'fight-rung':
      session.rung = Number(value);
      session.difficulty = RUNGS[session.rung].difficulty;
      openPicker(0);
      break;
    case 'difficulty': session.difficulty = value; openPicker(0); break;
    case 'howto': ui.show('howto'); break;
    case 'toggle-sound':
      settings.muted = !settings.muted;
      audio.setMuted(settings.muted);
      saveSettings(settings);
      ui.show('title', { muted: settings.muted, coins: settings.wallet.coins });
      break;
    case 'ready': partsReady(session.picking, value); break;
    case 'ability-ready': abilityReady(session.picking, value); break;
    case 'arena-ready': arenaReady(value); break;
    case 'skip-intro': skipIntro(); break;
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
  if (screen === 'howto' || screen === 'difficulty' || screen === 'ladder' || screen === 'shop') { showTitle(); return; }
  if (screen === 'ability') { openPicker(session.picking); return; }
  if (screen === 'arena') { openAbility(session.mode === '2p' ? 1 : 0); return; }
  if (screen === 'picker') {
    if (session.picking === 1) { openAbility(0); return; }
    if (session.changing) { session.changing = null; game.resultShown = false; showResult(); return; }
    if (session.mode === 'cpu') { ui.show('difficulty'); return; }
    if (session.mode === 'tournament') { showLadder(); return; }
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
    if (coarse) return s.spinDir ? 'Keep rubbing! Lift both thumbs to launch' : 'Rub the two grips! First swipe sets the spin';
    if (vsCpu()) return `Mash ${keys[0]}↔${keys[1]} · start on ${keys[1]} for ↻, ${keys[0]} for ↺ · ${keys[2]} to let go`;
    return `Mash ${keys[0]}↔${keys[1]}! ${keys[2]} to let go`;
  }
  return s.result?.perfect ? 'PERFECT!' : 'Released';
}

function hudData() {
  if (isDemo()) return null;
  const w = game.world;
  const keys = coarse ? ['', ''] : game.config.mode === '2p' ? ['Space', 'Enter'] : ['Space', ''];
  return {
    players: [0, 1].map((i) => {
      const t = w?.tops[i];
      return {
        name: playerName(i),
        color: PLAYER_COLORS[i],
        eraserId: game.specs[i].eraserId,
        skin: game.specs[i].skin,
        health: t ? t.rpm / t.spec.maxRPM : null,
        points: game.match.state().points[i],
        target: TARGET_POINTS,
        ability: { kind: game.config.abilities[i], unlocked: !!t?.unlocked, used: !!t?.specialUsed, key: keys[i] },
      };
    }),
    time: w ? CONST.TIME_LIMIT - w.time : CONST.TIME_LIMIT,
  };
}

function frameData() {
  if (isDemo()) return null;
  const humans = game.config.mode === '2p' ? [true, true] : [true, false];
  return {
    hudData: hudData(),
    launchLabels: game.phase === 'launch' ? [0, 1].map(hints) : null,
    finish: game.phase === 'finishit' ? finishFrame() : null,
    clashHint: coarse ? 'SPIN CLASH! TAP TAP TAP!' : game.config.mode === '2p' ? 'MASH!  P1: A/D   P2: ←/→' : 'MASH A / D!',
    pads: coarse && game.phase === 'launch' ? humans.map((h, i) => h && game.launches[i].phase === 'twist') : null,
    overlay: drawTouchControls,
  };
}

function drawTwistPads(ctx, L) {
  const humans = game.config.mode === '2p' ? [0, 1] : [0];
  for (const i of humans) {
    const s = game.launches[i];
    if (!s || s.phase === 'done') continue;
    drawTwistPad(ctx, twistPad(i, L, input.players), input.padState(i) || {}, {
      color: PLAYER_COLORS[i], clock: renderer.clock, dim: s.phase === 'place',
    });
  }
}

function drawTouchControls(ctx, L) {
  if (!coarse || paused) return;
  if (game.phase === 'launch') { drawTwistPads(ctx, L); return; }
  if (game.phase !== 'battle') return;
  const humans = game.config.mode === '2p' ? [0, 1] : [0];
  for (const i of humans) {
    const b = specialButton(i, L.width, L.height, input.players);
    const t = game.world.tops[i];
    const a = ABILITIES[t.specialKind];
    const ready = t.unlocked && !t.specialUsed;
    const clock = renderer.clock;
    ctx.save();
    if (ready) {
      const pulse = 0.5 + 0.5 * Math.sin(clock * 9);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 6 + pulse * 6, 0, Math.PI * 2);
      ctx.fillStyle = `${a.color}55`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = ready ? a.color : t.specialUsed ? 'rgba(40,40,50,0.35)' : 'rgba(255,253,246,0.85)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = PLAYER_COLORS[i];
    ctx.stroke();
    if (!t.unlocked) {
      // progress toward unlocking: fills as health falls to 30%
      const health = Math.max(0, t.rpm / t.spec.maxRPM);
      const prog = Math.max(0, Math.min(1, (1 - health) / (1 - UNLOCK_AT)));
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 6, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.font = `700 ${b.r * 0.8}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.fillStyle = ready ? '#fff' : '#1f2a44';
    ctx.fillText(t.unlocked ? a.icon : '🔒', b.x, b.y + 2);
    ctx.restore();
    const j = input.joystick(i);
    if (j) {
      ctx.beginPath();
      ctx.arc(j.x, j.y, 60, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const m = Math.hypot(j.dx, j.dy), k = m > 60 ? 60 / m : 1;
      ctx.beginPath();
      ctx.arc(j.x + j.dx * k, j.y + j.dy * k, 22, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_COLORS[i];
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function tick(dt) {
  const sdt = dt * renderer.timeScale;
  if (game && !paused) {
    if (game.phase === 'intro') {
      game.timer += dt;
      if (game.timer >= INTRO_SECONDS) startRound();
    } else if (game.phase === 'finishit') stepFinish(dt);
    else if (game.phase === 'launch') stepLaunch(sdt);
    else if (game.phase === 'battle' || game.phase === 'over') stepBattle(sdt);
  }
  renderer.update(paused ? 0 : dt);
  const w = game?.world;
  renderer.hud.update(paused ? 0 : dt, w ? w.tops.map((t) => t.rpm / t.spec.maxRPM) : null);
  if (!game) renderer.drawIdle();
  else if (game.phase === 'intro') renderer.drawIntro(Math.min(1, game.timer / INTRO_SECONDS), introData());
  else if (game.phase === 'launch') renderer.drawLaunch(game.launches, frameData());
  else renderer.drawBattle(game.world, frameData());
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
  try {
    tick(dt);
  } finally {
    requestAnimationFrame(frame); // one bad frame must never stop the game
  }
}
requestAnimationFrame(frame);

showTitle();
