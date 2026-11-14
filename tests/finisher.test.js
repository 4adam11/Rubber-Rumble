import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINISHERS, FINISH_SECONDS, makeSequence, createFinishInput, pickFinisher, cpuFinishes } from '../src/finisher.js';
import { seeded } from './helpers.js';

const DIRS = ['up', 'down', 'left', 'right'];

test('a sequence is three directions then the special', () => {
  const rng = seeded(3);
  for (let k = 0; k < 20; k++) {
    const seq = makeSequence(rng);
    assert.equal(seq.length, 4);
    assert.ok(seq.slice(0, 3).every((m) => DIRS.includes(m)));
    assert.equal(seq[3], 'special');
  }
});

test('entering the sequence finishes it', () => {
  const f = createFinishInput(['up', 'left', 'down', 'special']);
  assert.equal(f.feed('up'), 'progress');
  assert.equal(f.feed('left'), 'progress');
  assert.equal(f.feed('down'), 'progress');
  assert.equal(f.feed('special'), 'done');
  assert.equal(f.state.status, 'done');
});

test('a wrong move starts the sequence over', () => {
  const f = createFinishInput(['up', 'left', 'down', 'special']);
  f.feed('up');
  assert.equal(f.feed('right'), 'wrong');
  assert.equal(f.state.progress, 0);
  f.feed('up'); f.feed('left'); f.feed('down');
  assert.equal(f.feed('special'), 'done');
});

test('a wrong move that happens to be the first move counts as a fresh start', () => {
  const f = createFinishInput(['up', 'up', 'down', 'special']);
  f.feed('up'); f.feed('up');
  assert.equal(f.feed('up'), 'wrong');
  assert.equal(f.state.progress, 1);
});

test('the window closes after the time limit', () => {
  const f = createFinishInput(['up', 'left', 'down', 'special']);
  assert.equal(f.tick(FINISH_SECONDS - 0.1), 'input');
  assert.equal(f.tick(0.2), 'timeout');
  assert.equal(f.feed('up'), 'timeout');
});

test('each eraser type has its finisher', () => {
  assert.deepEqual(Object.keys(FINISHERS).sort(), ['rubout', 'sharpener']);
  assert.equal(pickFinisher('attack'), 'sharpener');
  assert.equal(pickFinisher('defense'), 'sharpener');
  assert.equal(pickFinisher('stamina'), 'rubout');
  assert.equal(pickFinisher('balance'), 'rubout');
  assert.equal(pickFinisher('wildcard'), 'rubout');
});

test('the computer pulls off finishers more often on Hard', () => {
  const rate = (d) => { const rng = seeded(9); let n = 0; for (let i = 0; i < 400; i++) n += cpuFinishes(d, rng) ? 1 : 0; return n / 400; };
  assert.ok(rate('hard') > rate('medium') && rate('medium') > rate('easy'));
  assert.ok(rate('easy') > 0.2);
});
