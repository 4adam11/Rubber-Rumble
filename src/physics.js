// Top physics in arena units (thali radius R = 1). Pure: no DOM.
import { UNLOCK_AT } from './abilities.js';

export const CONST = {
  DT: 1 / 120,
  R: 1,
  BOWL_K: 0.7,
  DAMPING: 0.6,
  BASE_DRAIN: 18,
  STAMINA_K: 0.35, // drain × (1 − STAMINA_K × (stamina − 5)/10)
  STAB_K: 0.5, // wobble growth × (1 − STAB_K × (stability − 5)/10)
  WOBBLE_RATE: 0.2,
  WOBBLE_RECOVER: 0.12,
  BASE_WOBBLE_K: 0.15, // extra wobble growth/drift per point of base wobble
  DRIFT: 0.5,
  STEER_COST: 0.01,
  RESTITUTION: 0.8,
  HIT_DAMAGE: 42,
  ATK_BASE: 4, // damage ratio = (ATK_BASE + attack) / (ATK_BASE + defense)
  HIT_LUCK: 0.25,
  MASS_K: 0.3, // damage × (2·m_hitter/(m_a+m_b))^MASS_K // each hit's damage varies ±25%
  HIT_WOBBLE: 0.03,
  BRACE: 0.85, // defence-type erasers take this share of hit damage
  SNAP_BASE: 0.35,
  TIME_LIMIT: 60,
  MAX_ELAPSED: 0.25,
};

const KINDS = ['dash', 'plant', 'secondWind', 'recentre'];

// Spin Clash: tops grinding together lock up; both players mash, the winner steals spin.
export const CLASH = { contact: 0.45, duration: 2.0, cooldown: 10, minHealth: 0.25, steal: 0.12, gain: 0.06 };
const SPIN_OPPOSITE = 1.25; // opposite spins hit harder...
const SPIN_SAME = 0.9;      // ...matching spins grind more softly
const CRUMB = { every: 0.22, life: 6, r: 0.085, drag: 3.2, duration: 4 };

// 1 at stat 5, smaller for higher stats; k sets how much stats matter.
const statMul = (v, k) => 1 - k * (v - 5) / 10;

export function createWorld(specs, launches, rng = Math.random, opts = {}) {
  const tops = specs.map((spec, i) => {
    const l = launches[i];
    return {
      spec,
      x: l.x, y: l.y, vx: 0, vy: 0,
      rpm: l.rpm, wobble: l.wobble, angle: 0,
      spinDir: l.spinDir === -1 ? -1 : 1,
      leadSnapped: false,
      specialKind: opts.abilities?.[i] || (spec.special === 'wild' ? KINDS[Math.min(3, Math.floor(rng() * 4))] : spec.special),
      specialUsed: false,
      unlocked: false,
      shieldHits: 0,
      crumbUntil: 0,
      nextCrumb: 0,
      specialUntil: 0,
      dashUntil: 0,
      dashArmed: false,
      dashArmedUntil: 0,
      planted: false,
    };
  });
  return {
    tops, time: 0, events: [], over: false, result: null, rng,
    bowlK: opts.bowlK ?? opts.arena?.bowlK ?? CONST.BOWL_K,
    unlockAt: opts.unlockAt ?? UNLOCK_AT,
    // slowing patches: { x, y, r, drag, owner (-1 = arena), until }
    zones: (opts.arena?.zones || []).map((z) => ({ ...z, owner: -1, until: Infinity })),
    bumpers: (opts.arena?.bumpers || []).map((b) => ({ ...b })),
    arena: opts.arena || null,
    clashOn: opts.clash !== false,
    // tournament twists: oily desk (damping), ceiling fan (wind), earthquake drill (quake)
    damping: opts.mods?.damping ?? CONST.DAMPING,
    wind: opts.mods?.wind || null,
    quake: opts.mods?.quake || null,
    nextQuake: opts.mods?.quake?.every ?? Infinity,
    clash: null, contact: 0, nextClash: 0,
  };
}

function moveTop(w, t, intent, dt, opp) {
  const s = t.spec;
  let ax = -w.bowlK * t.x;
  let ay = -w.bowlK * t.y;

  const steer = intent?.steer || { x: 0, y: 0 };
  let mag = Math.hypot(steer.x, steer.y);
  let sx = steer.x, sy = steer.y;
  if (mag > 1) { sx /= mag; sy /= mag; mag = 1; }
  if (!t.planted && mag > 0) {
    const acc = 0.4 + 0.12 * s.card.speed;
    ax += sx * acc;
    ay += sy * acc;
    t.rpm -= CONST.STEER_COST * s.maxRPM * mag * dt;
  }

  if (w.time < t.dashUntil) {
    const ox = opp.x - t.x, oy = opp.y - t.y;
    const od = Math.hypot(ox, oy) || 1;
    ax += (ox / od) * 4.0;
    ay += (oy / od) * 4.0;
  }

  if (w.wind) { ax += w.wind.x; ay += w.wind.y; }

  // Random wander, tangential to the bowl.
  const d = Math.hypot(t.x, t.y);
  const tx = d > 1e-9 ? -t.y / d : 0;
  const ty = d > 1e-9 ? t.x / d : 1;
  const drift = CONST.DRIFT * (1 - s.stability / 10) * (1 + CONST.BASE_WOBBLE_K * s.baseWobble) * (w.rng() * 2 - 1);
  ax += tx * drift;
  ay += ty * drift;

  t.vx += ax * dt;
  t.vy += ay * dt;
  let drag = 0;
  for (const z of w.zones) {
    if (z.owner === t.index) continue;
    if (Math.hypot(t.x - z.x, t.y - z.y) < z.r + s.radius * 0.5) drag = Math.max(drag, z.drag);
  }
  if (drag) { t.vx *= Math.exp(-drag * dt); t.vy *= Math.exp(-drag * dt); t.inZone = true; } else t.inZone = false;
  const damp = Math.exp(-w.damping * dt);
  t.vx *= damp;
  t.vy *= damp;
  if (t.planted) { t.vx *= Math.exp(-6 * dt); t.vy *= Math.exp(-6 * dt); }
  t.x += t.vx * dt;
  t.y += t.vy * dt;

  t.rpm -= CONST.BASE_DRAIN * statMul(s.card.stamina, CONST.STAMINA_K) * (1 + t.wobble) * (1.1 - s.mass * 0.02) * dt;

  if (t.rpm < 0.35 * s.maxRPM) {
    t.wobble += CONST.WOBBLE_RATE * statMul(s.stability, CONST.STAB_K) * (1 + CONST.BASE_WOBBLE_K * s.baseWobble) * dt;
  } else if (t.rpm > 0.5 * s.maxRPM) {
    t.wobble = Math.max(0, t.wobble - CONST.WOBBLE_RECOVER * (s.stability / 10) * dt);
  }
  t.rpm = Math.max(0, t.rpm);
  t.angle += t.rpm * dt * 0.02 * t.spinDir;
}

function useSpecial(w, t, i) {
  const s = t.spec;
  t.specialUsed = true;
  w.events.push({ type: 'special', i, kind: t.specialKind });
  switch (t.specialKind) {
    case 'dash':
      t.dashUntil = w.time + 0.35;
      t.dashArmed = true;
      t.dashArmedUntil = w.time + 1.5;
      break;
    case 'plant':
      t.planted = true;
      t.specialUntil = w.time + 2.5;
      break;
    case 'secondWind':
      t.rpm = Math.min(s.maxRPM, t.rpm + 0.2 * s.maxRPM);
      t.wobble = Math.max(0, t.wobble - 0.25);
      break;
    case 'shield':
      t.shieldHits = 2;
      break;
    case 'crumbs':
      t.crumbUntil = w.time + CRUMB.duration;
      t.nextCrumb = w.time;
      break;
    case 'recentre':
      t.wobble = 0;
      t.vx = t.vx * 0.3 - t.x * 0.5;
      t.vy = t.vy * 0.3 - t.y * 0.5;
      break;
  }
}

function applySpecials(w, intents) {
  w.zones = w.zones.filter((z) => z.until > w.time);
  w.tops.forEach((t, i) => {
    t.index = i;
    if (t.planted && w.time >= t.specialUntil) t.planted = false;
    if (t.dashArmed && w.time >= t.dashArmedUntil) t.dashArmed = false;
    // abilities are a comeback tool: they unlock once health (spin) falls to the threshold
    if (!t.unlocked && t.rpm <= w.unlockAt * t.spec.maxRPM) {
      t.unlocked = true;
      w.events.push({ type: 'unlock', i, kind: t.specialKind });
    }
    if (intents?.[i]?.special && t.unlocked && !t.specialUsed) useSpecial(w, t, i);
    if (w.time < t.crumbUntil && w.time >= t.nextCrumb && w.zones.length < 40) {
      w.zones.push({ x: t.x, y: t.y, r: CRUMB.r, drag: CRUMB.drag, owner: i, until: w.time + CRUMB.life, kind: 'crumbs' });
      t.nextCrumb = w.time + CRUMB.every;
    }
  });
}

function hitDamage(victim, attacker, impact) {
  if (victim.shieldHits > 0) return 0;
  const spin = Math.min(1, attacker.rpm / attacker.spec.maxRPM);
  let d = impact * CONST.HIT_DAMAGE * (CONST.ATK_BASE + attacker.spec.attack) / (CONST.ATK_BASE + victim.spec.defense) * (0.5 + spin);
  if (attacker.spec.eraserId === 'doms-cubo') d *= 1.15;
  if (attacker.dashArmed) d *= 1.5;
  if (victim.planted) d *= 0.5;
  if (victim.spec.archetype === 'defense') d *= CONST.BRACE; // big erasers brace for hits
  return d;
}

function collide(w) {
  const [a, b] = w.tops;
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const minD = a.spec.radius + b.spec.radius;
  if (d >= minD) return;
  const nx = d > 1e-9 ? dx / d : 1;
  const ny = d > 1e-9 ? dy / d : 0;
  const ma = a.spec.mass * (a.planted ? 3 : 1);
  const mb = b.spec.mass * (b.planted ? 3 : 1);

  const overlap = minD - d;
  a.x -= nx * overlap * (mb / (ma + mb));
  a.y -= ny * overlap * (mb / (ma + mb));
  b.x += nx * overlap * (ma / (ma + mb));
  b.y += ny * overlap * (ma / (ma + mb));

  const impact = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (impact <= 0) return;
  // who did the ramming: each top's own speed into the other
  const ramA = Math.max(0, a.vx * nx + a.vy * ny);
  const ramB = Math.max(0, -(b.vx * nx + b.vy * ny));
  const shareA = ramA + ramB > 1e-9 ? ramA / (ramA + ramB) : 0.5;
  const j = (1 + CONST.RESTITUTION) * impact / (1 / ma + 1 / mb);
  a.vx -= (j / ma) * nx; a.vy -= (j / ma) * ny;
  b.vx += (j / mb) * nx; b.vy += (j / mb) * ny;

  const luck = () => 1 - CONST.HIT_LUCK + 2 * CONST.HIT_LUCK * w.rng();
  // heavier tops hit harder and shrug off light ones
  const heavyA = ((2 * a.spec.mass) / (a.spec.mass + b.spec.mass)) ** CONST.MASS_K;
  const heavyB = ((2 * b.spec.mass) / (a.spec.mass + b.spec.mass)) ** CONST.MASS_K;
  const spinK = a.spinDir !== b.spinDir ? SPIN_OPPOSITE : SPIN_SAME;
  const dmgA = hitDamage(a, b, impact) * (0.5 + (1 - shareA)) * heavyB * luck() * spinK;
  const dmgB = hitDamage(b, a, impact) * (0.5 + shareA) * heavyA * luck() * spinK;
  a.dashArmed = false;
  b.dashArmed = false;
  a.rpm = Math.max(0, a.rpm - dmgA);
  b.rpm = Math.max(0, b.rpm - dmgB);
  const blocked = [a.shieldHits > 0, b.shieldHits > 0];
  w.tops.forEach((t, i) => {
    if (blocked[i]) {
      t.shieldHits--;
      w.events.push({ type: 'block', i, left: t.shieldHits });
    }
  });
  if (dmgA > 0) w.events.push({ type: 'damage', i: 0, amount: dmgA });
  if (dmgB > 0) w.events.push({ type: 'damage', i: 1, amount: dmgB });
  const rammed = [1.5 - shareA, 0.5 + shareA]; // the top being rammed shakes more
  w.tops.forEach((t, i) => {
    const other = w.tops[1 - i];
    const shove = (2 * other.spec.mass) / (t.spec.mass + other.spec.mass); // heavy tops shake less
    if (blocked[i]) return; // the shield takes the whole hit
    t.wobble += impact * CONST.HIT_WOBBLE * rammed[i] * shove * statMul(t.spec.stability, CONST.STAB_K);
    const snapHit = impact * rammed[i] > CONST.SNAP_BASE * t.spec.durability;
    if (t.leadSnapped && snapHit && !t.crumbled) {
      // second snap on a broken lead: the eraser crumbles (Snap KO)
      t.crumbled = true;
      w.events.push({ type: 'crumble', i });
      return;
    }
    if (!t.leadSnapped && snapHit) {
      t.leadSnapped = true;
      t.rpm *= 0.75;
      t.wobble += 0.3;
      w.events.push({ type: 'snap', i });
    }
  });
  w.events.push({ type: 'hit', x: a.x + nx * a.spec.radius, y: a.y + ny * a.spec.radius, impact });
}

// Solid arena pieces (the sharpener): push out, bounce, and knock a little spin off.
function bounceOffBumpers(w) {
  w.tops.forEach((t, i) => {
    for (const b of w.bumpers) {
      const dx = t.x - b.x, dy = t.y - b.y;
      const d = Math.hypot(dx, dy);
      const minD = b.r + t.spec.radius;
      if (d >= minD) continue;
      const nx = d > 1e-9 ? dx / d : 1, ny = d > 1e-9 ? dy / d : 0;
      t.x = b.x + nx * minD;
      t.y = b.y + ny * minD;
      const vn = t.vx * nx + t.vy * ny;
      if (vn < 0) {
        t.vx -= 1.9 * vn * nx;
        t.vy -= 1.9 * vn * ny;
        const impact = -vn;
        t.rpm = Math.max(0, t.rpm - impact * CONST.HIT_DAMAGE * 0.35);
        t.wobble += impact * CONST.HIT_WOBBLE * 0.6;
        w.events.push({ type: 'bump', i, x: b.x + nx * b.r, y: b.y + ny * b.r, impact, kind: b.kind });
      }
    }
  });
}

// track how long the tops have been pressed together; long enough starts a clash
function watchForClash(w) {
  if (!w.clashOn || w.over) return;
  const [a, b] = w.tops;
  const close = Math.hypot(b.x - a.x, b.y - a.y) < (a.spec.radius + b.spec.radius) * 1.12;
  w.contact = close ? w.contact + CONST.DT : Math.max(0, w.contact - CONST.DT * 2);
  const healthy = w.tops.every((t) => t.rpm >= CLASH.minHealth * t.spec.maxRPM);
  if (w.contact >= CLASH.contact && w.time >= w.nextClash && healthy) {
    w.clash = { t: 0, mash: [0, 0], x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    for (const t of w.tops) { t.vx = 0; t.vy = 0; }
    w.events.push({ type: 'clashStart', x: w.clash.x, y: w.clash.y });
  }
}

function runClash(w, intents) {
  const c = w.clash;
  c.t += CONST.DT;
  intents?.forEach((it, i) => { c.mash[i] += it?.mash || 0; });
  if (c.t < CLASH.duration) return;
  const [m0, m1] = c.mash;
  const winner = m0 !== m1 ? (m0 > m1 ? 0 : 1) : (w.tops[0].rpm >= w.tops[1].rpm ? 0 : 1);
  const win = w.tops[winner], lose = w.tops[1 - winner];
  lose.rpm = Math.max(1, lose.rpm - CLASH.steal * lose.spec.maxRPM);
  win.rpm = Math.min(win.spec.maxRPM, win.rpm + CLASH.gain * win.spec.maxRPM);
  lose.wobble += 0.12;
  const dx = lose.x - win.x, dy = lose.y - win.y, d = Math.hypot(dx, dy) || 1;
  lose.vx = (dx / d) * 1.3; lose.vy = (dy / d) * 1.3;
  win.vx = -(dx / d) * 0.3; win.vy = -(dy / d) * 0.3;
  w.clash = null;
  w.contact = 0;
  w.nextClash = w.time + CLASH.cooldown;
  w.events.push({ type: 'clashEnd', winner, mash: [m0, m1] });
}

function lossReason(t) {
  if (t.crumbled) return 'snapko';
  if (t.rpm <= 0) return 'stopped';
  if (t.wobble >= 1) return 'tipped';
  if (Math.hypot(t.x, t.y) > CONST.R + t.spec.radius) return 'ringout';
  return null;
}

function endRound(w, result) {
  w.over = true;
  w.result = result;
  w.events.push({ type: 'end', result });
}

export function step(w, intents) {
  if (w.over) return;
  if (w.clash) { runClash(w, intents); return; } // the world holds still while the clash plays out
  const dt = CONST.DT;
  const pre = w.tops.map((t) => t.rpm);
  applySpecials(w, intents, dt);
  w.tops.forEach((t, i) => moveTop(w, t, intents?.[i], dt, w.tops[1 - i]));
  collide(w);
  if (w.bumpers.length) bounceOffBumpers(w);
  watchForClash(w);
  if (w.quake && w.time >= w.nextQuake) {
    for (const t of w.tops) {
      const a = w.rng() * Math.PI * 2;
      t.vx += Math.cos(a) * w.quake.strength;
      t.vy += Math.sin(a) * w.quake.strength;
      t.wobble += 0.05;
    }
    w.nextQuake = w.time + w.quake.every;
    w.events.push({ type: 'quake' });
  }
  w.time += dt;

  const reasons = w.tops.map(lossReason);
  if (reasons[0] && reasons[1]) {
    if (pre[0] === pre[1]) endRound(w, { winner: null, reason: 'draw' });
    else {
      const winner = pre[0] > pre[1] ? 0 : 1;
      endRound(w, { winner, reason: reasons[1 - winner] });
    }
  } else if (reasons[0] || reasons[1]) {
    const loser = reasons[0] ? 0 : 1;
    endRound(w, { winner: 1 - loser, reason: reasons[loser] });
  } else if (w.time >= CONST.TIME_LIMIT) {
    const [a, b] = w.tops.map((t) => t.rpm);
    endRound(w, a === b ? { winner: null, reason: 'draw' } : { winner: a > b ? 0 : 1, reason: 'time' });
  }
}

export function simulate(w, elapsed, intents) {
  const e = Math.min(Math.max(0, elapsed), CONST.MAX_ELAPSED);
  const n = Math.floor(e / CONST.DT + 1e-9);
  // a special pressed on a frame too short for a step waits for the next step
  w.pendingSpecial ??= [false, false];
  w.pendingMash ??= [0, 0];
  intents?.forEach((it, i) => {
    if (it?.special) w.pendingSpecial[i] = true;
    w.pendingMash[i] += it?.mash || 0; // taps count once, however many steps the frame runs
  });
  for (let i = 0; i < n; i++) {
    const withSpecial = [0, 1].map((k) => ({ steer: intents?.[k]?.steer || { x: 0, y: 0 }, special: w.pendingSpecial[k], mash: w.pendingMash[k] }));
    w.pendingSpecial = [false, false];
    w.pendingMash = [0, 0];
    step(w, withSpecial);
  }
  return e - n * CONST.DT;
}
