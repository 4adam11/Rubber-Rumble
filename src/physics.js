// Top physics in arena units (thali radius R = 1). Pure: no DOM.

export const CONST = {
  DT: 1 / 120,
  R: 1,
  BOWL_K: 1.2,
  DAMPING: 0.6,
  BASE_DRAIN: 40,
  WOBBLE_RATE: 0.25,
  WOBBLE_RECOVER: 0.05,
  DRIFT: 0.5,
  STEER_COST: 0.02,
  RESTITUTION: 0.8,
  HIT_DAMAGE: 80,
  HIT_WOBBLE: 0.08,
  SNAP_BASE: 0.25,
  TIME_LIMIT: 60,
  MAX_ELAPSED: 0.25,
};

const KINDS = ['dash', 'plant', 'secondWind', 'recentre'];

export function createWorld(specs, launches, rng = Math.random, opts = {}) {
  const tops = specs.map((spec, i) => {
    const l = launches[i];
    return {
      spec,
      x: l.x, y: l.y, vx: 0, vy: 0,
      rpm: l.rpm, wobble: l.wobble, angle: 0,
      leadSnapped: false,
      specialKind: spec.special === 'wild' ? KINDS[Math.min(3, Math.floor(rng() * 4))] : spec.special,
      specialUsed: false,
      specialUntil: 0,
      dashUntil: 0,
      dashArmed: false,
      dashArmedUntil: 0,
      planted: false,
    };
  });
  return {
    tops, time: 0, events: [], over: false, result: null, rng,
    bowlK: opts.bowlK ?? CONST.BOWL_K,
  };
}

function moveTop(w, t, intent, dt) {
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

  // Random wander, tangential to the bowl.
  const d = Math.hypot(t.x, t.y);
  const tx = d > 1e-9 ? -t.y / d : 0;
  const ty = d > 1e-9 ? t.x / d : 1;
  const drift = CONST.DRIFT * (1 - s.stability / 10) * (1 + 0.25 * s.baseWobble) * (w.rng() * 2 - 1);
  ax += tx * drift;
  ay += ty * drift;

  t.vx += ax * dt;
  t.vy += ay * dt;
  const damp = Math.exp(-CONST.DAMPING * dt);
  t.vx *= damp;
  t.vy *= damp;
  if (t.planted) { t.vx *= Math.exp(-6 * dt); t.vy *= Math.exp(-6 * dt); }
  t.x += t.vx * dt;
  t.y += t.vy * dt;

  t.rpm -= CONST.BASE_DRAIN * (1.3 - s.card.stamina / 10) * (1 + t.wobble) * (1.1 - s.mass * 0.02) * dt;

  if (t.rpm < 0.35 * s.maxRPM) {
    t.wobble += CONST.WOBBLE_RATE * (1 - s.stability / 12) * (1 + 0.25 * s.baseWobble) * dt;
  } else if (t.rpm > 0.5 * s.maxRPM) {
    t.wobble = Math.max(0, t.wobble - CONST.WOBBLE_RECOVER * (s.stability / 10) * dt);
  }
  t.rpm = Math.max(0, t.rpm);
  t.angle += t.rpm * dt * 0.02;
}

// Collisions and specials are filled in by later code.
function collide() {}
function applySpecials() {}

function lossReason(t) {
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
  const dt = CONST.DT;
  const pre = w.tops.map((t) => t.rpm);
  applySpecials(w, intents, dt);
  w.tops.forEach((t, i) => moveTop(w, t, intents?.[i], dt));
  collide(w);
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
  for (let i = 0; i < n; i++) step(w, intents);
  return e - n * CONST.DT;
}
