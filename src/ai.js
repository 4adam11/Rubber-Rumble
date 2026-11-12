// Computer opponent. Pure: no DOM.
import { ERASERS, LEADS, buildTop } from './parts.js';
import { LAUNCH } from './launch.js';

export const DIFFICULTY = {
  easy: { rpm: 0.60, spread: 0.10, perfect: 0.10, reaction: 0.5 },
  medium: { rpm: 0.80, spread: 0.08, perfect: 0.35, reaction: 0.25 },
  hard: { rpm: 0.92, spread: 0.05, perfect: 0.65, reaction: 0.1 },
};

const pick = (arr, rng) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
const isBad = (e, l) => !!buildTop(e, l).combo?.bad;

function steadiestLead(eraserId) {
  const leads = [...LEADS].sort((a, b) => b.stability - a.stability);
  return leads.find((l) => !isBad(eraserId, l.id)).id;
}

const COUNTER = { attack: 'defense', defense: 'stamina', stamina: 'attack' };

export function pickCombo(difficulty, opponentSpec, rng = Math.random) {
  if (difficulty === 'hard' && opponentSpec) {
    const want = COUNTER[opponentSpec.archetype];
    if (!want) return { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' }; // Deadly Duo
    const eraserId = pick(ERASERS.filter((e) => e.archetype === want), rng).id;
    return { eraserId, leadId: steadiestLead(eraserId) };
  }
  for (;;) {
    const eraserId = pick(ERASERS, rng).id;
    const leadId = pick(LEADS, rng).id;
    if (difficulty === 'easy' || !isBad(eraserId, leadId)) return { eraserId, leadId };
  }
}

export function cpuLaunch(spec, difficulty, side, rng = Math.random) {
  const d = DIFFICULTY[difficulty];
  const frac = Math.max(0.3, Math.min(1, d.rpm + d.spread * (rng() * 2 - 1)));
  const perfect = rng() < d.perfect;
  const angle = (side === 0 ? Math.PI : 0) + (rng() * 2 - 1) * LAUNCH.SLIDE_RANGE * 0.5;
  return {
    x: LAUNCH.START_RADIUS * Math.cos(angle),
    y: LAUNCH.START_RADIUS * Math.sin(angle),
    rpm: spec.maxRPM * frac * (perfect ? 1.05 : 1),
    wobble: perfect ? 0 : 0.1 + 0.3 * rng(),
    perfect,
  };
}

function norm(x, y, scale = 1) {
  const m = Math.hypot(x, y);
  return m < 1e-9 ? { x: 0, y: 0 } : { x: (x / m) * scale, y: (y / m) * scale };
}

function wantsSpecial(me, opp) {
  if (me.specialUsed) return false;
  const dist = Math.hypot(opp.x - me.x, opp.y - me.y);
  switch (me.specialKind) {
    case 'dash': return dist < 0.4;
    case 'plant': {
      const nx = (me.x - opp.x) / (dist || 1), ny = (me.y - opp.y) / (dist || 1);
      const closing = (opp.vx - me.vx) * nx + (opp.vy - me.vy) * ny;
      return dist < 0.5 && closing > 0.8;
    }
    case 'secondWind': return me.rpm < 0.3 * me.spec.maxRPM;
    case 'recentre': return me.wobble > 0.6;
    default: return false;
  }
}

function decide(world, index) {
  const me = world.tops[index], opp = world.tops[1 - index];
  const d = Math.hypot(me.x, me.y);
  let steer;
  if (d > 0.75) {
    steer = norm(-me.x, -me.y);
  } else if (me.rpm > opp.rpm && me.spec.attack >= opp.spec.defense) {
    steer = norm(opp.x - me.x, opp.y - me.y);
  } else {
    // orbit near radius 0.35, tangent plus a radial correction
    const tx = d > 1e-9 ? -me.y / d : 0, ty = d > 1e-9 ? me.x / d : 1;
    const rx = d > 1e-9 ? me.x / d : 1, ry = d > 1e-9 ? me.y / d : 0;
    const corr = (0.35 - d) * 2;
    steer = norm(tx + rx * corr, ty + ry * corr, 0.6);
  }
  return { steer, special: wantsSpecial(me, opp) };
}

export function createCpu(difficulty, index, rng = Math.random) {
  const reaction = DIFFICULTY[difficulty].reaction;
  let timer = reaction;
  let intent = { steer: { x: 0, y: 0 }, special: false };
  return {
    think(world, dt) {
      timer += dt;
      if (timer >= reaction) {
        timer = rng() * reaction * 0.2; // small jitter so CPUs don't act in lockstep
        intent = decide(world, index);
        return intent;
      }
      return { steer: intent.steer, special: false };
    },
  };
}
