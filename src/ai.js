// Computer opponent. Pure: no DOM.
import { ERASERS, LEADS, buildTop } from './parts.js';
import { LAUNCH, seatAngle, seatRange } from './launch.js';
import { ABILITY_IDS } from './abilities.js';

export const DIFFICULTY = {
  easy: { rpm: 0.60, spread: 0.10, perfect: 0.10, reaction: 0.5 },
  medium: { rpm: 0.80, spread: 0.08, perfect: 0.35, reaction: 0.25 },
  hard: { rpm: 0.92, spread: 0.05, perfect: 0.65, reaction: 0.1 },
};

const MASH_RATE = { easy: 4, medium: 6, hard: 8 }; // taps per second in a spin clash
const lerp = (a, b, t) => a + (b - a) * t;

// How the computer plays at a difficulty: 'easy' | 'medium' | 'hard', or a Rising level 1–7
// (1 = Easy, 4 = Medium, 7 = Hard, the levels between blend evenly). `smarts` is how cleverly
// it picks its top and ability. Anything unrecognised plays as medium.
export function profile(difficulty) {
  if (typeof difficulty === 'number' && Number.isFinite(difficulty)) {
    const lv = Math.max(1, Math.min(7, Math.round(difficulty)));
    const [from, to, t] = lv <= 4 ? ['easy', 'medium', (lv - 1) / 3] : ['medium', 'hard', (lv - 4) / 3];
    const a = DIFFICULTY[from], b = DIFFICULTY[to];
    return {
      rpm: lerp(a.rpm, b.rpm, t), spread: lerp(a.spread, b.spread, t), perfect: lerp(a.perfect, b.perfect, t),
      reaction: lerp(a.reaction, b.reaction, t), mash: lerp(MASH_RATE[from], MASH_RATE[to], t),
      smarts: lv <= 2 ? 'easy' : lv <= 5 ? 'medium' : 'hard',
    };
  }
  const name = DIFFICULTY[difficulty] ? difficulty : 'medium';
  return { ...DIFFICULTY[name], mash: MASH_RATE[name], smarts: name };
}

const pick = (arr, rng) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
const isBad = (e, l) => !!buildTop(e, l).combo?.bad;

function steadiestLead(eraserId, pool = LEADS) {
  const leads = [...pool].sort((a, b) => b.stability - a.stability);
  return (leads.find((l) => !isBad(eraserId, l.id)) || leads[0]).id;
}

const COUNTER = { attack: 'defense', defense: 'stamina', stamina: 'attack' };

// The computer's top. With a `kit` ({ erasers, leads, abilities }: the parts a solo player has earned)
// it builds only from those parts, so it never fields something the player cannot have yet.
export function pickCombo(difficulty, opponentSpec, rng = Math.random, kit = null) {
  const smarts = profile(difficulty).smarts;
  const erasers = kit ? ERASERS.filter((e) => kit.erasers.includes(e.id)) : ERASERS;
  const leads = kit ? LEADS.filter((l) => kit.leads.includes(l.id)) : LEADS;
  if (smarts === 'hard' && opponentSpec) {
    const want = COUNTER[opponentSpec.archetype];
    const has = (list, id) => list.some((x) => x.id === id);
    if (!want && has(erasers, 'apsara-nondust') && has(leads, 'nataraj-hb')) return { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' }; // Deadly Duo
    const counters = want ? erasers.filter((e) => e.archetype === want) : [];
    if (counters.length) {
      const eraserId = pick(counters, rng).id;
      return { eraserId, leadId: steadiestLead(eraserId, leads) };
    }
    // the kit has nothing that counters: any sensible top from it
  }
  for (let tries = 0; ; tries++) {
    const eraserId = pick(erasers, rng).id;
    const leadId = pick(leads, rng).id;
    // (a tiny kit may hold nothing but the bad combo: give up looking after a while)
    if (smarts === 'easy' || !isBad(eraserId, leadId) || tries >= 200) return { eraserId, leadId };
  }
}

export function cpuLaunch(spec, difficulty, side, rng = Math.random, seats = 2) {
  const d = profile(difficulty);
  const frac = Math.max(0.3, Math.min(1, d.rpm + d.spread * (rng() * 2 - 1)));
  const perfect = rng() < d.perfect;
  const angle = seatAngle(side, seats) + (rng() * 2 - 1) * seatRange(seats) * 0.5;
  return {
    x: LAUNCH.START_RADIUS * Math.cos(angle),
    y: LAUNCH.START_RADIUS * Math.sin(angle),
    rpm: spec.maxRPM * frac * (perfect ? 1.05 : 1),
    wobble: perfect ? 0 : 0.1 + 0.3 * rng(),
    perfect,
    spinDir: rng() < 0.5 ? -1 : 1,
  };
}

function norm(x, y, scale = 1) {
  const m = Math.hypot(x, y);
  return m < 1e-9 ? { x: 0, y: 0 } : { x: (x / m) * scale, y: (y / m) * scale };
}

function wantsSpecial(me, opp, world) {
  const open = me.unlocked || me.rpm <= (world.unlockAt ?? 0.3) * me.spec.maxRPM;
  if (me.specialUsed || !open) return false;
  const dist = Math.hypot(opp.x - me.x, opp.y - me.y);
  const nx = (me.x - opp.x) / (dist || 1), ny = (me.y - opp.y) / (dist || 1);
  const closing = (opp.vx - me.vx) * nx + (opp.vy - me.vy) * ny;
  switch (me.specialKind) {
    case 'dash': return dist < 0.5;
    case 'plant': return dist < 0.5 && closing > 0.5;
    case 'shield': return dist < 0.6 && closing > 0.3;
    case 'crumbs': return dist < 0.7;
    case 'secondWind': return true; // unlocked means health is already low
    case 'recentre': return me.wobble > 0.4 || Math.hypot(me.x, me.y) > 0.7;
    default: return false;
  }
}

// Which comeback ability the computer brings.
const SUITS = {
  attack: ['dash', 'crumbs'], defense: ['plant', 'shield'], stamina: ['secondWind', 'crumbs'],
  balance: ['recentre', 'secondWind'], wildcard: ['secondWind', 'shield'],
};
const COUNTER_ABILITY = { attack: 'shield', defense: 'secondWind', stamina: 'dash', balance: 'crumbs', wildcard: 'crumbs' };

export function pickAbility(difficulty, mySpec, oppSpec, rng = Math.random, kit = null) {
  const smarts = profile(difficulty).smarts;
  const owned = (id) => !kit || kit.abilities.includes(id);
  if (smarts === 'hard' && oppSpec && owned(COUNTER_ABILITY[oppSpec.archetype])) return COUNTER_ABILITY[oppSpec.archetype];
  if (smarts !== 'easy' && mySpec && (smarts === 'medium' || kit)) {
    const suits = SUITS[mySpec.archetype].filter(owned);
    if (suits.length) return pick(suits, rng);
  }
  return pick(kit ? kit.abilities : ABILITY_IDS, rng);
}

// the closest rival still spinning (with two tops: the other one)
function nearestRival(world, index) {
  const me = world.tops[index];
  let best = null, bd = Infinity;
  world.tops.forEach((t, j) => {
    if (j === index || t.out) return;
    const d = Math.hypot(t.x - me.x, t.y - me.y);
    if (d < bd) { bd = d; best = t; }
  });
  return best || world.tops[(index + 1) % world.tops.length];
}

function decide(world, index) {
  const me = world.tops[index], opp = nearestRival(world, index);
  const d = Math.hypot(me.x, me.y);
  let steer;
  const arch = me.spec.archetype;
  const healthy = me.rpm > 0.25 * me.spec.maxRPM;
  if (d > 0.75) {
    steer = norm(-me.x, -me.y);
  } else if (arch === 'attack' && healthy) {
    steer = norm(opp.x - me.x, opp.y - me.y); // attackers ram
  } else if (arch === 'defense') {
    steer = d > 0.12 ? norm(-me.x, -me.y, 0.35) : { x: 0, y: 0 }; // hold the middle
  } else if (me.rpm > opp.rpm && me.spec.attack >= opp.spec.defense) {
    steer = norm(opp.x - me.x, opp.y - me.y);
  } else {
    // orbit near radius 0.35, tangent plus a radial correction
    const tx = d > 1e-9 ? -me.y / d : 0, ty = d > 1e-9 ? me.x / d : 1;
    const rx = d > 1e-9 ? me.x / d : 1, ry = d > 1e-9 ? me.y / d : 0;
    const corr = (0.35 - d) * 2;
    steer = norm(tx + rx * corr, ty + ry * corr, 0.35);
  }
  return { steer, special: wantsSpecial(me, opp, world) };
}

export function createCpu(difficulty, index, rng = Math.random) {
  const { reaction, mash } = profile(difficulty);
  let mashAcc = 0;
  let timer = reaction;
  let intent = { steer: { x: 0, y: 0 }, special: false };
  return {
    think(world, dt) {
      if (world.clash) {
        if (world.clash.pair && !world.clash.pair.includes(index)) return { steer: { x: 0, y: 0 }, special: false, mash: 0 };
        mashAcc += mash * dt * (0.8 + 0.4 * rng());
        const taps = Math.floor(mashAcc);
        mashAcc -= taps;
        return { steer: { x: 0, y: 0 }, special: false, mash: taps };
      }
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
