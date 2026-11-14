import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOP, newWallet, matchCoins, buy, equip, owns } from '../src/economy.js';
import { drawEraserTop, drawEraserSide, drawPencil, drawLeadTop, drawTopSide } from '../src/art.js';

test('the shop sells sleeves and pencil paints; classic is free and owned', () => {
  const ids = SHOP.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const kind of ['sleeve', 'pencil']) {
    const items = SHOP.filter((i) => i.kind === kind);
    assert.ok(items.length >= 4, kind);
    assert.equal(items.find((i) => i.skin === 'classic').price, 0);
    assert.ok(items.filter((i) => i.skin !== 'classic').every((i) => i.price > 0));
  }
  const w = newWallet();
  assert.equal(w.coins, 0);
  assert.ok(owns(w, 'sleeve-classic') && owns(w, 'pencil-classic'));
  assert.deepEqual(w.equipped, { sleeve: 'classic', pencil: 'classic' });
});

test('winning a match pays out with bonuses', () => {
  const r = matchCoins({ mode: 'cpu', difficulty: 'medium', won: true, roundsWon: 2, flawless: 1, rubberality: true, snapko: 1 });
  const by = Object.fromEntries(r.lines.map((l) => [l.label, l.coins]));
  assert.equal(by['Rounds won'], 20);
  assert.equal(by['Match win (medium)'], 50);
  assert.equal(by.Flawless, 20);
  assert.equal(by.Rubberality, 25);
  assert.equal(by['Snap KO'], 15);
  assert.equal(r.total, 130);
});

test('harder opponents pay more; losing still gives something', () => {
  const win = (d) => matchCoins({ mode: 'cpu', difficulty: d, won: true, roundsWon: 2 }).total;
  assert.ok(win('hard') > win('medium') && win('medium') > win('easy'));
  const lost = matchCoins({ mode: 'cpu', difficulty: 'hard', won: false, roundsWon: 1 });
  assert.ok(lost.total > 0 && lost.total < win('easy'));
});

test('tournament rungs pay more as you climb, and the champion gets a bonus', () => {
  const rung = (n, champion = false) => matchCoins({ mode: 'tournament', difficulty: 'easy', won: true, roundsWon: 2, rung: n, champion }).total;
  assert.ok(rung(3) > rung(0));
  assert.ok(rung(4, true) >= rung(4) + 300);
});

test('buying needs enough coins and only works once', () => {
  let w = newWallet();
  let r = buy(w, 'sleeve-galaxy');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'coins');
  w = { ...w, coins: 1000 };
  r = buy(w, 'sleeve-galaxy');
  assert.equal(r.ok, true);
  const price = SHOP.find((i) => i.id === 'sleeve-galaxy').price;
  assert.equal(r.wallet.coins, 1000 - price);
  assert.ok(owns(r.wallet, 'sleeve-galaxy'));
  assert.equal(buy(r.wallet, 'sleeve-galaxy').reason, 'owned');
  assert.equal(w.coins, 1000, 'original wallet untouched');
});

test('you can only wear what you own', () => {
  const w = newWallet();
  assert.equal(equip(w, 'sleeve-gold').ok, false);
  const bought = buy({ ...w, coins: 5000 }, 'sleeve-gold').wallet;
  const r = equip(bought, 'sleeve-gold');
  assert.equal(r.ok, true);
  assert.equal(r.wallet.equipped.sleeve, 'gold');
  assert.equal(equip(r.wallet, 'pencil-classic').wallet.equipped.pencil, 'classic');
});

test('every skin draws without errors', () => {
  const ctx = new Proxy({}, { get: (t, p) => (String(p).startsWith('create') ? () => ({ addColorStop() {} }) : p === 'measureText' ? () => ({ width: 10 }) : () => {}), set: () => true });
  for (const item of SHOP) {
    const skin = item.kind === 'sleeve' ? { sleeve: item.skin } : { pencil: item.skin };
    for (const e of ['apsara-nondust', 'nataraj-621', 'doms-cubo', 'fruit-scented', 'camlin-dustfree']) {
      drawEraserTop(ctx, e, 30, skin);
      drawEraserSide(ctx, e, 100, skin);
    }
    drawPencil(ctx, 'nataraj-hb', 0, 0, 200, 16, skin);
    drawLeadTop(ctx, 'faber-2b', 30, false, skin);
    drawTopSide(ctx, 'apsara-jumbo', 'doms-y1', 100, skin);
  }
});
