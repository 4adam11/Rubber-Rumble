import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, POINTS, TARGET_POINTS } from '../src/match.js';

const win = (w, reason = 'stopped') => ({ winner: w, reason });
const DRAW = { winner: null, reason: 'draw' };

test('finishes are worth different points', () => {
  assert.deepEqual(POINTS, { stopped: 1, time: 1, tipped: 2, ringout: 2, snapko: 3 });
  assert.equal(TARGET_POINTS, 4);
  const m = createMatch();
  assert.deepEqual(m.record(win(0, 'stopped')).points, [1, 0]);
  assert.deepEqual(m.record(win(1, 'ringout')).points, [1, 2]);
  assert.deepEqual(m.record(win(1, 'tipped')).points, [1, 4]);
});

test('first to 4 points wins', () => {
  const m = createMatch();
  for (let i = 0; i < 3; i++) assert.equal(m.record(win(0)).over, false);
  const s = m.record(win(0));
  assert.equal(s.over, true);
  assert.equal(s.winner, 0);
  assert.deepEqual(s.wins, [4, 0]);
});

test('a snap KO plus a spin finish is enough', () => {
  const m = createMatch();
  m.record(win(1, 'snapko'));
  const s = m.record(win(1, 'time'));
  assert.equal(s.over, true);
  assert.deepEqual(s.points, [0, 4]);
  assert.deepEqual(s.wins, [0, 2]);
});

test('going past 4 still ends the match', () => {
  const m = createMatch();
  m.record(win(0, 'snapko'));
  const s = m.record(win(0, 'tipped'));
  assert.equal(s.over, true);
  assert.deepEqual(s.points, [5, 0]);
});

test('draws are replayed and score nothing', () => {
  const m = createMatch();
  m.record(DRAW);
  const s = m.record(DRAW);
  assert.deepEqual(s.points, [0, 0]);
  assert.equal(s.rounds.length, 2);
  assert.equal(s.rounds[0].points, 0);
});

test('each round remembers the points it scored', () => {
  const m = createMatch();
  m.record(win(0, 'ringout'));
  assert.equal(m.state().rounds[0].points, 2);
});

test('record after over is ignored', () => {
  const m = createMatch();
  m.record(win(0, 'snapko'));
  m.record(win(0, 'stopped'));
  const s = m.record(win(1, 'snapko'));
  assert.deepEqual(s.points, [4, 0]);
  assert.equal(s.rounds.length, 2);
});

test('state is a copy', () => {
  const m = createMatch();
  m.state().points[0] = 99;
  assert.deepEqual(m.state().points, [0, 0]);
});
