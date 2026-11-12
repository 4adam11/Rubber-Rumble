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
