// School Tournament: an arcade ladder of five opponents, each with a twist, ending in a boss.

export const MODIFIERS = {
  oily: { name: 'Oily desk', icon: '🛢', desc: 'Someone spilled hair oil. Everything slides further.', mods: { damping: 0.22 } },
  fan: { name: 'Ceiling fan', icon: '🌀', desc: 'A breeze pushes both tops sideways.', mods: { wind: { x: 0.22, y: 0.05 } } },
  quake: { name: 'Earthquake drill', icon: '🔔', desc: 'The desk shakes every few seconds.', mods: { quake: { every: 3.5, strength: 0.9 } } },
  boss: { name: 'Principal\'s office', icon: '👑', desc: 'A giant eraser that spins longer and hits harder.', mods: null },
};

export const RUNGS = [
  {
    id: 'bully', name: 'Class Bully', title: 'Class 6B', difficulty: 'easy',
    parts: { eraserId: 'nataraj-621', leadId: 'apsara-platinum' }, ability: 'dash', arena: 'thali', modifier: null,
    taunt: 'That eraser? Mine now.',
  },
  {
    id: 'backbencher', name: 'The Backbencher', title: 'Last bench, Class 7A', difficulty: 'easy',
    parts: { eraserId: 'fruit-scented', leadId: 'doms-y1' }, ability: 'crumbs', arena: 'tiffin', modifier: 'oily',
    taunt: 'I don\'t study. I spin.',
  },
  {
    id: 'monitor', name: 'Class Monitor', title: 'Keeper of the register', difficulty: 'medium',
    parts: { eraserId: 'camlin-dustfree', leadId: 'camlin-exam' }, ability: 'secondWind', arena: 'tiffin', modifier: 'fan',
    taunt: 'Your name is going on the board.',
  },
  {
    id: 'topper', name: 'The Topper', title: 'First rank, every year', difficulty: 'hard',
    parts: { eraserId: 'faber-dustfree', leadId: 'faber-2b' }, ability: 'shield', arena: 'geometry', modifier: 'quake',
    taunt: 'I have calculated every angle.',
  },
  {
    id: 'principal', name: 'The Principal', title: 'Final boss', difficulty: 'hard', boss: true,
    parts: { eraserId: 'apsara-jumbo', leadId: 'apsara-absolute' }, ability: 'plant', arena: 'geometry', modifier: 'boss',
    taunt: 'Running in the corridors? Detention.',
  },
];

export function advance(progress, won) {
  const p = { rung: 0, champion: false, ...progress };
  if (!won) return p;
  if (p.rung >= RUNGS.length - 1) return { ...p, rung: RUNGS.length - 1, champion: true };
  return { ...p, rung: p.rung + 1 };
}

// The Principal's giant eraser.
export function bossSpec(spec) {
  return {
    ...spec,
    radius: spec.radius * 1.32,
    mass: spec.mass * 1.35,
    maxRPM: spec.maxRPM * 1.25,
    attack: Math.min(10, spec.attack + 2),
    boss: true,
  };
}
