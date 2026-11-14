import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineFor } from '../src/announcer.js';

test('round calls', () => {
  assert.equal(lineFor('round', { label: 'Round 1' }), 'Round one!');
  assert.equal(lineFor('round', { label: 'Round 3 (replay)' }), 'Round three! Replay!');
  assert.equal(lineFor('fight'), 'Ghumao!');
  assert.equal(lineFor('twist'), 'Twist!');
});

test('finish calls name the finish', () => {
  assert.equal(lineFor('finish', { reason: 'ringout' }), 'Knock out!');
  assert.equal(lineFor('finish', { reason: 'snapko' }), 'Snap K. O.!');
  assert.equal(lineFor('finish', { reason: 'tipped' }), 'Tip finish!');
  assert.equal(lineFor('finish', { reason: 'stopped' }), 'Spin finish!');
  assert.equal(lineFor('finish', { reason: 'draw' }), 'Draw!');
  assert.equal(lineFor('finish', { reason: 'ringout', flawless: true }), 'Knock out! Flawless victory!');
});

test('match and moment calls', () => {
  assert.equal(lineFor('match', { name: 'You' }), 'You win!');
  assert.equal(lineFor('match', { name: 'CPU' }), 'CPU wins!');
  assert.equal(lineFor('match', { name: 'Player 2' }), 'Player 2 wins!');
  assert.equal(lineFor('clash'), 'Spin clash!');
  assert.equal(lineFor('snap'), 'Lead snapped!');
  assert.equal(lineFor('finishIt'), 'Finish it!');
  assert.equal(lineFor('nothing-like-this'), null);
});
