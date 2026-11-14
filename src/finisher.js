// "FINISH IT!": after the match-winning round, the winner gets a few seconds to enter a short
// sequence. Get it right and a Rubberality plays. Pure logic; drawing lives in render.js.

export const FINISH_SECONDS = 4;

export const FINISHERS = {
  sharpener: { name: 'Sharpener Shred', desc: 'A giant sharpener grinds the loser into shavings.' },
  rubout: { name: 'Rub-Out', desc: 'A giant eraser rubs the loser right off the plate.' },
};

const DIRS = ['up', 'down', 'left', 'right'];

export function makeSequence(rng = Math.random) {
  const seq = [];
  for (let i = 0; i < 3; i++) seq.push(DIRS[Math.min(3, Math.floor(rng() * 4))]);
  seq.push('special');
  return seq;
}

export function createFinishInput(seq, limit = FINISH_SECONDS) {
  const state = { seq, progress: 0, t: 0, status: 'input' };
  return {
    state,
    feed(move) {
      if (state.status !== 'input') return state.status;
      if (move === seq[state.progress]) {
        state.progress++;
        if (state.progress >= seq.length) { state.status = 'done'; return 'done'; }
        return 'progress';
      }
      // wrong: start over (but a move that matches the first step counts as a fresh start)
      state.progress = move === seq[0] ? 1 : 0;
      return 'wrong';
    },
    tick(dt) {
      if (state.status !== 'input') return state.status;
      state.t += dt;
      if (state.t >= limit) state.status = 'timeout';
      return state.status;
    },
  };
}

export function pickFinisher(archetype) {
  return archetype === 'attack' || archetype === 'defense' ? 'sharpener' : 'rubout';
}

const CPU_RATE = { easy: 0.35, medium: 0.6, hard: 0.85 };
export function cpuFinishes(difficulty, rng = Math.random) {
  return rng() < (CPU_RATE[difficulty] ?? 0.6);
}
