// Per-device settings in localStorage. Always safe to call.
import { ERASERS, LEADS } from './parts.js';
import { ABILITY_IDS } from './abilities.js';
import { ARENA_IDS } from './arenas.js';

const KEY = 'rubber-rumble:v1';
const DEFAULT_PARTS = { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' };

export function defaultSettings() {
  return {
    muted: false,
    lastParts: [{ ...DEFAULT_PARTS }, { eraserId: 'doms-cubo', leadId: 'doms-y1' }],
    lastAbility: ['secondWind', 'dash'],
    lastArena: 'thali',
  };
}

const validParts = (p) => p && ERASERS.some((e) => e.id === p.eraserId) && LEADS.some((l) => l.id === p.leadId);

export function loadSettings() {
  const s = defaultSettings();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      if (typeof raw.muted === 'boolean') s.muted = raw.muted;
      if (Array.isArray(raw.lastParts)) {
        raw.lastParts.slice(0, 2).forEach((p, i) => {
          if (validParts(p)) s.lastParts[i] = { eraserId: p.eraserId, leadId: p.leadId };
        });
      }
      if (Array.isArray(raw.lastAbility)) {
        raw.lastAbility.slice(0, 2).forEach((a, i) => { if (ABILITY_IDS.includes(a)) s.lastAbility[i] = a; });
      }
      if (ARENA_IDS.includes(raw.lastArena)) s.lastArena = raw.lastArena;
    }
  } catch { /* storage blocked or corrupt: defaults */ }
  return s;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
