// The earned kit: what a solo player owns, worked out from School Tournament progress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTER, FULL_KIT, rungsBeaten, earnedKit, kitFor, inKit, fitParts, fitAbility, holderOf, rewardFor, humansIn, creatorMustRepick, isFullKit } from '../src/kit.js';
import { ERASERS, LEADS } from '../src/parts.js';
import { ABILITY_IDS } from '../src/abilities.js';

const P = (rung, champion = false) => ({ rung, champion });

test('a new player has the starting kit: 4 tops', () => {
  assert.deepEqual(earnedKit(P(0)), { erasers: ['apsara-nondust', 'doms-cubo'], leads: ['nataraj-hb', 'doms-y1'], abilities: ['recentre', 'secondWind'] });
  assert.deepEqual(earnedKit(P(0)), STARTER);
  assert.deepEqual(earnedKit(undefined), STARTER, 'no saved progress at all');
});

test('each rung beaten adds that opponent\'s kit', () => {
  const sizes = [0, 1, 2, 3, 4].map((r) => earnedKit(P(r))).map((k) => k.erasers.length * k.leads.length);
  assert.deepEqual(sizes, [4, 9, 12, 20, 30]);
  assert.deepEqual(earnedKit(P(1)).abilities, ['recentre', 'secondWind', 'dash']);
  assert.deepEqual(earnedKit(P(2)).erasers, ['apsara-nondust', 'doms-cubo', 'nataraj-621', 'fruit-scented']);
});

test('a champion has beaten five rungs and owns everything', () => {
  assert.equal(rungsBeaten(P(4, true)), 5);
  assert.equal(rungsBeaten(P(4, false)), 4);
  const k = earnedKit(P(4, true));
  assert.equal(k.erasers.length * k.leads.length, 42);
  assert.equal(k.abilities.length, 6);
  assert.equal(isFullKit(k), true);
  assert.equal(isFullKit(earnedKit(P(4))), false);
});

test('the full kit is every part and ability in the game', () => {
  assert.deepEqual([...FULL_KIT.erasers].sort(), ERASERS.map((e) => e.id).sort());
  assert.deepEqual([...FULL_KIT.leads].sort(), LEADS.map((l) => l.id).sort());
  assert.deepEqual([...FULL_KIT.abilities].sort(), [...ABILITY_IDS].sort());
});

test('odd saved progress cannot break the kit', () => {
  assert.equal(rungsBeaten({ rung: 99 }), 4);
  assert.equal(rungsBeaten({ rung: -3 }), 0);
  assert.equal(rungsBeaten({ rung: 'x', champion: false }), 0);
  assert.equal(rungsBeaten(null), 0);
});

test('friends and same-device 2P get the full kit; one human alone does not', () => {
  assert.equal(kitFor({ mode: '2p', progress: P(0) }).erasers.length, 7);
  assert.equal(kitFor({ mode: 'friends', humans: 2, progress: P(0) }).erasers.length, 7);
  assert.equal(kitFor({ mode: 'friends', humans: 1, progress: P(0) }).erasers.length, 2);
  assert.equal(kitFor({ mode: 'cpu', progress: P(0) }).erasers.length, 2);
  assert.equal(kitFor({ mode: 'tournament', progress: P(3) }).erasers.length, 5);
});

test('a remembered top outside the kit falls back to a starting top', () => {
  const k = earnedKit(P(0));
  assert.deepEqual(fitParts(k, { eraserId: 'apsara-jumbo', leadId: 'faber-2b' }), { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' });
  assert.deepEqual(fitParts(k, { eraserId: 'doms-cubo', leadId: 'faber-2b' }), { eraserId: 'doms-cubo', leadId: 'nataraj-hb' }, 'keeps the part that is allowed');
  assert.deepEqual(fitParts(k, { eraserId: 'doms-cubo', leadId: 'doms-y1' }), { eraserId: 'doms-cubo', leadId: 'doms-y1' });
  assert.deepEqual(fitParts(k, null), { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' });
  assert.equal(fitAbility(k, 'plant'), 'recentre');
  assert.equal(fitAbility(k, 'secondWind'), 'secondWind');
  assert.equal(inKit(k, { eraserId: 'doms-cubo', leadId: 'nataraj-hb' }, 'secondWind'), true);
  assert.equal(inKit(k, { eraserId: 'doms-cubo', leadId: 'nataraj-hb' }, 'dash'), false);
  assert.equal(inKit(k, { eraserId: 'apsara-jumbo', leadId: 'nataraj-hb' }), false);
  assert.equal(inKit(k, { eraserId: 'doms-cubo', leadId: 'nataraj-hb' }), true, 'ability is optional');
});

test('locked parts name who holds them', () => {
  assert.equal(holderOf('eraser', 'faber-dustfree'), 'The Topper');
  assert.equal(holderOf('lead', 'apsara-platinum'), 'Class Bully');
  assert.equal(holderOf('ability', 'plant'), 'The Principal');
  assert.equal(holderOf('eraser', 'apsara-nondust'), null);
  assert.equal(holderOf('lead', 'doms-y1'), null, 'a starting part has no holder, even though the Backbencher uses it');
  assert.equal(holderOf('ability', 'secondWind'), null);
});

test('a first win lists what it adds; a replay adds nothing', () => {
  const r = rewardFor(3, P(3));
  assert.deepEqual(r, { erasers: ['Faber-Castell Dust-Free'], leads: ['Faber-Castell 2B'], abilities: ['Graphite Shield'], combos: 10 });
  assert.deepEqual(rewardFor(1, P(1)), { erasers: ['Fruit-Scented Fancy Eraser'], leads: [], abilities: ['Crumb Trail'], combos: 3 });
  assert.equal(rewardFor(4, P(4)).combos, 12);
  assert.deepEqual(rewardFor(0, P(3)), { erasers: [], leads: [], abilities: [], combos: 0 });
  assert.deepEqual(rewardFor(4, P(4, true)), { erasers: [], leads: [], abilities: [], combos: 0 });
});

test('a room with one human and a full-kit top must re-pick', () => {
  const seat = (kind, parts, ability) => ({ kind, parts, ability, ready: true });
  const jumbo = { eraserId: 'apsara-jumbo', leadId: 'faber-2b' };
  const starter = { eraserId: 'doms-cubo', leadId: 'doms-y1' };
  assert.equal(humansIn({ seats: [seat('host'), seat('cpu'), seat('guest')] }), 2);
  assert.equal(creatorMustRepick({ seats: [seat('host', jumbo, 'plant'), seat('cpu', jumbo, 'plant')] }, P(0)), true);
  assert.equal(creatorMustRepick({ seats: [seat('host', starter, 'plant'), seat('cpu', jumbo, 'plant')] }, P(0)), true, 'the ability counts too');
  assert.equal(creatorMustRepick({ seats: [seat('host', starter, 'recentre'), seat('cpu', jumbo, 'plant')] }, P(0)), false);
  assert.equal(creatorMustRepick({ seats: [seat('host', jumbo, 'plant'), seat('guest', jumbo, 'plant')] }, P(0)), false, 'a friend is in the room');
  assert.equal(creatorMustRepick({ seats: [seat('host', jumbo, 'plant'), seat('cpu', jumbo, 'plant')] }, P(4, true)), false, 'a champion owns it');
});
