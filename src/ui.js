// DOM menus on notebook paper. Talks to main.js only through handlers.action().
import { ERASERS, LEADS, buildTop, SPECIAL_NAMES } from './parts.js';

const ARCH = { attack: 'Attack', defense: 'Defense', stamina: 'Stamina', balance: 'Balance', wildcard: 'Wildcard' };
const SPECIAL_DESC = {
  dash: 'Charge at your rival. Your next hit does 1.5× damage.',
  plant: 'Dig in for 2 s: 3× heavier and takes half damage.',
  secondWind: 'Win back 15% spin and steady the wobble.',
  recentre: 'Kill the wobble and slide back toward the middle.',
  wild: 'A random special, rolled fresh every round.',
};
const STATS = [['attack', 'Attack'], ['defense', 'Defense'], ['stamina', 'Stamina'], ['balance', 'Balance'], ['speed', 'Speed']];
const DIFF = [
  ['easy', 'Easy', 'Weak launches, slow to react. Good for learning the twist.'],
  ['medium', 'Medium', 'Solid launches, avoids silly combos.'],
  ['hard', 'Hard', 'Near-perfect launches and counter-picks your combo.'],
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function swatch(e) {
  const band = e.band ? `<i style="background:${e.band}"></i>` : '';
  return `<span class="swatch swatch-${e.shape}" style="--c:${e.color}">${band}</span>`;
}

const DOODLE = `
<svg class="doodle" viewBox="0 0 160 120" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 70 q50 -18 100 0" opacity=".35"/>
    <path d="M22 80 q58 -26 116 0" opacity=".2"/>
    <rect x="48" y="28" width="64" height="40" rx="9" fill="#f4f1ea"/>
    <rect x="66" y="28" width="16" height="40" fill="#d6342c" stroke="none"/>
    <rect x="48" y="28" width="64" height="40" rx="9"/>
    <path d="M80 68 L80 92" stroke-width="5"/>
    <path d="M76 92 L80 104 L84 92 Z" fill="currentColor"/>
    <path d="M20 46 q-8 10 2 20 M140 46 q8 10 -2 20" opacity=".6"/>
    <path d="M12 40 q-10 16 4 30 M148 40 q10 16 -4 30" opacity=".35"/>
  </g>
</svg>`;

export const RESULT_GUARD_MS = 400;

const GUARDED = new Set(['round', 'match']);

export function createUI(root, handlers, opts = {}) {
  const now = opts.now || (() => performance.now());
  let current = null;
  let mountedAt = 0;
  let picker = null; // { player, eraserId, leadId }

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    // a result screen pops up mid-battle: ignore a still-mashed Space/Enter or tap
    if (GUARDED.has(current) && now() - mountedAt < RESULT_GUARD_MS) return;
    const { action, value } = el.dataset;
    handlers.click?.();
    if (action === 'pick-eraser' || action === 'pick-lead') {
      if (action === 'pick-eraser') picker.eraserId = value; else picker.leadId = value;
      renderPicker();
      return;
    }
    if (action === 'ready') { handlers.action('ready', { eraserId: picker.eraserId, leadId: picker.leadId }); return; }
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
        <div class="title-art">${DOODLE}</div>
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

  function statBars(spec, color) {
    return STATS.map(([k, label]) => {
      const v = spec.card[k];
      const cells = Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('');
      return `<div class="stat"><span>${label}</span><b style="--pc:${color}">${cells}</b><em>${v}</em></div>`;
    }).join('');
  }

  function renderPicker() {
    const d = picker;
    const spec = buildTop(d.eraserId, d.leadId);
    const combo = spec.combo
      ? `<div class="combo ${spec.combo.bad ? 'combo-bad' : ''}"><strong>${spec.combo.bad ? '⚠ ' : '★ '}${esc(spec.combo.name)}</strong><span>${esc(spec.combo.desc)}</span></div>`
      : '<div class="combo combo-none"><span>No combo bonus. Try matching brands!</span></div>';
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
                  ${swatch(e)}<span class="chip-text"><b>${esc(e.name)}</b><small>${ARCH[e.archetype]} · ${esc(e.note)}</small></span>
                </button>`).join('')}
            </div>
            <h3>Pencil lead <small>the tip</small></h3>
            <div class="chips">
              ${LEADS.map((l) => `
                <button class="chip ${l.id === d.leadId ? 'is-on' : ''}" data-action="pick-lead" data-value="${l.id}" aria-pressed="${l.id === d.leadId}">
                  <span class="lead-tip"></span><span class="chip-text"><b>${esc(l.name)}</b><small>${esc(l.note)}</small></span>
                </button>`).join('')}
            </div>
          </section>
          <aside class="card">
            <div class="card-title">${esc(spec.eraserName)} <span>+</span> ${esc(spec.leadName)}</div>
            ${combo}
            <div class="stats">${statBars(spec, d.color)}</div>
            <div class="special"><strong>Special: ${SPECIAL_NAMES[spec.special]}</strong><span>${SPECIAL_DESC[spec.special]}</span></div>
            <div class="row">
              <button class="btn btn-ghost" data-action="back">← Back</button>
              <button class="btn btn-primary" data-action="ready">Ready!</button>
            </div>
          </aside>
        </div>
      </div>`, 'with-backdrop scrolls');
    const scroller = root.querySelector('.screen');
    if (d.scroll) scroller.scrollTop = d.scroll;
    scroller.addEventListener('scroll', () => { d.scroll = scroller.scrollTop; }, { passive: true });
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

  function howto() {
    mount('howto', `
      <div class="sheet sheet-howto">
        <h2>How to play</h2>
        <ol class="rules">
          <li><b>Build a top.</b> Pick an eraser (the body) and a pencil lead (the tip). Matching brands unlock combos like <em>Deadly Duo</em> (Apsara eraser + Nataraj HB).</li>
          <li><b>Place it.</b> Slide your top along your side of the thali rim.</li>
          <li><b>Twist!</b> Like doing it with two thumbs: flick two fingers past each other, again and again. On a keyboard, mash your two keys one after the other.</li>
          <li><b>Let go</b> when the ring around your top is tight for a <em>Perfect Release</em>, with no wobble and extra spin.</li>
          <li><b>Battle.</b> Nudge your top around (it costs a little spin) and fire your special once per round.</li>
          <li>A top loses when it <b>stops</b>, <b>tips over</b> or gets <b>knocked out</b>. Best of 3 wins. Hard hits can <b>snap the lead</b>!</li>
        </ol>
        <table class="keys">
          <thead><tr><th></th><th>Player 1</th><th>Player 2</th></tr></thead>
          <tbody>
            <tr><td>Place / twist</td><td><kbd>A</kbd> <kbd>D</kbd></td><td><kbd>←</kbd> <kbd>→</kbd></td></tr>
            <tr><td>Let go</td><td><kbd>W</kbd></td><td><kbd>↑</kbd></td></tr>
            <tr><td>Steer</td><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></td><td>Arrows</td></tr>
            <tr><td>Special</td><td><kbd>Space</kbd></td><td><kbd>Enter</kbd></td></tr>
            <tr><td>Pause</td><td colspan="2"><kbd>Esc</kbd> or <kbd>P</kbd></td></tr>
          </tbody>
        </table>
        <p class="note">Touch: drag to place, flick two thumbs to twist, lift to let go. In battle, drag anywhere on your side to steer and tap ★ for your special. With a mouse vs the computer: drag to place, circle around your top to twist, release the button to let go.</p>
        <button class="btn btn-primary" data-action="back" autofocus>Got it</button>
      </div>`, 'with-backdrop scrolls');
  }

  function hud(d) {
    mount('hud', `<button class="pause-btn" data-action="pause" aria-label="Pause">❚❚</button>`, 'hud');
  }

  return {
    show(name, data = {}) {
      if (name === 'picker') { picker = { ...data, scroll: 0 }; renderPicker(); return; }
      ({ title, difficulty, round: roundResult, match: matchResult, pause, howto, hud })[name](data);
    },
    hide() { current = null; root.innerHTML = ''; },
    get current() { return current; },
  };
}
