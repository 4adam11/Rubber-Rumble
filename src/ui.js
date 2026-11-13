// DOM menus on notebook paper. Talks to main.js only through handlers.action().
import { ERASERS, LEADS, buildTop } from './parts.js';
import { drawEraserSide, drawPencil, drawTopSide } from './art.js';
import { ABILITIES, ABILITY_IDS } from './abilities.js';
import { ARENAS, ARENA_IDS } from './arenas.js';
import { paintArenaThumb } from './arena-art.js';
import { DEMOS, drawDemo } from './demos.js';

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
const eraserThumb = (id) => thumb(`e:${id}`, 64, 40, (g) => { g.translate(32, 22); drawEraserSide(g, id, 46); });
const pencilThumb = (id) => thumb(`p:${id}`, 72, 20, (g) => drawPencil(g, id, 2, 10, 68, 10));
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

  function statRows(card) {
    return STATS.map(([k, label]) => {
      const v = card[k];
      const cells = Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('');
      return `<div class="stat" data-stat="${k}"><span>${label}</span><b>${cells}</b><em>${v}</em><sup class="delta"></sup></div>`;
    }).join('');
  }

  function comboHtml(spec) {
    return spec.combo
      ? `<div class="combo ${spec.combo.bad ? 'combo-bad' : ''}"><strong>${spec.combo.bad ? '⚠ ' : '★ '}${esc(spec.combo.name)}</strong><span>${esc(spec.combo.desc)}</span></div>`
      : '<div class="combo combo-none"><span>No combo bonus. Try matching brands!</span></div>';
  }

  // Built once; picking a part only updates what changed.
  function renderPicker() {
    const d = picker;
    const spec = buildTop(d.eraserId, d.leadId);
    d.card = spec.card;
    mount('picker', `
      <div class="sheet sheet-picker" style="--pc:${d.color}">
        <header class="picker-head">
          <h2><span class="who" style="color:${d.color}">${esc(d.who)}</span> build your top</h2>
          ${d.note ? `<p class="note">${esc(d.note)}</p>` : ''}
        </header>
        <div class="picker-body">
          <section class="parts">
            <h3>Eraser <small>the body</small></h3>
            <div class="chips">
              ${ERASERS.map((e) => `
                <button class="chip ${e.id === d.eraserId ? 'is-on' : ''}" data-action="pick-eraser" data-value="${e.id}" aria-pressed="${e.id === d.eraserId}">
                  <img class="part-img" src="${eraserThumb(e.id)}" alt=""><span class="chip-text"><b>${esc(e.name)}</b><small>${ARCH[e.archetype]} · ${esc(e.note)}</small></span>
                </button>`).join('')}
            </div>
            <h3>Pencil lead <small>the tip</small></h3>
            <div class="chips">
              ${LEADS.map((l) => `
                <button class="chip ${l.id === d.leadId ? 'is-on' : ''}" data-action="pick-lead" data-value="${l.id}" aria-pressed="${l.id === d.leadId}">
                  <img class="part-img part-img-pencil" src="${pencilThumb(l.id)}" alt=""><span class="chip-text"><b>${esc(l.name)}</b><small>${esc(l.note)}</small></span>
                </button>`).join('')}
            </div>
          </section>
          <aside class="card">
            <div class="card-top">
              <canvas class="preview" width="150" height="110" aria-hidden="true"></canvas>
              <div class="card-title">${esc(spec.eraserName)} <span>+</span> ${esc(spec.leadName)}</div>
            </div>
            <div class="combo-slot">${comboHtml(spec)}</div>
            <div class="stats">${statRows(spec.card)}</div>
            <div class="row">
              <button class="btn btn-ghost" data-action="back">← Back</button>
              <button class="btn btn-primary" data-action="ready">Ready!</button>
            </div>
          </aside>
        </div>
      </div>`, 'with-backdrop');
    drawPreview(spec);
  }

  function drawPreview(spec) {
    const c = root.querySelector('.preview');
    if (!c || !c.getContext) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = 150 * dpr;
    c.height = 110 * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.translate(75, 40);
    drawTopSide(g, spec.eraserId, spec.leadId, 108);
  }

  // Swap one part: move the highlight, refill the bars, pop the combo.
  function updatePicker(kind, value) {
    const d = picker;
    if (kind === 'eraser') d.eraserId = value; else d.leadId = value;
    const spec = buildTop(d.eraserId, d.leadId);
    const changes = statChanges(d.card, spec.card);
    d.card = spec.card;

    root.querySelectorAll(`[data-action="pick-${kind}"]`).forEach((b) => {
      const on = b.dataset.value === value;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    root.querySelector('.card-title').innerHTML = `${esc(spec.eraserName)} <span>+</span> ${esc(spec.leadName)}`;

    const slot = root.querySelector('.combo-slot');
    const before = slot.textContent;
    slot.innerHTML = comboHtml(spec);
    if (slot.textContent !== before) restartAnim(slot.firstElementChild, 'pop');

    for (const ch of changes) {
      const row = root.querySelector(`.stat[data-stat="${ch.key}"]`);
      if (!row) continue;
      row.querySelectorAll('i').forEach((cell, i) => {
        // fill upward one cell after another, empty downward
        const delay = ch.delta > 0 ? (i - ch.from) * 45 : (ch.from - 1 - i) * 45;
        cell.style.transitionDelay = `${Math.max(0, delay)}ms`;
        cell.classList.toggle('on', i < ch.to);
      });
      row.querySelector('em').textContent = ch.to;
      const badge = row.querySelector('.delta');
      if (ch.delta) {
        badge.textContent = ch.delta > 0 ? `+${ch.delta}` : `−${-ch.delta}`;
        badge.className = `delta ${ch.delta > 0 ? 'up' : 'down'}`;
        restartAnim(badge, 'show');
      }
    }
    drawPreview(spec);
    restartAnim(root.querySelector('.preview'), 'bounce');
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
        <p class="kicker">Match over</p>
        <h2 class="big" style="color:${d.color}">${esc(d.headline)}</h2>
        <p class="score">${esc(d.names[0])} <b>${d.wins[0]}</b> – <b>${d.wins[1]}</b> ${esc(d.names[1])}</p>
        <ul class="rounds">${d.rounds.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        <div class="stack">
          <button class="btn btn-primary" data-action="rematch" autofocus>Rematch</button>
          <button class="btn" data-action="change-parts">Change parts</button>
          <button class="btn btn-ghost" data-action="menu">Main menu</button>
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
          <li><b>Health is spin.</b> It drains over time and drops on every hit. Heavy hits can <b>snap your lead</b>.</li>
          <li>You lose a round when your health runs out, you <b>tip over</b>, or you get <b>knocked out</b>. Best of 3.</li>
          <li><b>Arenas:</b> the Steel Thali is smooth; the Tiffin Lid has sticky dal stains; the Geometry Box has ink blots, shavings and a sharpener in the way.</li>
        </ul>
        <table class="keys">
          <thead><tr><th></th><th>Player 1</th><th>Player 2</th></tr></thead>
          <tbody>
            <tr><td>Place / twist</td><td><kbd>A</kbd> <kbd>D</kbd></td><td><kbd>←</kbd> <kbd>→</kbd></td></tr>
            <tr><td>Let go</td><td><kbd>W</kbd></td><td><kbd>↑</kbd></td></tr>
            <tr><td>Steer</td><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></td><td>Arrows</td></tr>
            <tr><td>Ability</td><td><kbd>Space</kbd></td><td><kbd>Enter</kbd></td></tr>
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
    mount('hud', `<button class="pause-btn" data-action="pause" aria-label="Pause">❚❚</button>`, 'hud');
  }

  return {
    show(name, data = {}) {
      if (name === 'picker') { picker = { ...data }; renderPicker(); return; }
      ({ title, difficulty, round: roundResult, match: matchResult, pause, howto, hud, ability: abilityScreen, arena: arenaScreen, intro: introScreen })[name](data);
    },
    hide() { current = null; root.innerHTML = ''; },
    get current() { return current; },
  };
}
