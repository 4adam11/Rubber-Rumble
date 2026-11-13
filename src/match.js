// Best-of-3 scoring. Draws are replayed and never count.
export const WINS_NEEDED = 2;

export function createMatch() {
  const wins = [0, 0];
  const rounds = [];
  let winner = null;
  const state = () => ({ wins: [...wins], rounds: [...rounds], over: winner !== null, winner });
  return {
    record(result) {
      if (winner !== null) return state();
      rounds.push(result);
      if (result.winner === 0 || result.winner === 1) {
        wins[result.winner]++;
        if (wins[result.winner] >= WINS_NEEDED) winner = result.winner;
      }
      return state();
    },
    state,
  };
}

// Label for round k of a match: counts decisive rounds; a round right after a draw is a replay.
export function roundLabel(rounds, k) {
  let n = 1;
  for (let i = 0; i < k; i++) if (rounds[i].winner !== null) n++;
  const replay = k > 0 && rounds[k - 1].winner === null;
  return `Round ${n}${replay ? ' (replay)' : ''}`;
}
