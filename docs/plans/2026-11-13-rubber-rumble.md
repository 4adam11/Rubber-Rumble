# Rubber Rumble Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser game where eraser + pencil-lead tops battle in a steel thali, vs Computer or 2 players on one device, on phone and laptop.

**Architecture:** Pure-logic ES modules (`parts`, `physics`, `launch`, `ai`, `match`) with no DOM, tested by `node:test`; thin DOM/canvas modules (`input`, `render`, `ui`, `audio`) wired by `main.js`. Physics runs in arena units (thali radius = 1) at a fixed 120 Hz step; rendering maps arena units to screen.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Canvas 2D, WebAudio. Node 22 `node:test` for tests. Python `http.server` for local serving. No libraries.

**Spec:** `rubber-rumble/docs/specs/2026-11-13-rubber-rumble-design.md` — read it alongside this plan; the tables of part stats, combos, specials, controls and CPU difficulty are copied from there, not repeated here.

## Global Constraints

- No external JS libraries, no build step; only external resource allowed is Google Fonts ("Kalam" + one sans).
- No "Beyblade" anywhere in names, copy, or code. Brand names appear only as plain text part names; no logos.
- All parts available from the start (no unlocks).
- Modes: vs Computer (Easy/Medium/Hard) and 2 players on one device. No online play.
- Works at 360 px wide and up, portrait and landscape; 16 px gutters; no horizontal page scroll.
- Physics fixed step `DT = 1/120` s; arena radius `R = 1`; round time limit 60 s; best of 3.
- `localStorage` access always inside try/catch; game works without it.
- Respect `prefers-reduced-motion` (fewer sparks, no screen shake).
- All paths below are relative to `rubber-rumble/`. Run tests from `rubber-rumble/` with `npm test` (= `node --test`).

## Review Focus

1. **Huge frame gaps (tab switch, slow phone)** — tops must not pass through each other or the rim; `simulate` caps elapsed time at 0.25 s and always subdivides into `DT` steps. Test in Task 2.
2. **Holding a key / sending `special: true` every frame** — a special fires once per round; a held twist key adds no strokes. Tests in Tasks 3 and 4.
3. **Two tops spawned or pushed to the exact same point** — collision must not produce NaN; push apart along an arbitrary axis. Test in Task 3.
4. **Both tops end in the same step, or a draw** — draw round is replayed and never counts toward best of 3. Tests in Tasks 2 and 8.
5. **2P touch: finger crosses the midline, or a third finger lands** — a touch stays with the player whose half it started on; touches beyond two per player are ignored. Test in Task 7.

---

### Task 1: Project scaffold + parts and combos

**Files:**
- Create: `package.json`, `.gitignore`, `src/parts.js`, `tests/parts.test.js`
- Modify: `../.claude/launch.json` (add configuration)

**Interfaces:**
- Produces:
  - `ERASERS: Eraser[]` — `{id, name, mass, size, attack, defense, stamina, archetype: 'attack'|'defense'|'stamina'|'balance'|'wildcard', shape: 'rect'|'cube'|'pill', color: string}`
  - `LEADS: Lead[]` — `{id, name, stability, glide, speed, durability}`
  - `COMBOS: Combo[]` — `{id, name, desc, bad: boolean, erasers: string[]|'family', leads: string[]|'family', mods: {attack?, defense?, stamina?, stability?, glide?, speed?, durability?, baseWobble?}}`, in spec precedence order
  - `buildTop(eraserId, leadId) → TopSpec`:
    `{eraserId, leadId, eraserName, leadName, archetype, shape, color, mass, radius, attack, defense, stamina, stability, glide, speed, durability, baseWobble, maxRPM, combo: {id, name, desc, bad}|null, card: {attack, defense, stamina, balance, speed}, special: 'dash'|'plant'|'secondWind'|'recentre'|'wild'}`
  - `SPECIAL_BY_ARCHETYPE = {attack:'dash', defense:'plant', stamina:'secondWind', balance:'recentre', wildcard:'wild'}`

- [ ] **Step 1: Scaffold.** `package.json` = `{"name":"rubber-rumble","private":true,"type":"module","scripts":{"test":"node --test"}}`. `.gitignore` = `node_modules/`. Run `git init` inside `rubber-rumble/`. Add to `.claude/launch.json` configurations: `{"name":"rubber-rumble","runtimeExecutable":"python","runtimeArgs":["-m","http.server","5182","--directory","rubber-rumble"],"port":5182}`.

- [ ] **Step 2: Write failing tests** in `tests/parts.test.js`:
  - `every eraser×lead pair builds valid stats` — for all 42 pairs, `attack, defense, stamina, stability, glide, speed, durability` and every `card.*` are integers in 1..10; `maxRPM > 0`; `radius > 0`; `baseWobble >= 0`.
  - `deadly duo` — `buildTop('apsara-nondust','nataraj-hb').combo.id === 'deadly-duo'`, its `attack === 8`, `stability === 8`; same combo for `apsara-jumbo`.
  - `deadly duo beats family precedence` — Apsara eraser + `nataraj-hb` gets `deadly-duo`, not `hindustan-family`; `nataraj-621` + `apsara-platinum` gets `hindustan-family` (stamina 6, durability 5).
  - `doms double cancels cube wobble` — `buildTop('doms-cubo','doms-y1').baseWobble === 0`; `buildTop('doms-cubo','nataraj-hb').baseWobble === 2`.
  - `each named combo only on its parts` — for every pair, `combo` is null unless the pair matches that combo's rule (check via a table of the 7 expected pairs/rules).
  - `sleepy bench is bad` — `buildTop('apsara-jumbo','faber-2b').combo.bad === true`; all other combos `bad === false`.
  - `card formulas` — for `camlin-dustfree`+`doms-y1` (no combo): `card.stamina === round((8+9)/2) === 9`, `card.balance === round((6*2-0)/2) === 6`, `card.speed === round((5*2-5+5)/2) === 5`.
  - `maxRPM formula` — `buildTop('nataraj-621','nataraj-hb').maxRPM` ≈ `1000*(1.15-3*0.03)` = 1060.
  - `special mapping` — `doms-cubo`→`'dash'`, `apsara-jumbo`→`'plant'`, `fruit-scented`→`'wild'`.
  - `unknown id throws` — `buildTop('nope','nataraj-hb')` throws.

- [ ] **Step 3: Run** `npm test` — Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/parts.js`.** Stats/combos from spec §3. Apply combo mods then clamp 1..10 (`baseWobble` floored at 0, not clamped to 1). `radius = 0.07 + size*0.008`. `maxRPM = 1000*(1.15 - mass*0.03)`. "family" = id starts with `apsara-` or `nataraj-`. Base wobble: `doms-cubo` 2, `fruit-scented` 1, else 0. Colours: Apsara Non-Dust `#f4f1ea`, Jumbo `#e9e4f5`, Nataraj 621 `#ffffff` with red band, Doms Cubo `#3b82c4`, Camlin `#f2d36b`, Faber `#9ccf8e`, Fruit `#ff8fb1`. Shapes: `doms-cubo` cube, `fruit-scented` pill, others rect.

- [ ] **Step 5: Run** `npm test` — Expected: all parts tests PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: parts, combos and stat building"`

---

### Task 2: Physics core — movement, bowl, spin drain, wobble, round end

**Files:**
- Create: `src/physics.js`, `tests/physics.test.js`

**Interfaces:**
- Consumes: `TopSpec` from Task 1.
- Produces:
  - `CONST = {DT: 1/120, R: 1, BOWL_K: 1.2, DAMPING: 0.6, BASE_DRAIN: 40, WOBBLE_RATE: 0.25, WOBBLE_RECOVER: 0.05, DRIFT: 0.5, STEER_COST: 0.02, RESTITUTION: 0.8, HIT_DAMAGE: 80, HIT_WOBBLE: 0.08, SNAP_BASE: 0.25, TIME_LIMIT: 60, MAX_ELAPSED: 0.25}` (starting values; tune in Task 9 only)
  - `LaunchResult = {x, y, rpm, wobble, perfect}` (arena units)
  - `createWorld(specs: [TopSpec, TopSpec], launches: [LaunchResult, LaunchResult], rng = Math.random) → World`
  - `World = {tops: [TopState, TopState], time, events: Event[], over: boolean, result: RoundResult|null, rng}`
  - `TopState = {spec, x, y, vx, vy, rpm, wobble, angle, leadSnapped, specialKind, specialUsed, specialUntil, dashArmed, planted}` (`specialKind` resolves `'wild'` via `rng` at creation)
  - `Intent = {steer: {x, y}, special: boolean}` (steer length ≤ 1, arena directions)
  - `step(world, intents: [Intent, Intent])` — one `DT` step, mutates world
  - `simulate(world, elapsed, intents) → number` — runs `floor(min(elapsed, MAX_ELAPSED)/DT)` steps, returns leftover time
  - `RoundResult = {winner: 0|1|null, reason: 'stopped'|'tipped'|'ringout'|'time'|'draw'}`
  - `Event` = `{type:'hit', x, y, impact}` | `{type:'snap', i}` | `{type:'special', i, kind}` | `{type:'end', result}` — `world.events` is cleared by the caller after reading.

- [ ] **Step 1: Write failing tests** (use a seeded rng helper `seq(0.5)` that always returns 0.5 so drift is zero):
  - `lone top drifts toward centre` — top A at (0.6,0) rpm max, B parked far away at (-0.6, 0); after 1 s of steps with zero intent, A's distance from centre < 0.6.
  - `spin drains and round ends stopped` — both tops far apart, A rpm 50, B rpm max; simulate until `world.over`; `result` is `{winner:1, reason:'stopped'}`.
  - `low spin raises wobble until tip` — A rpm at 30 % of max, wobble 0.9; within 2 s `result.reason === 'tipped'` (or 'stopped'), and A's wobble rose before the end.
  - `ring-out` — A at (0.98,0) with vx = 3; after a few steps `result` is `{winner:1, reason:'ringout'}`.
  - `higher stamina outlasts` — `camlin-dustfree+camlin-exam` vs `nataraj-621+apsara-platinum`, same rpm 800, wobble 0, placed far apart with no steering; the Camlin top's rpm is higher after 10 s.
  - `steering costs spin` — two identical worlds; one steers A at full strength for 2 s; that A has lower rpm than the other.
  - `simultaneous end → higher rpm wins; equal → draw` — set both rpm so both hit ≤ 0 in the same step with A's pre-step rpm higher → winner 0; equal values → `{winner:null, reason:'draw'}`.
  - `time limit` — set `world.time = 59.99`, rpms 500 vs 400 → after a step `{winner:0, reason:'time'}`.
  - `simulate caps big gaps` — `simulate(world, 5, intents)` advances `world.time` by at most 0.25 s (+DT).
  - `no tunnelling on big gap` — A at (-0.3,0) vx +4, B at (0.3,0) vx -4; `simulate(world, 1, …)`; at least one `hit` event emitted and A.x < B.x.

- [ ] **Step 2: Run** `npm test` — Expected: physics tests FAIL.

- [ ] **Step 3: Implement** `createWorld`, `step` (movement part), `simulate` in `src/physics.js`. Per step for each top, in order:
  1. accel = `-BOWL_K × position`;
  2. steer: if not planted, accel += `steer × (0.4 + 0.12 × card.speed)`; rpm −= `STEER_COST × maxRPM × |steer| × DT`;
  3. drift: tangential accel `DRIFT × (1 − stability/10) × (1 + 0.25 × baseWobble) × (rng()*2 − 1)`;
  4. integrate velocity (semi-implicit Euler), damping `v *= exp(-DAMPING × DT)`, integrate position;
  5. spin drain `BASE_DRAIN × (1.3 − stamina/10) × (1 + wobble) × (1.1 − mass×0.02) × DT`;
  6. wobble: if rpm < 0.35×maxRPM, `+= WOBBLE_RATE × (1 − stability/12) × (1 + 0.25×baseWobble) × DT`; if rpm > 0.5×maxRPM, `−= WOBBLE_RECOVER × stability/10 × DT` (floor 0);
  7. `angle += rpm × DT × 0.02` (visual only).
  Then collisions (stub call for Task 3), then end check: for each top, lost if `rpm ≤ 0` ('stopped'), `wobble ≥ 1` ('tipped'), `hypot(x,y) > R + radius` ('ringout'). One loser → other wins with loser's reason. Both → compare pre-step rpm (store at step start); higher wins, reason of the loser; equal → draw. Else if `time ≥ TIME_LIMIT` → higher rpm wins 'time', equal → draw. On end set `over`, `result`, push `end` event; `step` on an over world is a no-op. Clamp rpm ≥ 0.

- [ ] **Step 4: Run** `npm test` — Expected: PASS (the tunnelling test may need Task 3; mark it `todo` until then if so, and un-todo in Task 3).

- [ ] **Step 5: Commit** — `git commit -am "feat: physics core"` (add new files first).

---

### Task 3: Physics — collisions, lead snap, specials

**Files:**
- Modify: `src/physics.js`
- Test: `tests/physics.test.js`

**Interfaces:**
- Consumes/Produces: same as Task 2 (no new exports); collisions run inside `step`.

- [ ] **Step 1: Write failing tests:**
  - `collision conserves momentum and costs both spin` — head-on A/B (equal specs), measure `m_A v_A + m_B v_B` before/after first hit within 1e-6 × scale (bowl force off: set `CONST.BOWL_K` override via a `world.k` field or pass `opts` — use `createWorld(..., rng, {bowlK: 0})`); both rpm dropped beyond normal drain.
  - `heavier attack deals more damage` — `nataraj-621` (atk 8) vs `apsara-jumbo` (def 9) hit vs `doms-cubo` (atk 9, ×1.15) vs same target: cube's victim loses more rpm.
  - `lead snap only above threshold and only once` — impact just below `SNAP_BASE × durability` → no snap; well above → exactly one `snap` event, rpm −25 %, wobble +0.3, `leadSnapped`; a second large hit → no second snap event.
  - `same-point overlap is safe` — both tops at (0,0); one step; all positions/velocities finite and tops separated.
  - `special fires once per round` — send `special: true` every step for 3 s; exactly one `special` event for that top; `specialUsed === true`.
  - `second wind` — stamina top at 20 % rpm, wobble 0.5 → after special, rpm += 0.15×maxRPM (capped at maxRPM), wobble 0.3.
  - `recentre` — balance top wobble 0.7, moving → wobble 0, speed reduced.
  - `plant` — defense top planted: steering has no effect for 2 s, collision mass ×3, damage taken ×0.5; after 2 s back to normal.
  - `dash` — attack top: 0.35 s burst toward opponent; next hit damage to the opponent ×1.5 vs an identical non-dash hit.
  - `wild resolves to a real special` — `fruit-scented` top's `specialKind` ∈ the four kinds and is deterministic for a fixed rng.
  - Un-todo the tunnelling test from Task 2.

- [ ] **Step 2: Run** `npm test` — Expected: new tests FAIL.

- [ ] **Step 3: Implement.** Add optional 4th param `opts = {bowlK}` to `createWorld`. Collision: if `d < rA + rB`, normal `n` (if `d < 1e-9` use `(1,0)`), separate by overlap split by inverse mass; relative normal speed `impact = max(0, (vA − vB)·n)`… apply impulse `j = (1+RESTITUTION) × impact / (1/mA + 1/mB)` with effective mass (`×3` if planted). Damage to X = `impact × HIT_DAMAGE × oppAttack/ownDefense` × 1.15 if opponent is `doms-cubo` × 1.5 if opponent `dashArmed` (then disarm) × 0.5 if X planted. Wobble += `impact × HIT_WOBBLE × (1 − stability/12)`. Snap if `impact > SNAP_BASE × durability` and not snapped. Push `hit` event at contact point. Only resolve when tops are approaching (impact > 0) to avoid repeated hits. Specials per spec §5 table; `special` intent is ignored when `specialUsed`. Dash: for 0.35 s add accel 4.0 toward opponent; `dashArmed` until next hit or 1.5 s.

- [ ] **Step 4: Run** `npm test` — Expected: all PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: collisions, lead snap, specials"`

---

### Task 4: Launch — twist state machine and stroke detectors

**Files:**
- Create: `src/launch.js`, `tests/launch.test.js`

**Interfaces:**
- Consumes: `TopSpec`.
- Produces:
  - `LAUNCH = {PLACE_TIME: 1.5, TWIST_TIME: 2.5, RING_PERIOD: 0.8, PERFECT_RING: 0.15, STROKES_TO_MAX: 22, START_RADIUS: 0.8, SLIDE_RANGE: Math.PI/3}`
  - `createLaunch(spec, side: 0|1) → LaunchState` — `{spec, side, phase: 'place'|'twist'|'done', t, rimAngle, rpm, lastKey, result: LaunchResult|null}`; home angle `side 0 → Math.PI`, `side 1 → 0`.
  - `slide(state, dir: -1|0|1, dt)` — only in 'place'; moves `rimAngle` at 1.5 rad/s, clamped to home ± `SLIDE_RANGE`.
  - `setPlace(state, angle)` — touch/mouse drag; same clamp.
  - `addStroke(state, strength)` — only in 'twist'; `rpm += maxRPM/22 × strength × (rpm > 0.8×maxRPM ? 0.5 : 1)`, capped at `maxRPM`.
  - `keyStroke(state, key: 'L'|'R')` — adds a stroke of strength 1 only if `key !== lastKey`.
  - `ringSize(state) → 0..1` — `(1 − cos(2π × twistT / RING_PERIOD)) / 2`, where twistT = time since twist began.
  - `release(state)` — only in 'twist'; sets `phase='done'` and `result = {x, y, rpm, wobble, perfect}`; position `START_RADIUS × (cos, sin)(rimAngle)`; perfect if ring ≤ 0.15 → wobble 0, rpm ×1.05; else wobble `0.1 + 0.3 × ring`.
  - `updateLaunch(state, dt)` — advances `t`; 'place' → 'twist' at PLACE_TIME; at PLACE_TIME+TWIST_TIME auto-release with ring forced to 0.5 (wobble 0.25, not perfect).
  - `createPairStrokeDetector() → {update(y1, y2, t) → strength}` — tracks `gap = y1 − y2`; when gap moved ≥ 30 px from the last stroke anchor in the opposite sign direction to the previous stroke, returns `clamp(speedPxPerSec/1200, 0.5, 1.5)`; else 0.
  - `createCircleStrokeDetector() → {update(angle, t) → strength}` — accumulates unwrapped angle change; every π rad returns 1.

- [ ] **Step 1: Write failing tests:**
  - `phases advance on time` — after 1.5 s phase 'twist'; after 4.0 s 'done' with `result.wobble === 0.25` and `perfect === false`.
  - `alternating keys add strokes, repeats do not` — L,R,L → rpm = 3 strokes worth; L,L,L → 1 stroke worth.
  - `22 strokes ≈ fill with diminishing returns` — 22 full strokes → rpm < maxRPM; 40 strokes → rpm === maxRPM.
  - `strokes ignored outside twist` — keyStroke during 'place' changes nothing.
  - `perfect release` — release at twistT = 0 (ring 0) → `perfect`, wobble 0, rpm = pre × 1.05; release at twistT = 0.4 (ring 1) → wobble 0.4.
  - `slide clamps` — slide +1 for 10 s → `rimAngle === home + SLIDE_RANGE` (side 1: home 0).
  - `pair detector` — gap sequence 0 → +35 → −5 → +35 at 0.05 s intervals yields strokes on the 2nd and 3rd moves (sign alternates), none for small jitters (< 30 px).
  - `circle detector` — angle swept 0 → 2π in small steps (crossing the −π/π wrap) yields exactly 2 strokes.

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement `src/launch.js`.**

- [ ] **Step 4: Run** `npm test` — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: twist launch"` (after `git add`).

---

### Task 5: Computer opponent

**Files:**
- Create: `src/ai.js`, `tests/ai.test.js`

**Interfaces:**
- Consumes: `ERASERS, LEADS, COMBOS, buildTop` (Task 1); `World, Intent, LaunchResult` (Task 2); `LAUNCH` (Task 4).
- Produces:
  - `DIFFICULTY = {easy: {rpm: 0.60, spread: 0.10, perfect: 0.10, reaction: 0.5}, medium: {rpm: 0.80, spread: 0.08, perfect: 0.35, reaction: 0.25}, hard: {rpm: 0.92, spread: 0.05, perfect: 0.65, reaction: 0.1}}`
  - `pickCombo(difficulty, opponentSpec: TopSpec|null, rng) → {eraserId, leadId}` — easy: any pair; medium: any pair whose combo isn't `bad`; hard: counter-pick per spec §7 (vs attack → a defense eraser, vs defense → stamina, vs stamina → attack, vs balance/wildcard → Deadly Duo), lead chosen as the highest-`stability` lead that avoids a bad combo.
  - `cpuLaunch(spec, difficulty, side, rng) → LaunchResult` — rpm = `maxRPM × clamp(rpm ± spread, 0.3, 1)`; perfect with probability `perfect` (wobble 0, rpm ×1.05) else wobble `0.1 + 0.3 × rng()`; position like `release` at home angle.
  - `createCpu(difficulty, index: 0|1, rng) → {think(world, dt) → Intent}` — re-decides every `reaction` s, holds intent between.

- [ ] **Step 1: Write failing tests:**
  - `easy/medium/hard launch ranges` — 500 samples each: mean rpm fraction within ±0.03 of 0.60/0.80/0.92 (adjusting for the ×1.05 perfect bonus), never above `1.05 × maxRPM`.
  - `medium never picks a bad combo` — 500 picks, none `bad`.
  - `hard counter-picks` — vs `nataraj-621+nataraj-hb` (attack) → picked eraser archetype 'defense'; vs `camlin-dustfree+camlin-exam` (stamina) → 'attack'.
  - `cpu steers away from the rim` — CPU top at (0.9, 0), opponent at (-0.5, 0), CPU behind on rpm → intent steer has negative x.
  - `cpu chases when ahead` — CPU attack top ahead on rpm, opponent at (+0.4, 0), CPU at (−0.2, 0) → steer x > 0.
  - `cpu uses second wind when low` — stamina CPU at 25 % rpm → `special: true` within one reaction period.
  - `intent is always valid` — over a 30 s simulated CPU-vs-CPU match, every steer has finite components and length ≤ 1.

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement `src/ai.js`.** Behaviour per spec §7: if dist from centre > 0.75 → steer toward centre (overrides others); else if ahead on rpm and own attack ≥ opp defense → steer at opponent; else orbit: steer tangent at radius ≈ 0.35. Special triggers per spec §7 (attack: opponent within 0.4; defense: opponent closing speed > 0.8 within 0.5; stamina: rpm < 30 %; balance: wobble > 0.6).

- [ ] **Step 4: Run** `npm test` — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: computer opponent"` (after `git add`).

---

### Task 6: Page shell, renderer, playable battle loop

**Files:**
- Create: `index.html`, `src/render.js`, `src/main.js`, `tests/render.test.js`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces:
  - `computeLayout(width, height) → {rotate: boolean, scale, cx, cy}` — pure. `rotate = height > width` (portrait: arena rotated 90° so player 0 is at the bottom, player 1 top). `scale` = pixels per arena unit so the thali (radius 1.08 incl. rim) fits with 16 px gutter and leaves HUD space (60 px top + bottom in portrait, 0 in landscape where HUD sits at sides).
  - `arenaToScreen(layout, x, y) → {x, y}` and `screenToArenaVec(layout, dx, dy) → {x, y}` — pure, inverse rotations of each other.
  - `createRenderer(canvas) → {resize(), layout, drawBattle(world, hud), drawLaunch(launchStates), spawnFromEvents(events)}` — `hud = {names: [string,string], roundWins: [n,n], specialsReady: [bool,bool], specialNames: [string,string], labels?: {perfect?: [bool,bool]}}` — `specialNames` shows the resolved special (so a Wildcard's rolled special is visible, spec §5).

- [ ] **Step 1: Write failing tests** in `tests/render.test.js`:
  - `layout fits` — for (375,812), (812,375), (1440,900), (360,640): thali diameter `2×1.08×scale` ≤ min available dimension − 32; `rotate` true only for portrait.
  - `transform round-trip` — `screenToArenaVec` of the screen delta between `arenaToScreen(0,0)` and `arenaToScreen(0.3,−0.2)` equals (0.3, −0.2) within 1e-9, for both rotate values.

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement `computeLayout`, transforms and drawing in `src/render.js`.** Drawing per spec §8: wood-grain desk (procedural stripes, cached to an offscreen canvas on resize), steel thali (radial gradient + rim highlight), tops (rounded rect / cube / pill in eraser colour, rotated by `angle`, wobble = offset orbit of radius `wobble × radius × 0.5`, blur ring when rpm > 60 % max, dark lead dot at centre), pencil-shaving sparks (short curly strokes, lifetime 0.4 s, count ∝ impact, ×0.3 under reduced motion), HUD bars (rpm, wobble, special pip, round pips). Canvas sized to `devicePixelRatio`.

- [ ] **Step 4: Implement `index.html` + minimal `src/main.js`:** full-viewport canvas, `<div id="screens">` overlay (empty for now), fonts. `main.js` starts a vs-CPU round immediately with `apsara-nondust+nataraj-hb` vs Medium CPU `cpuLaunch` for both sides, fixed-step loop via `requestAnimationFrame` + `simulate`, restarts the round 2 s after `end`. Player 0 steered by temporary WASD handler.

- [ ] **Step 5: Run** `npm test` — Expected: PASS. Then verify in the browser: `preview_start {name: "rubber-rumble"}`; no console errors; tops spin, clash, sparks show, a round ends and restarts; screenshot at desktop and at `mobile` preset (portrait rotation correct, nothing clipped).

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: renderer and playable battle loop"`

---

### Task 7: Unified input + launch phase in game

**Files:**
- Create: `src/input.js`, `tests/input.test.js`
- Modify: `src/main.js` (replace temporary WASD handler)

**Interfaces:**
- Consumes: `createPairStrokeDetector`, `createCircleStrokeDetector`, `slide`, `setPlace`, `keyStroke`, `addStroke`, `release` (Task 4); `computeLayout`, `screenToArenaVec` (Task 6).
- Produces:
  - `playerForPoint(x, y, width, height, players: 1|2) → 0|1` — pure. 1 player → 0. 2 players: landscape → left half 0, right half 1; portrait → bottom half 0, top half 1.
  - `createTouchTracker() → {down(id, x, y, player), move(id, x, y), up(id), touchesFor(player) → Array<{id, x, y, startX, startY}>}` — pure; a touch keeps its starting player; `down` ignored if that player already has 2 touches.
  - `createInput(target, getLayout, opts: {players: 1|2}) → {setPhase('launch'|'battle'|'menu'), poll(player, dt) → PlayerInput, destroy()}`
  - `PlayerInput = {slide: -1|0|1, placeAngle: number|null, strokes: number[], release: boolean, steer: {x, y}, special: boolean}` — `strokes`, `release`, `special` are edge events consumed by `poll`; `steer` in arena units (converted via `screenToArenaVec`).
  - Keys per spec §6: P0 `A`/`D` slide+twist, `W` release, `WASD` steer, `Space` special; P1 arrows, `↑` release, `Enter` special. With `players: 1`, arrows also control P0.
  - Touch: launch — one touch drag sets `placeAngle` (in 'place'), two touches feed the pair detector, lifting all touches releases; battle — first touch is a joystick (vector from start, full at 60 px), on-screen special button region (bottom corner of own side, 64 px circle) sets `special`.
  - Mouse (1 player only): launch — drag sets place, circular drag feeds circle detector, mouseup releases; battle — drag steers, right-click = special.

- [ ] **Step 1: Write failing tests:**
  - `playerForPoint` — (100,400) in 812×375 landscape, 2P → 0; (700,100) → 1; portrait 375×812: (100,700) → 0, (100,100) → 1; any point with 1P → 0.
  - `touch keeps its player across midline` — down on left half as player 0, move to right half → `touchesFor(0)` still includes it, `touchesFor(1)` empty.
  - `third touch ignored` — three `down`s for player 0 → `touchesFor(0).length === 2`.

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement `src/input.js`.** `keydown` with `e.repeat` ignored for stroke/release/special edges; `preventDefault` on game keys and on touch events (canvas has `touch-action: none`).

- [ ] **Step 4: Wire launch into `main.js`:** round = launch phase (both `LaunchState`s, CPU uses `cpuLaunch` result shown with a simulated meter) → `createWorld` with both results → battle. `drawLaunch` shows rim position marker, RPM meter, pulsing wobble ring, countdown, "PERFECT!" text.

- [ ] **Step 5: Run** `npm test` — Expected: PASS. Browser: keyboard launch (alternate A/D fills meter, W releases, perfect shows), steer with WASD, Space special; `mobile` preset — use `javascript_tool` to dispatch synthetic two-finger TouchEvents to confirm strokes register; no console errors.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: unified input and twist launch phase"`

---

### Task 8: Menus, match flow, settings, audio

**Files:**
- Create: `src/ui.js`, `src/match.js`, `src/audio.js`, `src/settings.js`, `tests/match.test.js`
- Modify: `src/main.js`, `index.html` (screen CSS)

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `createMatch() → {record(result: RoundResult) → MatchState, state() → MatchState}`; `MatchState = {wins: [n, n], rounds: RoundResult[], over: boolean, winner: 0|1|null}` — draws are stored in `rounds` but don't add wins; `over` when a side reaches 2 wins.
  - `loadSettings() → {muted: boolean, lastParts: [{eraserId, leadId}, {eraserId, leadId}]}` / `saveSettings(s)` — key `rubber-rumble:v1`, try/catch, defaults `muted:false`, both `apsara-nondust`/`nataraj-hb`.
  - `createAudio() → {unlock(), setMuted(b), hum(i, rpmFrac), clack(impact), snap(), win(), lose()}` — WebAudio oscillators/noise only; all no-ops before `unlock()` or if AudioContext unavailable.
  - `createUI(root, handlers) → {show(name, data), hide()}` — screens: `title` (Play vs Computer / 2 Players / mute toggle / how-to), `difficulty`, `picker` (data `{player, current, opponentName?}`; eraser list + lead list + live stat card from `buildTop(...).card`, combo badge with name/desc, special name; Ready button), `roundResult` (who won, how: "stopped", "tipped over", "knocked out of the thali", "time", "draw — replay"; buttons Next Round / Change Parts), `matchResult` (Rematch / Change Parts / Menu), `pause` (Resume / Quit). Notebook-paper styling per spec §8.

- [ ] **Step 1: Write failing tests** in `tests/match.test.js`:
  - `best of three` — wins 0, 1, 0 → `over`, winner 0, `wins = [2,1]`.
  - `draws are replayed` — draw, draw, 1, 1 → `over`, winner 1, `rounds.length === 4`, `wins = [0,2]`.
  - `record after over is ignored` — extra result after `over` doesn't change `wins`.

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement `match.js`, `settings.js`, `audio.js`, `ui.js`.** Flow in `main.js`: title → (vs CPU → difficulty) → picker P0 → (2P: picker P1 | CPU: `pickCombo`, Hard re-picks between rounds vs player's current combo) → launch → battle → roundResult → … → matchResult. Escape / pause button and `visibilitychange` (hidden) → pause. Audio `unlock()` on first pointer/key. Save `lastParts` on Ready, `muted` on toggle.

- [ ] **Step 4: Run** `npm test` — Expected: PASS. Browser: complete a vs-CPU match on Easy via keyboard; complete a 2P match; picker shows "Deadly Duo" badge for Apsara Non-Dust + Nataraj 621 HB; reload keeps last parts and mute; hide tab mid-battle → paused on return; no console errors.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: menus, match flow, settings, audio"`

---

### Task 9: Tuning, responsive polish, full play-test

**Files:**
- Modify: `src/physics.js` (CONST values only), `src/render.js`, `index.html`, `src/ui.js` as needed
- Create: `README.md` (how to run, controls, parts/combos table)

- [ ] **Step 1: Balance pass with a headless script** `tools/balance.mjs` (create): runs 200 CPU(medium)-vs-CPU(medium) rounds for a sample of 12 combo matchups; prints average round length and win rate per combo. Targets: mean round length 15–40 s; no combo pair wins > 80 % vs another of a non-"bad" combo; Deadly Duo wins ≥ 55 % vs average; `sleepy-bench` loses more than it wins. Adjust only `CONST` values or the spec's derived-formula coefficients noted in Tasks 2–3; re-run `npm test` after each change (tests must stay green).

- [ ] **Step 2: Responsive pass** — browser at 360×640, 375×812, 812×375, 768×1024, 1440×900: no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), menus readable, 16 px gutters, touch targets ≥ 44 px, special buttons not overlapping the thali.

- [ ] **Step 3: Full play-test** — vs CPU on Easy, Medium and Hard (one full match each), one 2P keyboard match, one touch-emulated launch at mobile preset; check `prefers-reduced-motion` (emulate via CSS media check) reduces sparks; console clean. Screenshot title, picker, launch and battle.

- [ ] **Step 4: Run** `npm test` — Expected: all PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "chore: balance, responsive polish, readme"`
