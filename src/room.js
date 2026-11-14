// A friends room: who sits where, what they picked, and when the host may start. Pure: no DOM.
// Every change returns a new room object.

export const MAX_SEATS = 4;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L look-alikes

export function makeCode(rng = Math.random) {
  let c = '';
  for (let k = 0; k < 4; k++) c += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return c;
}

export const formatCode = (code) => `RR-${code}`;

// what a friend typed → the 4-character code, or null
export function parseCode(text) {
  if (typeof text !== 'string') return null;
  let c = text.toUpperCase().replace(/[\s-]/g, '');
  if (c.length === 6 && c.startsWith('RR')) c = c.slice(2);
  if (c.length !== 4) return null;
  for (const ch of c) if (!ALPHABET.includes(ch)) return null;
  return c;
}

export function cleanName(name, fallback) {
  const n = String(name ?? '').trim().slice(0, 12);
  return n || fallback;
}

const seat = (kind, name, extra = {}) => ({
  kind, peer: null, name, parts: null, ability: null, skin: null, ready: false, difficulty: null, ...extra,
});

export function createRoom(code, hostName) {
  return { code, arena: 'thali', started: false, seats: [seat('host', cleanName(hostName, 'Player 1'))] };
}

const withSeats = (room, seats) => ({ ...room, seats });

export function addGuest(room, peer, name) {
  if (room.started) return { error: 'started' };
  if (room.seats.length >= MAX_SEATS) return { error: 'full' };
  const n = room.seats.length;
  return { room: withSeats(room, [...room.seats, seat('guest', cleanName(name, `Player ${n + 1}`), { peer })]), seat: n };
}

export function setSeat(room, index, patch) {
  if (!room.seats[index]) return room;
  return withSeats(room, room.seats.map((s, k) => (k === index ? { ...s, ...patch } : s)));
}

export function addCpu(room, difficulty, parts, ability) {
  if (room.seats.length >= MAX_SEATS) return room;
  const cpus = room.seats.filter((s) => s.kind === 'cpu').length;
  return withSeats(room, [...room.seats, seat('cpu', `CPU ${cpus + 1}`, { difficulty, parts, ability, ready: true })]);
}

// free a seat (not the host's); everyone after it moves up one
export function removeSeat(room, index) {
  if (index <= 0 || index >= room.seats.length) return room;
  return withSeats(room, room.seats.filter((_, k) => k !== index));
}

export const seatOfPeer = (room, peer) => room.seats.findIndex((s) => s.peer === peer && peer != null);

export function canStart(room) {
  return room.seats.length >= 2 && room.seats.every((s) => s.kind === 'cpu' || (s.ready && s.parts && s.ability));
}

export const startRoom = (room) => ({ ...room, started: true });
export const reopenRoom = (room) => ({ ...room, started: false });

// a friend dropped out mid-match: a medium computer keeps their top spinning
export function replaceWithCpu(room, index) {
  const s = room.seats[index];
  if (!s || s.kind === 'host') return room;
  return setSeat(room, index, {
    kind: 'cpu', peer: null, difficulty: 'medium', ready: true,
    name: s.kind === 'cpu' ? s.name : cleanName(`${s.name.slice(0, 6)} (CPU)`, 'CPU'),
  });
}
