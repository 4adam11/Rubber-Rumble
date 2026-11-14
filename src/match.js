// Points scoring, Beyblade-X style: big finishes score more. First to TARGET_POINTS wins.
// Draws are replayed and score nothing.
export const POINTS = { stopped: 1, time: 1, tipped: 2, ringout: 2, snapko: 3 };
export const TARGET_POINTS = 4;

export const FINISH_NAMES = {
  stopped: 'Spin Finish', time: 'Spin Finish', tipped: 'Tip Finish', ringout: 'Knock-Out', snapko: 'Snap KO',
};

export function createMatch({ target = TARGET_POINTS, seats = 2 } = {}) {
  const points = Array(seats).fill(0);
  const wins = Array(seats).fill(0);
  const rounds = [];
  let winner = null;
  const state = () => ({
    points: [...points], wins: [...wins], rounds: rounds.map((r) => ({ ...r })),
    over: winner !== null, winner, target,
  });
  return {
    record(result) {
      if (winner !== null) return state();
      const scored = Number.isInteger(result.winner) && result.winner >= 0 && result.winner < seats ? POINTS[result.reason] ?? 1 : 0;
      rounds.push({ ...result, points: scored });
      if (scored) {
        points[result.winner] += scored;
        wins[result.winner]++;
        if (points[result.winner] >= target) winner = result.winner;
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
