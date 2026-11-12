// Erasers (bodies), pencil leads (tips) and named combos.
// Brand names are plain-text part names only.

export const ERASERS = [
  { id: 'apsara-nondust', name: 'Apsara Non-Dust', mass: 5, size: 5, attack: 6, defense: 6, stamina: 6, archetype: 'balance', shape: 'rect', color: '#f4f1ea', note: 'Soft and grippy all-rounder' },
  { id: 'apsara-jumbo', name: 'Apsara Jumbo', mass: 9, size: 8, attack: 4, defense: 9, stamina: 6, archetype: 'defense', shape: 'rect', color: '#e9e4f5', note: 'Big, heavy wall' },
  { id: 'nataraj-621', name: 'Nataraj 621 Plasto', mass: 3, size: 4, attack: 8, defense: 3, stamina: 5, archetype: 'attack', shape: 'rect', color: '#ffffff', band: '#d6342c', note: 'Hard and light, fast attacker' },
  { id: 'doms-cubo', name: 'Doms Cubo', mass: 5, size: 5, attack: 9, defense: 4, stamina: 4, archetype: 'attack', shape: 'cube', color: '#3b82c4', note: 'Corners hit hard, but it wobbles' },
  { id: 'camlin-dustfree', name: 'Camlin Dust-Free', mass: 5, size: 5, attack: 5, defense: 5, stamina: 8, archetype: 'stamina', shape: 'rect', color: '#f2d36b', note: 'Steady spinner' },
  { id: 'faber-dustfree', name: 'Faber-Castell Dust-Free', mass: 7, size: 6, attack: 5, defense: 7, stamina: 8, archetype: 'stamina', shape: 'rect', color: '#9ccf8e', note: 'Dense stamina tank' },
  { id: 'fruit-scented', name: 'Fruit-Scented Fancy Eraser', mass: 2, size: 4, attack: 6, defense: 2, stamina: 4, archetype: 'wildcard', shape: 'pill', color: '#ff8fb1', note: 'Unpredictable — random special' },
];

export const LEADS = [
  { id: 'nataraj-hb', name: 'Nataraj 621 HB', stability: 7, glide: 6, speed: 6, durability: 6, note: 'Sharp and stable' },
  { id: 'apsara-platinum', name: 'Apsara Platinum Extra Dark', stability: 5, glide: 3, speed: 9, durability: 4, note: 'Grips the bowl, burns stamina' },
  { id: 'apsara-absolute', name: 'Apsara Absolute', stability: 6, glide: 5, speed: 5, durability: 10, note: 'Hardest to snap' },
  { id: 'doms-y1', name: 'Doms Y1+', stability: 6, glide: 9, speed: 5, durability: 5, note: 'Smooth glide, long spin' },
  { id: 'camlin-exam', name: 'Camlin Exam HB', stability: 8, glide: 6, speed: 5, durability: 6, note: 'Balanced and steady' },
  { id: 'faber-2b', name: 'Faber-Castell 2B', stability: 9, glide: 5, speed: 3, durability: 7, note: 'Wide tip, very stable, slow' },
];

// Checked in this order; first match wins.
export const COMBOS = [
  { id: 'deadly-duo', name: 'Deadly Duo', desc: 'Attack +2, Stability +1', bad: false, erasers: ['apsara-nondust', 'apsara-jumbo'], leads: ['nataraj-hb'], mods: { attack: 2, stability: 1 } },
  { id: 'doms-double', name: 'Doms Double', desc: 'Cube wobble cancelled, Stamina +1', bad: false, erasers: ['doms-cubo'], leads: ['doms-y1'], mods: { baseWobble: -2, stamina: 1 } },
  { id: 'exam-hall', name: 'Exam Hall', desc: 'Stamina +2', bad: false, erasers: ['camlin-dustfree'], leads: ['camlin-exam'], mods: { stamina: 2 } },
  { id: 'toppers-kit', name: "Topper's Kit", desc: 'Defense +2, Stability +1', bad: false, erasers: ['faber-dustfree'], leads: ['faber-2b'], mods: { defense: 2, stability: 1 } },
  { id: 'sugar-rush', name: 'Sugar Rush', desc: 'Speed +2, Stamina −2', bad: false, erasers: ['fruit-scented'], leads: ['apsara-platinum'], mods: { speed: 2, stamina: -2 } },
  { id: 'sleepy-bench', name: 'Sleepy Bench', desc: 'Speed −2 (too heavy for a soft tip)', bad: true, erasers: ['apsara-jumbo'], leads: ['faber-2b'], mods: { speed: -2 } },
  { id: 'hindustan-family', name: 'Hindustan Family', desc: 'Stamina +1, Durability +1', bad: false, erasers: 'family', leads: 'family', mods: { stamina: 1, durability: 1 } },
];

export const SPECIAL_BY_ARCHETYPE = {
  attack: 'dash', defense: 'plant', stamina: 'secondWind', balance: 'recentre', wildcard: 'wild',
};

export const SPECIAL_NAMES = {
  dash: 'Smash Dash', plant: 'Plant', secondWind: 'Second Wind', recentre: 'Recentre', wild: 'Wildcard',
};

const BASE_WOBBLE = { 'doms-cubo': 2, 'fruit-scented': 1 };

const isFamily = (id) => id.startsWith('apsara-') || id.startsWith('nataraj-');
const matches = (rule, id) => (rule === 'family' ? isFamily(id) : rule.includes(id));
const clamp10 = (v) => Math.max(1, Math.min(10, Math.round(v)));

export function findCombo(eraserId, leadId) {
  return COMBOS.find((c) => matches(c.erasers, eraserId) && matches(c.leads, leadId)) || null;
}

export function buildTop(eraserId, leadId) {
  const e = ERASERS.find((x) => x.id === eraserId);
  const l = LEADS.find((x) => x.id === leadId);
  if (!e) throw new Error(`Unknown eraser: ${eraserId}`);
  if (!l) throw new Error(`Unknown lead: ${leadId}`);

  const s = {
    attack: e.attack, defense: e.defense, stamina: e.stamina,
    stability: l.stability, glide: l.glide, speed: l.speed, durability: l.durability,
    baseWobble: BASE_WOBBLE[e.id] || 0,
  };
  const combo = findCombo(e.id, l.id);
  if (combo) for (const [k, v] of Object.entries(combo.mods)) s[k] += v;
  for (const k of ['attack', 'defense', 'stamina', 'stability', 'glide', 'speed', 'durability']) s[k] = clamp10(s[k]);
  s.baseWobble = Math.max(0, s.baseWobble);

  const card = {
    attack: s.attack,
    defense: s.defense,
    stamina: clamp10((s.stamina + s.glide) / 2),
    balance: clamp10((s.stability * 2 - s.baseWobble) / 2),
    speed: clamp10((s.speed * 2 - e.mass + 5) / 2),
  };

  return {
    eraserId: e.id, leadId: l.id, eraserName: e.name, leadName: l.name,
    archetype: e.archetype, shape: e.shape, color: e.color, band: e.band || null,
    mass: e.mass, size: e.size, radius: 0.07 + e.size * 0.008,
    ...s,
    maxRPM: 1000 * (1.15 - e.mass * 0.03),
    combo: combo ? { id: combo.id, name: combo.name, desc: combo.desc, bad: combo.bad } : null,
    card,
    special: SPECIAL_BY_ARCHETYPE[e.archetype],
  };
}
