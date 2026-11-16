// Screens for the earned kit: padlocks, combo notes, the Rising choice, what a win adds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUI } from '../src/ui.js';

// the build screen animates its preview with animation frames; Node has none, and the fake page has no canvas
globalThis.cancelAnimationFrame ??= () => {};
globalThis.requestAnimationFrame ??= () => 0;

function fakeUI() {
  const calls = [];
  const root = {
    innerHTML: '',
    addEventListener: (t, fn) => { if (t === 'click') root.onclick = fn; },
    querySelector: () => null,
    querySelectorAll: () => [],
    contains: () => true,
  };
  const ui = createUI(root, { action: (a, v) => calls.push([a, v]) }, { now: () => 1e9 });
  const click = (action, value) => root.onclick({ target: { closest: () => ({ dataset: { action, value } }) } });
  return { ui, root, click, calls };
}

const KIT = { erasers: ['apsara-nondust', 'doms-cubo'], leads: ['nataraj-hb', 'doms-y1'] };
const picker = (extra) => ({ player: 0, who: 'You,', color: '#2f5fd0', note: '', eraserId: 'apsara-nondust', leadId: 'nataraj-hb', ...extra });
const button = (html, action, value) => (html.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*data-value="${value}"[^>]*>[\\s\\S]*?</button>`)) || [''])[0];

test('locked parts show a padlock and who holds them', () => {
  const { ui, root } = fakeUI();
  ui.show('picker', picker({ kit: KIT }));
  const faber = button(root.innerHTML, 'pick-eraser', 'faber-dustfree');
  assert.match(faber, /is-locked/);
  assert.match(faber, /aria-disabled="true"/);
  assert.match(faber, /Beat The Topper to win this/);
  const lead = button(root.innerHTML, 'pick-lead', 'apsara-absolute');
  assert.match(lead, /is-locked/);
  assert.match(lead, /Beat The Principal to win this/);
  assert.doesNotMatch(button(root.innerHTML, 'pick-eraser', 'doms-cubo'), /is-locked/);
  assert.doesNotMatch(button(root.innerHTML, 'pick-lead', 'doms-y1'), /is-locked/);
});

test('the parts you own are listed first', () => {
  const { ui, root } = fakeUI();
  ui.show('picker', picker({ kit: KIT }));
  const erasers = [...root.innerHTML.matchAll(/data-action="pick-eraser" data-value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(erasers.slice(0, 2), ['apsara-nondust', 'doms-cubo']);
  assert.equal(erasers.length, 7);
  const leads = [...root.innerHTML.matchAll(/data-action="pick-lead" data-value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(leads.slice(0, 2), ['nataraj-hb', 'doms-y1']);
  ui.show('picker', picker());
  const all = [...root.innerHTML.matchAll(/data-action="pick-eraser" data-value="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(all[1], 'apsara-jumbo', 'with nothing locked, the usual order');
});

test('a locked part cannot be picked', () => {
  const { ui, click, calls } = fakeUI();
  ui.show('picker', picker({ kit: KIT }));
  click('pick-eraser', 'faber-dustfree');
  click('pick-lead', 'faber-2b');
  click('ready');
  assert.deepEqual(calls.at(-1), ['ready', { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' }]);
});

test('with no kit given, nothing is locked', () => {
  const { ui, root } = fakeUI();
  ui.show('picker', picker({ who: 'Player 1,', eraserId: 'apsara-jumbo', leadId: 'faber-2b' }));
  assert.doesNotMatch(root.innerHTML, /is-locked|Beat .* to win this/);
});

test('every top shows a combo note: a star for brand matches, plain for the rest', () => {
  const { ui, root } = fakeUI();
  ui.show('picker', picker());
  assert.match(root.innerHTML, /★ Deadly Duo/);
  ui.show('picker', picker({ eraserId: 'doms-cubo' }));
  assert.match(root.innerHTML, /sticky-std[^>]*>\s*<strong>Sharp Corners/);
  assert.doesNotMatch(root.innerHTML, /★ Sharp Corners|No combo yet/);
  ui.show('picker', picker({ eraserId: 'apsara-jumbo', leadId: 'faber-2b' }));
  assert.match(root.innerHTML, /⚠ Sleepy Bench/);
});

test('locked abilities show who holds them and cannot be picked', () => {
  const { ui, root, click, calls } = fakeUI();
  ui.show('ability', { who: 'You,', color: '#2f5fd0', selected: 'recentre', kit: { abilities: ['recentre', 'secondWind'] } });
  const plant = button(root.innerHTML, 'pick-ability', 'plant');
  assert.match(plant, /is-locked/);
  assert.match(plant, /Beat The Principal to win this/);
  assert.doesNotMatch(button(root.innerHTML, 'pick-ability', 'secondWind'), /is-locked/);
  click('pick-ability', 'plant');
  click('ability-ready');
  assert.deepEqual(calls.at(-1), ['ability-ready', 'recentre']);
});

test('with no kit, every ability can be picked', () => {
  const { ui, root } = fakeUI();
  ui.show('ability', { who: 'Player 2,', color: '#d8432f', selected: 'dash' });
  assert.doesNotMatch(root.innerHTML, /is-locked/);
});

test('the difficulty screen leads with Rising and its level', () => {
  const { ui, root, click, calls } = fakeUI();
  ui.show('difficulty', { rising: { level: 3 } });
  assert.match(root.innerHTML, /data-action="difficulty" data-value="rising"[\s\S]*Rising[\s\S]*level 3 of 7/);
  assert.ok(root.innerHTML.indexOf('data-value="rising"') < root.innerHTML.indexOf('data-value="easy"'));
  for (const d of ['easy', 'medium', 'hard']) assert.match(root.innerHTML, new RegExp(`data-value="${d}"`));
  click('difficulty', 'rising');
  assert.deepEqual(calls.at(-1), ['difficulty', 'rising']);
});

const sheet = (extra) => ({ headline: 'You win the match!', color: '#2f5fd0', names: ['You', 'The Topper'], wins: [4, 1], rounds: [], ...extra });

test('a tournament win lists what was won', () => {
  const { ui, root } = fakeUI();
  ui.show('match', sheet({ won: { erasers: ['Faber-Castell Dust-Free'], leads: ['Faber-Castell 2B'], abilities: ['Graphite Shield'], combos: 10 } }));
  assert.match(root.innerHTML, /You won/);
  assert.match(root.innerHTML, /Faber-Castell Dust-Free/);
  assert.match(root.innerHTML, /Faber-Castell 2B/);
  assert.match(root.innerHTML, /Graphite Shield/);
  assert.match(root.innerHTML, /10 new combos/);
  ui.show('match', sheet({ won: { erasers: [], leads: [], abilities: [], combos: 0 } }));
  assert.doesNotMatch(root.innerHTML, /You won/, 'a replay wins nothing new');
  ui.show('match', sheet());
  assert.doesNotMatch(root.innerHTML, /You won/);
});

test('Rising says when the level moves', () => {
  const { ui, root } = fakeUI();
  ui.show('match', sheet({ risingMoved: { level: 4, moved: 1 } }));
  assert.match(root.innerHTML, /getting better[\s\S]*level 4 of 7/);
  ui.show('match', sheet({ risingMoved: { level: 2, moved: -1 } }));
  assert.match(root.innerHTML, /eases off[\s\S]*level 2 of 7/);
  ui.show('match', sheet());
  assert.doesNotMatch(root.innerHTML, /of 7/);
});

test('existing players get a one-time note on the title screen', () => {
  const { ui, root, click, calls } = fakeUI();
  ui.show('title', { muted: false, coins: 0, kitNote: true });
  assert.match(root.innerHTML, /Win parts in the School Tournament/);
  assert.match(root.innerHTML, /With friends you still have everything/);
  assert.match(root.innerHTML, /data-action="kit-note-ok"/);
  click('kit-note-ok');
  assert.deepEqual(calls.at(-1), ['kit-note-ok', undefined]);
  ui.show('title', { muted: false, coins: 0, kitNote: false });
  assert.doesNotMatch(root.innerHTML, /kit-note-ok/);
});

test('the ladder shows the prize for each opponent still to beat', () => {
  const { ui, root } = fakeUI();
  ui.show('ladder', { progress: { rung: 3, champion: false } });
  assert.match(root.innerHTML, /Prize:[\s\S]*Faber-Castell Dust-Free/);
  assert.match(root.innerHTML, /Prize:[\s\S]*Apsara Jumbo/);
  assert.equal((root.innerHTML.match(/Prize:/g) || []).length, 2, 'only the two rungs not yet beaten');
});

test('a match that pays nothing shows no coin box', () => {
  const { ui, root } = fakeUI();
  ui.show('match', sheet({ coins: { lines: [], total: 0, balance: 120 } }));
  assert.doesNotMatch(root.innerHTML, /pocket money/);
  ui.show('match', sheet({ coins: { lines: [{ label: 'Rounds won', coins: 20 }], total: 20, balance: 140 } }));
  assert.match(root.innerHTML, /\+20 pocket money/);
});

test('tapping a locked lead says who holds it (a phone has no hover text)', () => {
  const { ui, root, click } = fakeUI();
  const label = { innerHTML: '' };
  root.querySelector = (sel) => (sel === '.lead-label' ? label : null);
  ui.show('picker', picker({ kit: KIT }));
  click('pick-lead', 'faber-2b');
  assert.match(label.innerHTML, /Faber-Castell 2B/);
  assert.match(label.innerHTML, /Beat The Topper to win this/);
});
