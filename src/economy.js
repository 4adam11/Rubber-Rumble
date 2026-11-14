// Pocket money and the Stationery Shop. Cosmetic only: every part stays free.
// Pure functions: wallets are copied, never changed in place.

export const SHOP = [
  { id: 'sleeve-classic', kind: 'sleeve', skin: 'classic', name: 'Classic', price: 0, desc: 'The sleeve it came with.' },
  { id: 'sleeve-galaxy', kind: 'sleeve', skin: 'galaxy', name: 'Galaxy', price: 150, desc: 'Deep space, with stars.' },
  { id: 'sleeve-tiger', kind: 'sleeve', skin: 'tiger', name: 'Tiger', price: 200, desc: 'Orange with bold black stripes.' },
  { id: 'sleeve-tricolour', kind: 'sleeve', skin: 'tricolour', name: 'Tiranga', price: 250, desc: 'Saffron, white and green.' },
  { id: 'sleeve-neon', kind: 'sleeve', skin: 'neon', name: 'Neon', price: 300, desc: 'Glows like a gaming keyboard.' },
  { id: 'sleeve-gold', kind: 'sleeve', skin: 'gold', name: 'Gold Foil', price: 450, desc: 'For champions only.' },
  { id: 'pencil-classic', kind: 'pencil', skin: 'classic', name: 'Classic', price: 0, desc: 'The paint it came with.' },
  { id: 'pencil-rainbow', kind: 'pencil', skin: 'rainbow', name: 'Rainbow', price: 120, desc: 'Every colour in the box.' },
  { id: 'pencil-camo', kind: 'pencil', skin: 'camo', name: 'Camo', price: 150, desc: 'Hide in the pencil cup.' },
  { id: 'pencil-gold', kind: 'pencil', skin: 'gold', name: 'Gold', price: 300, desc: 'Shiny, shiny, shiny.' },
];

export function newWallet() {
  return { coins: 0, owned: ['sleeve-classic', 'pencil-classic'], equipped: { sleeve: 'classic', pencil: 'classic' } };
}

export const owns = (w, id) => w.owned.includes(id);

const MATCH_WIN = { easy: 30, medium: 50, hard: 80 };

// What a finished match pays. lines are shown on the result screen.
export function matchCoins({ mode, difficulty = 'medium', won, roundsWon = 0, flawless = 0, rubberality = false, snapko = 0, rung = 0, champion = false }) {
  const lines = [];
  const add = (label, coins) => { if (coins > 0) lines.push({ label, coins }); };
  add('Rounds won', roundsWon * 10);
  if (won) {
    if (mode === 'tournament') add(`Rung ${rung + 1} beaten`, 60 + rung * 20);
    else if (mode === '2p') add('Match win', 20);
    else add(`Match win (${difficulty})`, MATCH_WIN[difficulty] ?? 50);
    if (champion) add('School Champion!', 300);
  } else {
    add('Good try', 5);
  }
  add('Flawless', flawless * 20);
  if (rubberality) add('Rubberality', 25);
  add('Snap KO', snapko * 15);
  return { lines, total: lines.reduce((s, l) => s + l.coins, 0) };
}

export function buy(wallet, id) {
  const item = SHOP.find((i) => i.id === id);
  if (!item) return { ok: false, reason: 'unknown', wallet };
  if (owns(wallet, id)) return { ok: false, reason: 'owned', wallet };
  if (wallet.coins < item.price) return { ok: false, reason: 'coins', wallet };
  return { ok: true, wallet: { ...wallet, coins: wallet.coins - item.price, owned: [...wallet.owned, id], equipped: { ...wallet.equipped } } };
}

export function equip(wallet, id) {
  const item = SHOP.find((i) => i.id === id);
  if (!item || !owns(wallet, id)) return { ok: false, wallet };
  return { ok: true, wallet: { ...wallet, owned: [...wallet.owned], equipped: { ...wallet.equipped, [item.kind]: item.skin } } };
}
