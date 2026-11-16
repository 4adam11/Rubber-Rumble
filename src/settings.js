// Per-device settings in localStorage. Always safe to call.
import { newRising, cleanRising } from './rising.js';
import { ERASERS, LEADS } from './parts.js';
import { ABILITY_IDS } from './abilities.js';
import { ARENA_IDS } from './arenas.js';
import { RUNGS } from './tournament.js';
import { SHOP, newWallet } from './economy.js';

const KEY = 'rubber-rumble:v1';
const DEFAULT_PARTS = { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' };

export function defaultSettings() {
  return {
    muted: false,
    lastParts: [{ ...DEFAULT_PARTS }, { eraserId: 'doms-cubo', leadId: 'doms-y1' }],
    lastAbility: ['secondWind', 'dash'],
    lastArena: 'thali',
    tournament: { rung: 0, champion: false },
    wallet: newWallet(),
    nickname: '',
    rising: newRising(), // the Rising difficulty level for Play vs Computer
    kitVersion: 1,  // saves from before the earned kit don't have this
    kitNote: false, // true until an existing player has seen the one-time "what changed" note
  };
}

export const cleanNickname = (n) => (typeof n === 'string' ? n.trim().slice(0, 12).trim() : '');

const validParts = (p) => p && ERASERS.some((e) => e.id === p.eraserId) && LEADS.some((l) => l.id === p.leadId);

export function loadSettings() {
  const s = defaultSettings();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      if (typeof raw.muted === 'boolean') s.muted = raw.muted;
      s.kitNote = raw.kitVersion === 1 ? raw.kitNote === true : true;
      s.rising = cleanRising(raw.rising);
      if (Array.isArray(raw.lastParts)) {
        raw.lastParts.slice(0, 2).forEach((p, i) => {
          if (validParts(p)) s.lastParts[i] = { eraserId: p.eraserId, leadId: p.leadId };
        });
      }
      if (Array.isArray(raw.lastAbility)) {
        raw.lastAbility.slice(0, 2).forEach((a, i) => { if (ABILITY_IDS.includes(a)) s.lastAbility[i] = a; });
      }
      if (ARENA_IDS.includes(raw.lastArena)) s.lastArena = raw.lastArena;
      s.nickname = cleanNickname(raw.nickname);
      const t = raw.tournament;
      if (t && Number.isInteger(t.rung) && t.rung >= 0 && t.rung < RUNGS.length) {
        s.tournament = { rung: t.rung, champion: !!t.champion };
      }
      const w = raw.wallet;
      if (w && Number.isFinite(w.coins) && Array.isArray(w.owned)) {
        const ids = SHOP.map((i) => i.id);
        const owned = [...new Set(['sleeve-classic', 'pencil-classic', ...w.owned.filter((id) => ids.includes(id))])];
        const ok = (kind, skin) => owned.includes(`${kind}-${skin}`);
        s.wallet = {
          coins: Math.max(0, Math.floor(w.coins)),
          owned,
          equipped: {
            sleeve: ok('sleeve', w.equipped?.sleeve) ? w.equipped.sleeve : 'classic',
            pencil: ok('pencil', w.equipped?.pencil) ? w.equipped.pencil : 'classic',
          },
        };
      }
    }
  } catch { /* storage blocked or corrupt: defaults */ }
  return s;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
