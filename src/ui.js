// DOM menus on notebook paper. Talks to main.js only through handlers.action().
import { ERASERS, LEADS, buildTop } from './parts.js';
import { drawEraserSide, drawPencil, drawTopSide } from './art.js';
import { ABILITIES, ABILITY_IDS } from './abilities.js';
import { ARENAS, ARENA_IDS } from './arenas.js';
import { paintArenaThumb } from './arena-art.js';
import { DEMOS, drawDemo } from './demos.js';
import { RUNGS, MODIFIERS } from './tournament.js';
import { SHOP, owns } from './economy.js';

const ARCH = { attack: 'Attack', defense: 'Defense', stamina: 'Stamina', balance: 'Balance', wildcard: 'Wildcard' };
const STATS = [['attack', 'Attack'], ['defense', 'Defense'], ['stamina', 'Stamina'], ['balance', 'Balance'], ['speed', 'Speed']];
const DIFF = [
  ['easy', 'Easy', 'Weak launches, slow to react. Good for learning the twist.'],
  ['medium', 'Medium', 'Solid launches, avoids silly combos.'],
  ['hard', 'Hard', 'Near-perfect launches and counter-picks your combo.'],
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Old/new value and change for each stat, so bars can animate instead of re-rendering.
export function statChanges(prev, next) {
  return STATS.map(([key]) => {
    const from = prev ? prev[key] : 0;
    return { key, from, to: next[key], delta: next[key] - from };
  });
}

// Small drawings of the parts for the picker, cached as images.
const thumbCache = new Map();
function thumb(key, w, h, draw) {
  if (thumbCache.has(key)) return thumbCache.get(key);
  const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  draw(g);
  const url = c.toDataURL();
  thumbCache.set(key, url);
  return url;
}
// big product shots for the pencil-box picker
const skinKey = (skin) => (skin ? `${skin.sleeve || ''}/${skin.pencil || ''}` : '');
const eraserThumb = (id, skin) => thumb(`e2:${id}:${skinKey(skin)}`, 150, 100, (g) => { g.translate(70, 54); drawEraserSide(g, id, 112, skin); });
// pencils stand upright in the cup, tip up
const pencilThumb = (id, skin) => thumb(`p2:${id}:${skinKey(skin)}`, 40, 210, (g) => { g.translate(20, 206); g.rotate(-Math.PI / 2); drawPencil(g, id, 0, 0, 200, 24, skin); });
const pencilFlat = (id, skin) => thumb(`pf:${id}:${skinKey(skin)}`, 170, 40, (g) => drawPencil(g, id, 4, 20, 160, 20, skin));
const SHORT_LEAD = {
  'nataraj-hb': 'Nataraj HB', 'apsara-platinum': 'Platinum', 'apsara-absolute': 'Absolute',
  'doms-y1': 'Doms Y1+', 'camlin-exam': 'Camlin Exam', 'faber-2b': 'Faber 2B',
};
const ARCH_ICON = { attack: '⚔', defense: '🛡', stamina: '⏳', balance: '⚖', wildcard: '🎲' };
const arenaThumb = (id) => thumb(`a:${id}`, 120, 120, (g) => paintArenaThumb(g, 120, id));


export const RESULT_GUARD_MS = 400;

const GUARDED = new Set(['round', 'match']);

export function createUI(root, handlers, opts = {}) {
  const now = opts.now || (() => performance.now());
  let current = null;
  let mountedAt = 0;
  let picker = null; // { player, eraserId, leadId }
  let choice = null; // ability / arena screen: { selected }

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    // a result screen pops up mid-battle: ignore a still-mashed Space/Enter or tap
    if (GUARDED.has(current) && now() - mountedAt < RESULT_GUARD_MS) return;
    const { action, value } = el.dataset;
    handlers.click?.();
    if (action === 'pick-eraser' || action === 'pick-lead') {
      updatePicker(action === 'pick-eraser' ? 'eraser' : 'lead', value);
      return;
    }
    if (action === 'ready') { handlers.action('ready', { eraserId: picker.eraserId, leadId: picker.leadId }); return; }
    if (action === 'pick-ability' || action === 'pick-arena') { select(value); return; }
    if (action === 'howto-mode') { howto({ mode: value }); return; }
    if (action === 'ability-ready' || action === 'arena-ready') { handlers.action(action, choice.selected); return; }
    handlers.action(action, value);
  });

  function mount(name, html, cls = '') {
    current = name;
    mountedAt = now();
    root.innerHTML = `<div class="screen screen-${name} ${cls}" role="dialog" aria-label="${esc(name)}">${html}</div>`;
    const focus = root.querySelector('[autofocus], .btn-primary');
    focus?.focus({ preventScroll: true });
  }

  function title(d) {
    mount('title', `
      <div class="sheet sheet-title">
        <img class="title-art" src="assets/icon.svg" alt="Rubber Rumble logo" width="120" height="120">
        <h1 class="logo">Rubber <span>Rumble</span></h1>
        <p class="tagline">Eraser top. Pencil-lead tip. One steel thali. Last one spinning wins.</p>
        <div class="stack">
          <button class="btn btn-primary" data-action="play-cpu">Play vs Computer</button>
          <button class="btn btn-tourney" data-action="tournament">🏆 School Tournament</button>
          <button class="btn btn-shop" data-action="shop">🛍 Stationery Shop <span class="coin-chip">🪙 ${d.coins ?? 0}</span></button>
          <button class="btn" data-action="play-2p">2 Players · same device</button>
          <button class="btn btn-ghost" data-action="howto">How to play</button>
        </div>
        <button class="sound-toggle" data-action="toggle-sound" aria-pressed="${!d.muted}">
          ${d.muted ? '🔇 Sound off' : '🔊 Sound on'}
        </button>
      </div>`, 'with-backdrop');
  }

  function difficulty() {
    mount('difficulty', `
      <div class="sheet">
        <h2>Pick your rival</h2>
        <div class="stack">
          ${DIFF.map(([id, name, desc]) => `
            <button class="btn btn-card" data-action="difficulty" data-value="${id}">
              <strong>${name}</strong><small>${desc}</small>
            </button>`).join('')}
        </div>
        <button class="btn btn-ghost" data-action="back">← Back</button>
      </div>`, 'with-backdrop');
  }

  // Option A stat gauges: a coloured pencil per stat, its length is the value.
  function statRows(card) {
    return STATS.map(([k, label]) => `
      <div class="pg-row" data-stat="${k}">
        <span>${label}</span>
        <div class="pg-track"><div class="pg-pencil" style="width:${card[k] * 10}%"><i class="pg-body"></i><i class="pg-tip"></i></div></div>
        <em>${card[k]}</em><sup class="delta"></sup>
      </div>`).join('');
  }

  function comboHtml(spec) {
    return spec.combo
      ? `<div class="sticky ${spec.combo.bad ? 'sticky-bad' : ''}"><strong>${spec.combo.bad ? '⚠ ' : '★ '}${esc(spec.combo.name)}</strong><span>${esc(spec.combo.desc)}</span></div>`
      : '<div class="sticky sticky-none"><span>No combo yet. Try matching brands!</span></div>';
  }

  function leadLabel(id) {
    const l = LEADS.find((x) => x.id === id);
    return `<b>${esc(l.name)}</b> · ${esc(l.note)}`;
  }

  // Built once; picking a part only updates what changed.
  function renderPicker() {
    const d = picker;
    const spec = buildTop(d.eraserId, d.leadId);
    d.card = spec.card;
    d.drop = { t0: now() };
    mount('picker', `
      <div class="sheet sheet-picker pbox" style="--pc:${d.color}">
        <header class="picker-head">
          <h2><span class="who" style="color:${d.color}">${esc(d.who)}</span> build your top</h2>
          ${d.note ? `<p class="note">${esc(d.note)}</p>` : ''}
        </header>
        <div class="pb-top">
          <div class="stage">
            <canvas class="stage-canvas" width="320" height="220" aria-hidden="true"></canvas>
            <div class="stage-name">${esc(spec.eraserName)} <span>+</span> ${esc(spec.leadName)}</div>
            <div class="combo-slot">${comboHtml(spec)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-title">Stats</div>
            <div class="pg">${statRows(spec.card)}</div>
          </div>
        </div>
        <div class="pb-trays">
          <section class="tray">
            <div class="tape">Erasers <small>the body</small></div>
            <div class="slots">
              ${ERASERS.map((e) => `
                <button class="slot ${e.id === d.eraserId ? 'is-on' : ''}" data-action="pick-eraser" data-value="${e.id}" aria-pressed="${e.id === d.eraserId}" title="${esc(e.note)}">
                  <img src="${eraserThumb(e.id, d.skin)}" alt="" width="150" height="100">
                  <span class="slot-name">${esc(e.name)}</span>
                  <span class="slot-type">${ARCH_ICON[e.archetype]} ${ARCH[e.archetype]}</span>
                </button>`).join('')}
            </div>
          </section>
          <section class="cup">
            <div class="tape">Pencil leads <small>the tip</small></div>
            <div class="cup-pencils">
              ${LEADS.map((l) => `
                <button class="cup-pencil ${l.id === d.leadId ? 'is-on' : ''}" data-action="pick-lead" data-value="${l.id}" aria-pressed="${l.id === d.leadId}" aria-label="${esc(l.name)}">
                  <img src="${pencilThumb(l.id, d.skin)}" alt="" width="40" height="210">
                  <span>${esc(SHORT_LEAD[l.id] || l.name)}</span>
                </button>`).join('')}
              <div class="cup-front" aria-hidden="true"></div>
            </div>
            <p class="lead-label">${leadLabel(d.leadId)}</p>
          </section>
        </div>
        <div class="row sticky-row">
          <button class="btn btn-ghost" data-action="back">← Back</button>
          <button class="btn btn-primary" data-action="ready">Ready!</button>
        </div>
      </div>`, 'with-backdrop');
    runStage();
  }

  // The spotlit stage: the top drops in on every change, then bobs and twirls.
  let stageLoop = 0;
  function runStage() {
    cancelAnimationFrame(stageLoop);
    const c = root.querySelector('.stage-canvas');
    if (!c || !c.getContext) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = 320 * dpr;
    c.height = 220 * dpr;
    const g = c.getContext('2d');
    const frame = () => {
      if (current !== 'picker') return;
      const d = picker;
      const t = (now() - d.drop.t0) / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, 320, 220);
      // spotlight on a little steel plate
      const spot = g.createRadialGradient(160, 168, 10, 160, 168, 150);
      spot.addColorStop(0, 'rgba(255,255,255,0.9)');
      spot.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = spot;
      g.fillRect(0, 0, 320, 220);
      const plate = g.createLinearGradient(80, 160, 240, 190);
      plate.addColorStop(0, '#f4f6f8'); plate.addColorStop(0.5, '#c3cad1'); plate.addColorStop(1, '#eef1f4');
      g.beginPath(); g.ellipse(160, 182, 112, 22, 0, 0, Math.PI * 2); g.fillStyle = '#9aa3ad'; g.fill();
      g.beginPath(); g.ellipse(160, 180, 104, 18, 0, 0, Math.PI * 2); g.fillStyle = plate; g.fill();
      // drop-in with a bounce, then idle bob + wobble
      const drop = t < 0.55 ? -90 * (1 - t / 0.55) ** 2 * Math.cos(t * 9) : 0;
      const bob = Math.sin(t * 2.4) * 3;
      g.save();
      g.translate(160, 62 + drop + bob);
      g.rotate(Math.sin(t * 3.1) * 0.05);
      drawTopSide(g, d.eraserId, d.leadId, 170, d.skin);
      g.restore();
      // spin lines round the lead tip
      g.strokeStyle = 'rgba(31,42,68,0.25)';
      g.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        const a0 = t * 5 + k * Math.PI;
        g.beginPath();
        g.ellipse(160, 172, 30 + k * 10, 6 + k * 2, 0, a0, a0 + 1.4);
        g.stroke();
      }
      if (t < 0.7 && t > 0.45) { // dust puff on landing
        const k = (t - 0.45) / 0.25;
        g.fillStyle = `rgba(160,140,110,${0.35 * (1 - k)})`;
        for (const sx of [-1, 1]) { g.beginPath(); g.arc(160 + sx * (24 + k * 30), 176 - k * 6, 6 + k * 6, 0, Math.PI * 2); g.fill(); }
      }
      stageLoop = requestAnimationFrame(frame);
    };
    frame();
  }

  // Swap one part: lift the new pick, drop the new top on the stage, grow/shrink the gauges.
  function updatePicker(kind, value) {
    const d = picker;
    if (kind === 'eraser') d.eraserId = value; else d.leadId = value;
    const spec = buildTop(d.eraserId, d.leadId);
    const changes = statChanges(d.card, spec.card);
    d.card = spec.card;
    d.drop = { t0: now() };

    root.querySelectorAll(`[data-action="pick-${kind}"]`).forEach((b) => {
      const on = b.dataset.value === value;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    root.querySelector('.stage-name').innerHTML = `${esc(spec.eraserName)} <span>+</span> ${esc(spec.leadName)}`;
    const ll = root.querySelector('.lead-label');
    if (ll) ll.innerHTML = leadLabel(d.leadId);

    const slot = root.querySelector('.combo-slot');
    const before = slot.textContent;
    slot.innerHTML = comboHtml(spec);
    if (slot.textContent !== before) restartAnim(slot.firstElementChild, 'pop');

    for (const ch of changes) {
      const row = root.querySelector(`.pg-row[data-stat="${ch.key}"]`);
      if (!row) continue;
      row.querySelector('.pg-pencil').style.width = `${ch.to * 10}%`;
      row.querySelector('em').textContent = ch.to;
      const badge = row.querySelector('.delta');
      if (ch.delta) {
        badge.textContent = ch.delta > 0 ? `+${ch.delta}` : `−${-ch.delta}`;
        badge.className = `delta ${ch.delta > 0 ? 'up' : 'down'}`;
        restartAnim(badge, 'show');
      }
    }
  }

  function restartAnim(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }

  // highlight a card in place (ability / arena screens)
  function select(value) {
    choice.selected = value;
    root.querySelectorAll('[data-action="pick-ability"], [data-action="pick-arena"]').forEach((el) => {
      const on = el.dataset.value === value;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', String(on));
      if (on) restartAnim(el, 'pop');
    });
  }

  function abilityScreen(d) {
    choice = { selected: d.selected };
    mount('ability', `
      <div class="sheet sheet-wide" style="--pc:${d.color}">
        <h2><span style="color:${d.color}">${esc(d.who)}</span> pick your comeback</h2>
        <p class="note">It unlocks when your health drops to 30%. Use it once to turn the fight around.</p>
        <div class="ability-grid">
          ${ABILITY_IDS.map((id) => {
            const a = ABILITIES[id];
            return `<button class="ability-card ${id === d.selected ? 'is-on' : ''}" data-action="pick-ability" data-value="${id}" aria-pressed="${id === d.selected}" style="--ac:${a.color}">
              <span class="ability-icon">${a.icon}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
            </button>`;
          }).join('')}
        </div>
        <div class="row sticky-row">
          <button class="btn btn-ghost" data-action="back">← Back</button>
          <button class="btn btn-primary" data-action="ability-ready">Lock it in!</button>
        </div>
      </div>`, 'with-backdrop');
  }

  function arenaScreen(d) {
    choice = { selected: d.selected };
    mount('arena', `
      <div class="sheet sheet-wide">
        <h2>Choose the arena</h2>
        <div class="arena-grid">
          ${ARENA_IDS.map((id) => {
            const a = ARENAS[id];
            return `<button class="arena-card ${id === d.selected ? 'is-on' : ''}" data-action="pick-arena" data-value="${id}" aria-pressed="${id === d.selected}">
              <img src="${arenaThumb(id)}" alt="" width="120" height="120">
              <span class="level level-${a.level.toLowerCase()}">${a.level}</span>
              <b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
            </button>`;
          }).join('')}
        </div>
        <div class="row sticky-row">
          <button class="btn btn-ghost" data-action="back">← Back</button>
          <button class="btn btn-primary" data-action="arena-ready">Fight!</button>
        </div>
      </div>`, 'with-backdrop');
  }

  // School Tournament ladder: the Principal at the top, the Class Bully at the bottom
  function ladder(d) {
    const p = d.progress || { rung: 0, champion: false };
    const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
    mount('ladder', `
      <div class="sheet sheet-ladder">
        <h2>🏆 School Tournament</h2>
        <p class="note">${p.champion ? 'You are the School Champion! Replay any rung.' : 'Beat all five to become School Champion. Your progress is saved.'}</p>
        <ol class="rungs">
          ${RUNGS.map((r, i) => ({ r, i })).reverse().map(({ r, i }) => {
            const beaten = p.champion || i < p.rung;
            const current = !p.champion && i === p.rung;
            const locked = !beaten && !current;
            const mod = r.modifier ? MODIFIERS[r.modifier] : null;
            const state = beaten ? 'beaten' : current ? 'current' : 'locked';
            return `<li class="rung rung-${state} ${r.boss ? 'rung-boss' : ''}">
              <img src="${eraserThumb(r.parts.eraserId)}" alt="" width="150" height="100">
              <div class="rung-text">
                <b>${i + 1}. ${esc(r.name)}</b>
                <small>${esc(r.title)} · ${DIFF_LABEL[r.difficulty]}</small>
                ${mod ? `<span class="rung-mod">${mod.icon} ${esc(mod.name)}</span>` : ''}
              </div>
              ${locked ? '<span class="rung-lock">🔒</span>'
                : `<button class="btn ${current ? 'btn-primary' : ''} rung-go" data-action="fight-rung" data-value="${i}">${current ? 'Fight!' : 'Replay'}</button>`}
              ${beaten ? '<span class="rung-stamp">BEATEN</span>' : ''}
            </li>`;
          }).join('')}
        </ol>
        <div class="row">
          <button class="btn btn-ghost" data-action="back">← Back</button>
        </div>
      </div>`, 'with-backdrop');
  }

  // Stationery Shop: buy and wear sleeves and pencil paints (looks only)
  function shop(d) {
    const w = d.wallet;
    const card = (item) => {
      const has = owns(w, item.id);
      const on = w.equipped[item.kind] === item.skin;
      const skin = item.kind === 'sleeve' ? { sleeve: item.skin } : { pencil: item.skin };
      const img = item.kind === 'sleeve'
        ? `<img src="${eraserThumb(d.eraserId, skin)}" alt="" width="150" height="100">`
        : `<img class="shop-pencil" src="${pencilFlat(d.leadId, skin)}" alt="" width="170" height="40">`;
      const btn = on ? '<span class="shop-on">✓ Wearing</span>'
        : has ? `<button class="btn" data-action="shop-equip" data-value="${item.id}">Wear</button>`
          : `<button class="btn ${w.coins >= item.price ? 'btn-primary' : 'btn-ghost'}" data-action="shop-buy" data-value="${item.id}" ${w.coins >= item.price ? '' : 'disabled'}>🪙 ${item.price}</button>`;
      return `<div class="shop-item ${on ? 'is-on' : ''}">${img}<b>${esc(item.name)}</b><small>${esc(item.desc)}</small>${btn}</div>`;
    };
    mount('shop', `
      <div class="sheet sheet-wide sheet-shop">
        <div class="shop-head">
          <h2>🛍 Stationery Shop</h2>
          <span class="coin-chip big">🪙 ${w.coins}</span>
        </div>
        <p class="note">Earn pocket money by winning. Skins are just for looks — every part stays free.${d.message ? ` <b class="shop-msg">${esc(d.message)}</b>` : ''}</p>
        <h3 class="shop-sec">Eraser sleeves</h3>
        <div class="shop-grid">${SHOP.filter((i) => i.kind === 'sleeve').map(card).join('')}</div>
        <h3 class="shop-sec">Pencil paints</h3>
        <div class="shop-grid">${SHOP.filter((i) => i.kind === 'pencil').map(card).join('')}</div>
        <div class="row sticky-row">
          <button class="btn btn-ghost" data-action="back">← Back</button>
        </div>
      </div>`, 'with-backdrop');
  }

  function introScreen() {
    mount('intro', `<button class="skip-area" data-action="skip-intro" aria-label="Skip intro"></button><span class="skip-intro">Tap to skip ›</span>`, 'intro');
  }

  function roundResult(d) {
    mount('round', `
      <div class="sheet sheet-small">
        <h2 style="color:${d.color}">${esc(d.headline)}</h2>
        <p class="sub">${esc(d.sub)}</p>
        <p class="score">${esc(d.names[0])} <b>${d.wins[0]}</b> – <b>${d.wins[1]}</b> ${esc(d.names[1])}</p>
        <div class="row">
          <button class="btn btn-ghost" data-action="change-parts">Change parts</button>
          <button class="btn btn-primary" data-action="next-round" autofocus>${d.draw ? 'Replay round' : 'Next round'}</button>
        </div>
      </div>`, 'bottom');
  }

  function matchResult(d) {
    mount('match', `
      <div class="sheet sheet-small">
        <p class="kicker">${esc(d.kicker || 'Match over')}</p>
        <h2 class="big" style="color:${d.color}">${esc(d.headline)}</h2>
        ${d.extra ? `<p class="sub extra">${esc(d.extra)}</p>` : ''}
        <p class="score">${esc(d.names[0])} <b>${d.wins[0]}</b> – <b>${d.wins[1]}</b> ${esc(d.names[1])}</p>
        <ul class="rounds">${d.rounds.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        ${d.coins ? `<div class="coins-earned"><b>🪙 +${d.coins.total} pocket money</b>${d.coins.lines.map((l) => `<span>${esc(l.label)} +${l.coins}</span>`).join('')}<small>You have ${d.coins.balance} coins</small></div>` : ''}
        <div class="stack">
          ${d.buttons ? d.buttons.map((b, k) => `<button class="btn ${b.primary ? 'btn-primary' : k === d.buttons.length - 1 ? 'btn-ghost' : ''}" data-action="${b.action}" ${b.primary ? 'autofocus' : ''}>${esc(b.label)}</button>`).join('') : `
          <button class="btn btn-primary" data-action="rematch" autofocus>Rematch</button>
          <button class="btn" data-action="change-parts">Change parts</button>
          <button class="btn btn-ghost" data-action="menu">Main menu</button>`}
        </div>
      </div>`, 'with-backdrop');
  }

  function pause() {
    mount('pause', `
      <div class="sheet sheet-small">
        <h2>Paused</h2>
        <div class="stack">
          <button class="btn btn-primary" data-action="resume" autofocus>Resume</button>
          <button class="btn btn-ghost" data-action="menu">Quit to menu</button>
        </div>
      </div>`, 'with-backdrop');
  }

  // How to play: one animated card per control, all with the same eraser top.
  let demoLoop = 0;
  function howto(d = {}) {
    const coarse = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } })();
    const mode = d.mode || (coarse ? 'touch' : 'keys');
    mount('howto', `
      <div class="sheet sheet-howto">
        <h2>How to play</h2>
        <div class="mode-toggle" role="tablist">
          <button class="${mode === 'keys' ? 'is-on' : ''}" data-action="howto-mode" data-value="keys" role="tab" aria-selected="${mode === 'keys'}">⌨ Keyboard</button>
          <button class="${mode === 'touch' ? 'is-on' : ''}" data-action="howto-mode" data-value="touch" role="tab" aria-selected="${mode === 'touch'}">👆 Touch</button>
        </div>
        <div class="demo-grid">
          ${DEMOS.map((dm) => `
            <figure class="demo-card">
              <canvas class="demo-canvas" data-demo="${dm.id}" width="260" height="170" aria-hidden="true"></canvas>
              <figcaption><b>${esc(dm.title)}</b><span>${esc(mode === 'touch' ? dm.touch : dm.text)}</span></figcaption>
            </figure>`).join('')}
        </div>
        <ul class="rules">
          <li><b>Build a top:</b> an eraser body + a pencil-lead tip. Matching brands unlock combos like <em>Deadly Duo</em>.</li>
          <li><b>Spin direction:</b> the way you first pull the grips (or your first key) sets it — ↻ or ↺. Opposite spins hit harder.</li>
          <li><b>Health is spin.</b> It drains over time and drops on every hit. A heavy hit <b>snaps your lead</b>; a second one crumbles your eraser.</li>
          <li><b>Points, first to 4:</b> Spin Finish 1 · Tip Finish 2 · Knock-Out 2 · <b>Snap KO 3</b>. Win without taking damage for a <em>Flawless</em>.</li>
          <li><b>Spin Clash:</b> when the tops grind together, mash your keys (or tap) faster than your rival to steal their spin.</li>
          <li><b>FINISH IT!</b> Win the match and enter the moves in time for a <em>Rubberality</em>.</li>
          <li><b>Arenas:</b> the Steel Thali is smooth; the Tiffin Lid has sticky dal stains; the Geometry Box has ink blots, shavings and a sharpener in the way.</li>
          <li><b>School Tournament:</b> beat five classmates, each with a twist, and then the Principal. <b>Stationery Shop:</b> spend your pocket money on sleeves and pencil paints.</li>
        </ul>
        <table class="keys">
          <thead><tr><th></th><th>Player 1</th><th>Player 2</th></tr></thead>
          <tbody>
            <tr><td>Place / twist</td><td><kbd>A</kbd> <kbd>D</kbd></td><td><kbd>←</kbd> <kbd>→</kbd></td></tr>
            <tr><td>Let go</td><td><kbd>W</kbd></td><td><kbd>↑</kbd></td></tr>
            <tr><td>Steer</td><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></td><td>Arrows</td></tr>
            <tr><td>Ability</td><td><kbd>Space</kbd></td><td><kbd>Enter</kbd></td></tr>
            <tr><td>Spin Clash</td><td>mash <kbd>A</kbd> <kbd>D</kbd></td><td>mash <kbd>←</kbd> <kbd>→</kbd></td></tr>
            <tr><td>FINISH IT!</td><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> + <kbd>Space</kbd></td><td>Arrows + <kbd>Enter</kbd></td></tr>
            <tr><td>Pause</td><td colspan="2"><kbd>Esc</kbd> or <kbd>P</kbd></td></tr>
          </tbody>
        </table>
        <div class="row sticky-row">
          <button class="btn btn-primary" data-action="back" autofocus>Got it</button>
        </div>
      </div>`, 'with-backdrop');
    runDemos(mode);
  }

  function runDemos(mode) {
    cancelAnimationFrame(demoLoop);
    const canvases = [...root.querySelectorAll('.demo-canvas')];
    const dpr = Math.min(2, devicePixelRatio || 1);
    for (const c of canvases) { c.width = 260 * dpr; c.height = 170 * dpr; }
    const t0 = now();
    const frame = () => {
      if (current !== 'howto') return;
      const t = (now() - t0) / 1000;
      for (const c of canvases) {
        const g = c.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawDemo(g, c.dataset.demo, 260, 170, t, mode);
      }
      demoLoop = requestAnimationFrame(frame);
    };
    frame();
  }

  function hud(d) {
    mount('hud', `<div class="hud-buttons">
      <button class="pause-btn" data-action="pause" aria-label="Pause">❚❚</button>
      <button class="pause-btn sound-btn ${d.muted ? 'is-muted' : ''}" data-action="toggle-sound-hud" aria-label="${d.muted ? 'Turn sound on' : 'Turn sound off'}" aria-pressed="${!d.muted}">${d.muted ? '🔇' : '🔊'}</button>
    </div>`, 'hud');
  }

  return {
    show(name, data = {}) {
      if (name === 'picker') { picker = { ...data }; renderPicker(); return; }
      ({ title, difficulty, round: roundResult, match: matchResult, pause, howto, hud, ability: abilityScreen, arena: arenaScreen, intro: introScreen, ladder, shop })[name](data);
    },
    hide() { current = null; root.innerHTML = ''; },
    get current() { return current; },
  };
}
