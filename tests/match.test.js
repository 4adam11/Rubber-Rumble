import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from '../src/match.js';

const win = (w, reason = 'stopped') => ({ winner: w, reason });
const DRAW = { winner: null, reason: 'draw' };

test('best of three', () => {
  const m = createMatch();
  m.record(win(0));
  assert.equal(m.state().over, false);
  m.record(win(1));
  const s = m.record(win(0));
  assert.equal(s.over, true);
  assert.equal(s.winner, 0);
  assert.deepEqual(s.wins, [2, 1]);
});

test('two straight wins end it', () => {
  const m = createMatch();
  m.record(win(1, 'ringout'));
  const s = m.record(win(1, 'tipped'));
  assert.equal(s.over, true);
  assert.equal(s.winner, 1);
});

test('draws are replayed', () => {
  const m = createMatch();
  m.record(DRAW);
  m.record(DRAW);
  m.record(win(1));
  const s = m.record(win(1));
  assert.equal(s.over, true);
  assert.equal(s.winner, 1);
  assert.equal(s.rounds.length, 4);
  assert.deepEqual(s.wins, [0, 2]);
});

test('record after over is ignored', () => {
  const m = createMatch();
  m.record(win(0));
  m.record(win(0));
  const s = m.record(win(1));
  assert.deepEqual(s.wins, [2, 0]);
  assert.equal(s.rounds.length, 2);
});

test('state is a copy', () => {
  const m = createMatch();
  m.state().wins[0] = 99;
  assert.deepEqual(m.state().wins, [0, 0]);
});
