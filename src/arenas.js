// Battle arenas. Positions are in arena units (rim radius 1); players launch from the left/right rim.
// zones: patches that slow a top rolling through them. bumpers: solid things tops bounce off.

export const ARENAS = {
  thali: {
    name: 'Steel Thali',
    level: 'Basic',
    desc: 'The classic lunch plate. Smooth steel, deep bowl, nowhere to hide.',
    bowlK: 0.7,
    zones: [],
    bumpers: [],
  },
  tiffin: {
    name: 'Tiffin Lid',
    level: 'Medium',
    desc: 'A flatter lid with sticky dal stains that slow you down. Tops wander more.',
    bowlK: 0.5,
    zones: [
      { kind: 'dal', x: 0.32, y: 0.34, r: 0.15, drag: 2.2 },
      { kind: 'dal', x: -0.34, y: -0.3, r: 0.14, drag: 2.2 },
      { kind: 'dal', x: 0.04, y: -0.44, r: 0.1, drag: 2.2 },
    ],
    bumpers: [],
  },
  geometry: {
    name: 'Geometry Box',
    level: 'Hard',
    desc: 'Ink blots and pencil shavings drag you down, and a sharpener sits in the way.',
    bowlK: 0.85,
    zones: [
      { kind: 'ink', x: 0.34, y: -0.24, r: 0.13, drag: 3.5 },
      { kind: 'ink', x: -0.34, y: 0.26, r: 0.13, drag: 3.5 },
      { kind: 'shavings', x: -0.24, y: -0.36, r: 0.11, drag: 2.6 },
      { kind: 'shavings', x: 0.27, y: 0.33, r: 0.11, drag: 2.6 },
    ],
    bumpers: [
      { kind: 'sharpener', x: 0, y: 0.56, r: 0.09 },
      { kind: 'pin', x: 0, y: -0.52, r: 0.05 },
    ],
  },
};

export const ARENA_IDS = Object.keys(ARENAS);
