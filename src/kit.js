// The earned kit: which erasers, leads and abilities a player may use. Pure: no DOM.
//
// Alone, a player starts with a small kit and wins the rest by beating School Tournament opponents:
// each win takes that opponent's eraser, lead and ability. Nothing extra is saved for this: the kit
// is worked out from the tournament progress the game already keeps. A combo is on as soon as both
// of its parts are owned. Whenever two or more humans play, everyone gets the full kit.
import { ERASERS, LEADS } from './parts.js';
import { ABILITIES, ABILITY_IDS } from './abilities.js';
import { RUNGS } from './tournament.js';

export const STARTER = {
  erasers: ['apsara-nondust', 'doms-cubo'],
  leads: ['nataraj-hb', 'doms-y1'],
  abilities: ['recentre', 'secondWind'],
};

export const FULL_KIT = {
  erasers: ERASERS.map((e) => e.id),
  leads: LEADS.map((l) => l.id),
  abilities: [...ABILITY_IDS],
};

// How many rungs the player has beaten (0–5). `rung` is the next rung to fight; a champion has beaten all.
export function rungsBeaten(progress) {
  if (progress?.champion) return RUNGS.length;
  const r = Number.isInteger(progress?.rung) ? progress.rung : 0;
  return Math.max(0, Math.min(RUNGS.length - 1, r));
}

function kitAfter(beaten) {
  const kit = { erasers: [...STARTER.erasers], leads: [...STARTER.leads], abilities: [...STARTER.abilities] };
  const add = (list, id) => { if (!list.includes(id)) list.push(id); };
  for (const r of RUNGS.slice(0, beaten)) {
    add(kit.erasers, r.parts.eraserId);
    add(kit.leads, r.parts.leadId);
    add(kit.abilities, r.ability);
  }
  return kit;
}

export const earnedKit = (progress) => kitAfter(rungsBeaten(progress));

export const isFullKit = (kit) => kit.erasers.length >= FULL_KIT.erasers.length
  && kit.leads.length >= FULL_KIT.leads.length && kit.abilities.length >= FULL_KIT.abilities.length;

// The kit for a game: everything when two or more humans play, the earned kit otherwise.
export function kitFor({ mode, humans = 1, progress }) {
  if (mode === '2p' || (mode === 'friends' && humans >= 2)) return FULL_KIT;
  return earnedKit(progress);
}

export function inKit(kit, parts, ability) {
  if (!parts || !kit.erasers.includes(parts.eraserId) || !kit.leads.includes(parts.leadId)) return false;
  return ability === undefined || kit.abilities.includes(ability);
}

// A remembered pick, or the kit's first choice where the remembered one isn't in the kit.
export function fitParts(kit, parts) {
  return {
    eraserId: kit.erasers.includes(parts?.eraserId) ? parts.eraserId : kit.erasers[0],
    leadId: kit.leads.includes(parts?.leadId) ? parts.leadId : kit.leads[0],
  };
}
export const fitAbility = (kit, ability) => (kit.abilities.includes(ability) ? ability : kit.abilities[0]);

// Who must be beaten to win a part ("Beat The Topper to win this"), or null for a starting part.
export function holderOf(kind, id) {
  const list = { eraser: STARTER.erasers, lead: STARTER.leads, ability: STARTER.abilities }[kind];
  if (!list || list.includes(id)) return null;
  const rung = RUNGS.find((r) => (kind === 'eraser' ? r.parts.eraserId : kind === 'lead' ? r.parts.leadId : r.ability) === id);
  return rung ? rung.name : null;
}

// What beating rung `rungIndex` adds for a player whose progress was `progressBefore`: names, and how
// many new tops (each with its combo) they can now build. Empty on a replay of a rung already beaten.
export function rewardFor(rungIndex, progressBefore) {
  const beaten = rungsBeaten(progressBefore);
  const none = { erasers: [], leads: [], abilities: [], combos: 0 };
  if (rungIndex !== beaten || beaten >= RUNGS.length) return none;
  const before = kitAfter(beaten), after = kitAfter(beaten + 1);
  const fresh = (k) => after[k].filter((id) => !before[k].includes(id));
  return {
    erasers: fresh('erasers').map((id) => ERASERS.find((e) => e.id === id).name),
    leads: fresh('leads').map((id) => LEADS.find((l) => l.id === id).name),
    abilities: fresh('abilities').map((id) => ABILITIES[id].name),
    combos: after.erasers.length * after.leads.length - before.erasers.length * before.leads.length,
  };
}

// ---- online rooms ----
export const humansIn = (room) => (room?.seats || []).filter((s) => s.kind !== 'cpu').length;

// One human in the room, and the creator (seat 0) picked a top or ability they have not earned:
// they must pick again before the battle can start.
export function creatorMustRepick(room, progress) {
  if (humansIn(room) >= 2) return false;
  const me = room?.seats?.[0];
  if (!me?.parts) return false;
  return !inKit(earnedKit(progress), me.parts, me.ability);
}
