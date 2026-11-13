// Comeback abilities: picked before the battle, unlocked when health (spin) drops to 30%.

export const UNLOCK_AT = 0.3;

export const ABILITIES = {
  dash: { name: 'Smash Dash', icon: '⚡', color: '#f59e0b', desc: 'Charge at your rival. Your next hit does 1.5× damage.' },
  plant: { name: 'Plant', icon: '⚓', color: '#64748b', desc: 'Dig in for 2.5 s: 3× heavier and takes half damage.' },
  secondWind: { name: 'Second Wind', icon: '🌀', color: '#10b981', desc: 'Win back 20% health and steady the wobble.' },
  recentre: { name: 'Recentre', icon: '◎', color: '#3b82f6', desc: 'Kill the wobble and slide back toward the middle.' },
  shield: { name: 'Graphite Shield', icon: '🛡', color: '#475569', desc: 'Blocks the next two hits completely.' },
  crumbs: { name: 'Crumb Trail', icon: '✦', color: '#ec4899', desc: 'Drop eraser crumbs for 4 s. Your rival slows down in them.' },
};

export const ABILITY_IDS = Object.keys(ABILITIES);
