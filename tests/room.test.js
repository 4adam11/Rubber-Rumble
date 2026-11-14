// Friends rooms: codes, seats, computer fill-ins and when the host may start.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeCode, parseCode, formatCode, createRoom, addGuest, setSeat, addCpu, removeSeat, canStart, seatOfPeer,
  replaceWithCpu, startRoom, MAX_SEATS,
} from '../src/room.js';
import { seeded } from './helpers.js';

const PARTS = { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' };

test('codes are 4 characters with no look-alikes (0/O, 1/I/L)', () => {
  const rng = seeded(7);
  for (let k = 0; k < 300; k++) {
    const c = makeCode(rng);
    assert.match(c, /^[A-Z2-9]{4}$/);
    assert.doesNotMatch(c, /[01OIL]/);
  }
  assert.equal(formatCode('7K2Q'), 'RR-7K2Q');
});

test('typed codes are forgiving about case, spaces and the RR- prefix', () => {
  assert.equal(parseCode('rr-7k2q'), '7K2Q');
  assert.equal(parseCode(' 7K2Q '), '7K2Q');
  assert.equal(parseCode('RR7K2Q'), '7K2Q');
  assert.equal(parseCode('RR-7K2'), null);
  assert.equal(parseCode('RR-7K2QQ'), null);
  assert.equal(parseCode(''), null);
  assert.equal(parseCode(null), null);
});

test('the host sits in seat 1 and up to three friends join', () => {
  let room = createRoom('7K2Q', 'Asha');
  assert.equal(room.seats[0].kind, 'host');
  assert.equal(room.seats[0].name, 'Asha');
  for (const [k, name] of ['Ben', 'Chitra', 'Dev'].entries()) {
    const r = addGuest(room, `peer-${k}`, name);
    assert.equal(r.seat, k + 1);
    room = r.room;
  }
  assert.equal(room.seats.length, MAX_SEATS);
  assert.deepEqual(addGuest(room, 'peer-x', 'Eve'), { error: 'full' });
  assert.equal(seatOfPeer(room, 'peer-1'), 2);
  assert.equal(seatOfPeer(room, 'nobody'), -1);
});

test('nobody joins a match that has started', () => {
  let room = addGuest(createRoom('7K2Q', 'Asha'), 'p1', 'Ben').room;
  room = startRoom(room);
  assert.deepEqual(addGuest(room, 'p2', 'Chitra'), { error: 'started' });
});

test('names are tidied: trimmed, max 12 characters, never empty', () => {
  const room = addGuest(createRoom('7K2Q', '   '), 'p1', 'A really long nickname').room;
  assert.equal(room.seats[0].name, 'Player 1');
  assert.equal(room.seats[1].name, 'A really lon');
});

test('Start needs two seats and every human ready; computers are always ready', () => {
  let room = createRoom('7K2Q', 'Asha');
  room = setSeat(room, 0, { parts: PARTS, ability: 'dash', ready: true });
  assert.equal(canStart(room), false, 'alone');
  room = addCpu(room, 'hard', PARTS, 'shield');
  assert.equal(room.seats[1].kind, 'cpu');
  assert.equal(room.seats[1].ready, true);
  assert.equal(canStart(room), true, 'host + CPU');
  room = addGuest(room, 'p1', 'Ben').room;
  assert.equal(canStart(room), false, 'Ben is still picking');
  room = setSeat(room, 2, { parts: PARTS, ability: 'plant', ready: true });
  assert.equal(canStart(room), true);
});

test('seats can be freed, but the host seat stays', () => {
  let room = addCpu(createRoom('7K2Q', 'Asha'), 'easy', PARTS, 'dash');
  room = addGuest(room, 'p1', 'Ben').room;
  room = removeSeat(room, 1);
  assert.deepEqual(room.seats.map((s) => s.kind), ['host', 'guest']);
  assert.equal(seatOfPeer(room, 'p1'), 1);
  assert.equal(removeSeat(room, 0), room);
});

test('a friend who drops mid-match is replaced by a medium computer', () => {
  let room = addGuest(createRoom('7K2Q', 'Asha'), 'p1', 'Ben').room;
  room = setSeat(room, 1, { parts: PARTS, ability: 'plant', ready: true });
  room = replaceWithCpu(startRoom(room), 1);
  assert.equal(room.seats[1].kind, 'cpu');
  assert.equal(room.seats[1].difficulty, 'medium');
  assert.equal(room.seats[1].name, 'Ben (CPU)');
  assert.deepEqual(room.seats[1].parts, PARTS);
  assert.equal(room.seats[1].peer, null);
});
