// Per-device settings in localStorage. Always safe to call.
import { ERASERS, LEADS } from './parts.js';

const KEY = 'rubber-rumble:v1';
const DEFAULT_PARTS = { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' };

export function defaultSettings() {
  return { muted: false, lastParts: [{ ...DEFAULT_PARTS }, { eraserId: 'doms-cubo', leadId: 'doms-y1' }] };
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
    }
  } catch { /* storage blocked or corrupt: defaults */ }
  return s;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
