// Friends-mode screens and the saved nickname.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUI } from '../src/ui.js';

function fakeUI(fields = {}) {
  const calls = [];
  const root = {
    innerHTML: '',
    addEventListener: (t, fn) => { if (t === 'click') root.onclick = fn; },
    querySelector: (sel) => (sel in fields ? { value: fields[sel], focus() {} } : null),
    contains: () => true,
  };
  const ui = createUI(root, { action: (a, v) => calls.push([a, v]) }, { now: () => 1e9 });
  const click = (action, value) => root.onclick({ target: { closest: () => ({ dataset: { action, value } }) } });
  return { ui, root, click, calls };
}

const PARTS = { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' };
const seat = (name, extra = {}) => ({ name, kind: 'guest', color: '#2f5fd0', parts: PARTS, ability: 'dash', ready: true, ...extra });

test('the title screen offers Play with Friends', () => {
  const { ui, root } = fakeUI();
  ui.show('title', { muted: false, coins: 0 });
  assert.match(root.innerHTML, /data-action="friends"/);
});

test('create and join send the typed nickname and code', () => {
  const { ui, click, calls } = fakeUI({ '#nick': 'Asha', '#room-code': 'rr-7k2q' });
  ui.show('friends', { name: 'Asha' });
  click('create-room');
  click('join-room');
  assert.deepEqual(calls, [['create-room', { name: 'Asha', code: 'rr-7k2q' }], ['join-room', { name: 'Asha', code: 'rr-7k2q' }]]);
});

test('the friends screen shows a connection error', () => {
  const { ui, root } = fakeUI();
  ui.show('friends', { name: 'Asha', error: 'No room with that code' });
  assert.match(root.innerHTML, /No room with that code/);
});

test('the lobby lists every seat; only the host gets Start, enabled when ready', () => {
  const { ui, root } = fakeUI();
  const seats = [seat('Asha', { kind: 'host', you: true }), seat('Ben'), seat('Chitra', { ready: false, parts: null }), seat('CPU 1', { kind: 'cpu', difficulty: 'hard' })];
  ui.show('lobby', { code: '7K2Q', seats, host: true, arena: 'thali', canStart: false });
  for (const n of ['Asha', 'Ben', 'Chitra', 'CPU 1', 'RR-7K2Q']) assert.ok(root.innerHTML.includes(n), n);
  assert.match(root.innerHTML, /data-action="lobby-start"[^>]*disabled/);
  ui.show('lobby', { code: '7K2Q', seats, host: true, arena: 'thali', canStart: true });
  assert.doesNotMatch(root.innerHTML, /data-action="lobby-start"[^>]*disabled/);
  ui.show('lobby', { code: '7K2Q', seats, host: false, arena: 'thali', canStart: true });
  assert.doesNotMatch(root.innerHTML, /data-action="lobby-start"/);
  assert.doesNotMatch(root.innerHTML, /data-action="lobby-cpu"/);
  assert.match(root.innerHTML, /Waiting for the host/);
});

test('an empty lobby seat invites a friend, and the host can add a computer', () => {
  const { ui, root } = fakeUI();
  ui.show('lobby', { code: '7K2Q', seats: [seat('Asha', { kind: 'host', you: true })], host: true, arena: 'thali', canStart: false });
  assert.match(root.innerHTML, /Waiting for a friend/);
  assert.match(root.innerHTML, /data-action="lobby-cpu"/);
});

test('results with 3+ players list everyone; friends wait for the host', () => {
  const { ui, root } = fakeUI();
  const data = { headline: 'Ben wins round 1!', sub: 'Tip Finish +2', color: '#d8432f', names: ['Asha', 'Ben', 'Chitra'], wins: [0, 2, 1], draw: false };
  ui.show('round', data);
  for (const n of ['Asha', 'Ben', 'Chitra']) assert.ok(root.innerHTML.includes(n), n);
  assert.match(root.innerHTML, /data-action="next-round"/);
  ui.show('round', { ...data, waiting: true });
  assert.doesNotMatch(root.innerHTML, /data-action="next-round"/);
  assert.match(root.innerHTML, /Waiting for the host/);
});

test('online pause keeps the game running and offers Leave room', () => {
  const { ui, root } = fakeUI();
  ui.show('pause', { online: true, muted: false });
  assert.match(root.innerHTML, /data-action="leave-room"/);
  assert.match(root.innerHTML, /data-action="resume"/);
});

test('the nickname is saved, trimmed and capped at 12 characters', async () => {
  const store = new Map([['rubber-rumble:v1', JSON.stringify({ nickname: '   A very long nickname   ' })]]);
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const { loadSettings } = await import('../src/settings.js');
  assert.equal(loadSettings().nickname, 'A very long');
  store.set('rubber-rumble:v1', JSON.stringify({ nickname: 42 }));
  assert.equal(loadSettings().nickname, '');
  delete globalThis.localStorage;
});
