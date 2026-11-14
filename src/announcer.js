// What the announcer shouts for each moment. Pure: the voice itself lives in audio.js.

const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const FINISH = { stopped: 'Spin finish!', time: 'Spin finish!', tipped: 'Tip finish!', ringout: 'Knock out!', snapko: 'Snap K. O.!', draw: 'Draw!' };

export function lineFor(kind, d = {}) {
  switch (kind) {
    case 'round': {
      const m = /Round (\d+)/.exec(d.label || '');
      const n = m ? Number(m[1]) : 1;
      return `Round ${NUMBERS[n] || n}!${/replay/.test(d.label || '') ? ' Replay!' : ''}`;
    }
    case 'twist': return 'Twist!';
    case 'fight': return 'Ghumao!';
    case 'finish': {
      const base = FINISH[d.reason] || 'Finish!';
      return d.flawless && d.reason !== 'draw' ? `${base} Flawless victory!` : base;
    }
    case 'match': return d.name === 'You' ? 'You win!' : `${d.name} wins!`;
    case 'clash': return 'Spin clash!';
    case 'snap': return 'Lead snapped!';
    case 'finishIt': return 'Finish it!';
    case 'rubberality': return 'Rubberality!';
    case 'unlock': return 'Ability ready!';
    default: return null;
  }
}
