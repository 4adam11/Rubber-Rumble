// The two-thumb twist launch. Pure: no DOM.

export const LAUNCH = {
  PLACE_TIME: 1.5,
  TWIST_TIME: 2.5,
  RING_PERIOD: 0.8,
  PERFECT_RING: 0.15,
  STROKES_TO_MAX: 22,
  START_RADIUS: 0.8,
  SLIDE_RANGE: Math.PI / 3,
  SLIDE_SPEED: 1.5,
  STROKE_PX: 30,
};

const TAU = Math.PI * 2;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI; // [-π, π)
const homeAngle = (side) => (side === 0 ? Math.PI : 0);

export function createLaunch(spec, side) {
  return {
    spec, side, phase: 'place', t: 0,
    rimAngle: homeAngle(side), rpm: 0, lastKey: null, result: null,
    spinDir: 0, // set by the first flick: 1 clockwise, -1 anticlockwise
  };
}

function setOffset(state, diff) {
  state.rimAngle = homeAngle(state.side) + Math.max(-LAUNCH.SLIDE_RANGE, Math.min(LAUNCH.SLIDE_RANGE, diff));
}

export function slide(state, dir, dt) {
  if (state.phase !== 'place' || !dir) return;
  setOffset(state, state.rimAngle - homeAngle(state.side) + dir * LAUNCH.SLIDE_SPEED * dt);
}

export function setPlace(state, angle) {
  if (state.phase !== 'place') return;
  setOffset(state, wrap(angle - homeAngle(state.side)));
}

export function addStroke(state, strength, dir = 0) {
  if (state.phase !== 'twist' || !(strength > 0)) return;
  if (!state.spinDir && dir) state.spinDir = Math.sign(dir);
  const max = state.spec.maxRPM;
  const gain = (max / LAUNCH.STROKES_TO_MAX) * strength * (state.rpm > 0.8 * max ? 0.5 : 1);
  state.rpm = Math.min(max, state.rpm + gain);
}

export function keyStroke(state, key) {
  if (state.phase !== 'twist') return;
  if (key !== state.lastKey) addStroke(state, 1, key === 'L' ? -1 : 1);
  state.lastKey = key;
}

export function ringSize(state) {
  const twistT = Math.max(0, state.t - LAUNCH.PLACE_TIME);
  return (1 - Math.cos((TAU * twistT) / LAUNCH.RING_PERIOD)) / 2;
}

function finish(state, ring) {
  const perfect = ring <= LAUNCH.PERFECT_RING;
  state.phase = 'done';
  state.result = {
    x: LAUNCH.START_RADIUS * Math.cos(state.rimAngle),
    y: LAUNCH.START_RADIUS * Math.sin(state.rimAngle),
    rpm: perfect ? state.rpm * 1.05 : state.rpm,
    wobble: perfect ? 0 : 0.1 + 0.3 * ring,
    perfect,
    spinDir: state.spinDir || 1,
  };
}

export function release(state) {
  // ignore a let-go before any twist (e.g. lifting the finger that placed the top)
  if (state.phase !== 'twist' || state.rpm <= 0) return;
  finish(state, ringSize(state));
}

export function updateLaunch(state, dt) {
  if (state.phase === 'done') return;
  state.t += dt;
  if (state.phase === 'place' && state.t >= LAUNCH.PLACE_TIME - 1e-9) state.phase = 'twist';
  if (state.phase === 'twist' && state.t >= LAUNCH.PLACE_TIME + LAUNCH.TWIST_TIME - 1e-9) finish(state, 0.5);
}

// Two fingers moving past each other vertically. Each reversal of ≥ 30 px
// in the gap between them (y1 − y2) is one stroke.
export function createPairStrokeDetector() {
  let anchor = null, anchorT = 0, lastSign = 0;
  return {
    update(y1, y2, t) {
      const gap = y1 - y2;
      if (anchor === null) { anchor = gap; anchorT = t; return 0; }
      const delta = gap - anchor;
      const sign = Math.sign(delta);
      if (sign !== 0 && sign === lastSign) {
        anchor = gap; anchorT = t; // keep following the same direction to its peak
        return 0;
      }
      if (Math.abs(delta) >= LAUNCH.STROKE_PX && sign !== lastSign) {
        const speed = Math.abs(delta) / Math.max(1e-3, t - anchorT);
        anchor = gap; anchorT = t; lastSign = sign;
        return Math.max(0.5, Math.min(1.5, speed / 1200));
      }
      return 0;
    },
    reset() { anchor = null; lastSign = 0; },
    get sign() { return lastSign; }, // direction of the latest flick
  };
}

// Circular mouse drag around the top: every half turn is one stroke.
export function createCircleStrokeDetector() {
  let last = null, acc = 0, lastDir = 1;
  return {
    update(angle) {
      if (last === null) { last = angle; return 0; }
      const d = wrap(angle - last);
      last = angle;
      if (Math.sign(d) !== Math.sign(acc) && acc !== 0) acc = 0;
      acc += d;
      if (Math.abs(acc) >= Math.PI) {
        lastDir = Math.sign(acc);
        acc -= Math.sign(acc) * Math.PI;
        return 1;
      }
      return 0;
    },
    reset() { last = null; acc = 0; },
    get sign() { return lastDir; },
  };
}
