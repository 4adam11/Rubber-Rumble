// The connection layer, driven through an in-memory stand-in for PeerJS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostRoom, joinRoom, createFakeNetwork, PROTOCOL } from '../src/net.js';

const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test('a host and two guests can talk', async () => {
  const net = createFakeNetwork();
  const host = await hostRoom('7K2Q', net);
  const joined = [];
  host.onPeer((id) => joined.push(id));
  const got = [];
  host.on('hello', (msg, from) => got.push([msg.name, from]));
  const a = await joinRoom('7K2Q', net);
  const b = await joinRoom('7k2q', net);
  a.send({ t: 'hello', name: 'Ben' });
  b.send({ t: 'hello', name: 'Chitra' });
  await wait();
  assert.equal(joined.length, 2);
  assert.deepEqual(got.map((g) => g[0]).sort(), ['Ben', 'Chitra']);
  const seen = [];
  a.on('lobby', (m) => seen.push(['a', m.n]));
  b.on('lobby', (m) => seen.push(['b', m.n]));
  host.send('*', { t: 'lobby', n: 1 });
  host.send(got.find((g) => g[0] === 'Ben')[1], { t: 'lobby', n: 2 });
  await wait();
  assert.deepEqual(seen.sort(), [['a', 1], ['a', 2], ['b', 1]]);
});

test('messages are copies, like the real wire', async () => {
  const net = createFakeNetwork();
  const host = await hostRoom('AAAA', net);
  const g = await joinRoom('AAAA', net);
  let got = null;
  host.on('x', (m) => { got = m; });
  const msg = { t: 'x', list: [1, 2] };
  g.send(msg);
  msg.list.push(3);
  await wait();
  assert.deepEqual(got.list, [1, 2]);
  assert.equal(got.v, PROTOCOL);
});

test('joining a code nobody is hosting fails with no-room', async () => {
  const net = createFakeNetwork();
  await assert.rejects(joinRoom('ZZZZ', net), /no-room/);
});

test('hosting a code already in use fails with code-taken', async () => {
  const net = createFakeNetwork();
  await hostRoom('BBBB', net);
  await assert.rejects(hostRoom('BBBB', net), /code-taken/);
});

test('the host hears when a guest leaves, and guests hear when the host leaves', async () => {
  const net = createFakeNetwork();
  const host = await hostRoom('CCCC', net);
  const left = [];
  host.onLeave((id) => left.push(id));
  const g1 = await joinRoom('CCCC', net);
  const g2 = await joinRoom('CCCC', net);
  let hostGone = false;
  g2.onLeave(() => { hostGone = true; });
  await wait();
  g1.close();
  await wait();
  assert.equal(left.length, 1);
  host.close();
  await wait();
  assert.equal(hostGone, true);
});

test('an out-of-date game is turned away', async () => {
  const net = createFakeNetwork();
  const host = await hostRoom('DDDD', net);
  let heard = false;
  host.on('hello', () => { heard = true; });
  const g = await joinRoom('DDDD', net, { protocol: PROTOCOL + 1 });
  let reason = null;
  g.on('reject', (m) => { reason = m.reason; });
  g.send({ t: 'hello', name: 'Old' });
  await wait(20);
  assert.equal(heard, false);
  assert.equal(reason, 'version');
});

test('a friend whose tab vanishes without saying goodbye is noticed by the heartbeat', async () => {
  const net = createFakeNetwork();
  const host = await hostRoom('EEEE', net, { beat: 10, timeout: 60 });
  const left = [];
  host.onLeave((id) => left.push(id));
  const g = await joinRoom('EEEE', net, { beat: 10, timeout: 60 });
  let hostGone = false;
  g.onLeave(() => { hostGone = true; });
  await wait(40);
  assert.equal(left.length, 0, 'heartbeats keep a quiet friend in the room');
  net.vanish(g.peerId);
  await wait(150);
  assert.equal(left.length, 1, 'host noticed');
  host.close();
  g.close();
});

test('a guest notices a host that vanished', async () => {
  const net = createFakeNetwork();
  const host = await hostRoom('FFFF', net, { beat: 10, timeout: 60 });
  const g = await joinRoom('FFFF', net, { beat: 10, timeout: 60 });
  let hostGone = false;
  g.onLeave(() => { hostGone = true; });
  await wait(30);
  net.vanish(host.peerId);
  await wait(150);
  assert.equal(hostGone, true);
  g.close();
});
