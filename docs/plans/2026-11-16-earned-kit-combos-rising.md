# Earned Kit, 42 Combos and Rising Difficulty (Stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solo players win parts, abilities and combos by beating School Tournament opponents; every eraser + lead pair has a combo; the computer gets a 7-level Rising difficulty; friends (2+ humans) keep everything.

**Architecture:** The solo kit is *derived* from the tournament progress the game already saves, in a new pure module `src/kit.js`; no unlock state is stored. Combos stay inside `buildTop`, so "you own both parts" is all it takes for a combo to be on. Rising is a pure level machine (`src/rising.js`) plus a `profile()` lookup in `src/ai.js` that accepts a named difficulty or a level number. `main.js` and `ui.js` only wire and draw.

**Tech Stack:** Plain ES modules, Canvas 2D, `node --test` (no libraries). Run tests with `npm test`.

**Spec:** `docs/specs/2026-11-16-progression-and-cloud-save-design.md` (Parts 1–4; Part 5, cloud save, is Stage 2 and not in this plan).

## Global Constraints

- No part, ability or combo is ever bought: coins stay cosmetic-only.
- Full kit whenever 2+ humans play (same-device 2P, or an online room with 2+ human seats); earned kit otherwise (vs Computer, Tournament, a room with one human).
- Starting kit: erasers `apsara-nondust`, `doms-cubo`; leads `nataraj-hb`, `doms-y1`; abilities `recentre`, `secondWind`.
- Beating rung *i* adds `RUNGS[i].parts.eraserId`, `RUNGS[i].parts.leadId` and `RUNGS[i].ability`.
- The 13 existing good combos and Sleepy Bench keep their exact mods. The 28 standard combos are exactly one stat +1 and one stat −1, with the names in the spec's table.
- Rising: 7 levels; 1 = Easy, 4 = Medium, 7 = Hard; starts at 2; +1 after two match wins in a row, −1 after two losses in a row; coins 30, 40, 45, 55, 65, 70, 80.
- Same-device 2P pays no coins; an online match pays only if 2+ humans started it.
- A 2-top fight with today's parts must behave exactly as before wherever a combo did not change (run `node tools/fingerprint2.mjs` only if `physics.js` is touched; this plan does not touch it).
- Commit only when the owner asks; work on branch `earned-kit`.

## Review Focus

1. A remembered top or ability that is no longer in the solo kit (every existing player) must fall back to a starting-kit choice: never crash, never slip through. *(Task 2, Task 6)*
2. Hard counter-pick when the kit has no eraser of the wanted archetype (the starting kit has no defense or stamina eraser) must still return a valid in-kit pair and must not loop forever. *(Task 4)*
3. Corrupted saved Rising data (level 99, `NaN`, missing) must clamp to 1–7. *(Task 3)*
4. A School Champion has `rung: 4, champion: true`: that is five rungs beaten, not four; replaying an old rung must not change the kit. *(Task 2)*
5. Online: the last friend leaves after the creator picked a full-kit top; pressing Start with one human must send the creator back to pick, not start. *(Task 7)*

---

### Task 1: A combo for every pair

**Files:**
- Modify: `src/parts.js` (COMBOS, `buildTop`)
- Create: `tools/pairs.mjs`, `tools/baseline-pairs.json`
- Test: `tests/parts.test.js`

**Interfaces:**
- Produces: every `COMBOS` entry has `star: boolean`; `buildTop(...).combo` is never `null` and is `{ id, name, desc, bad, star }`. `tools/pairs.mjs [rounds] [seed]` prints JSON `{ "<eraserId>+<leadId>": winRate }` (medium vs medium, all arenas, every pair against every other pair).

- [ ] **Step 1: Record today's balance before changing anything**

Write `tools/pairs.mjs` reusing the round loop of `tools/balance.mjs` (seeded `mulberry32`, medium CPUs). Run: `node tools/pairs.mjs 40 1 > tools/baseline-pairs.json`
Expected: a JSON object with 42 keys, values between 0 and 1.

- [ ] **Step 2: Write the failing tests**

```js
test('every eraser + lead pair has a combo', () => {
  for (const e of ERASERS) for (const l of LEADS) assert.ok(buildTop(e.id, l.id).combo, `${e.id}+${l.id}`);
});
test('13 star combos, 1 bad combo, 28 standard combos', () => {
  const all = ERASERS.flatMap((e) => LEADS.map((l) => buildTop(e.id, l.id).combo));
  assert.equal(all.filter((c) => c.star).length, 13);
  assert.equal(all.filter((c) => c.bad).length, 1);
  assert.equal(all.filter((c) => !c.star && !c.bad).length, 28);
});
test('a standard combo is exactly one stat up and one stat down', () => {
  for (const c of COMBOS.filter((x) => !x.star && !x.bad)) {
    const v = Object.values(c.mods).sort();
    assert.deepEqual(v, [-1, 1], c.id);
    assert.equal(c.erasers.length, 1); assert.equal(c.leads.length, 1);
  }
});
test('the old combos are untouched', () => {
  assert.deepEqual(findCombo('apsara-nondust', 'nataraj-hb').mods, { attack: 2, stability: 1 });
  assert.equal(findCombo('apsara-jumbo', 'faber-2b').id, 'sleepy-bench');
  assert.equal(findCombo('nataraj-621', 'apsara-absolute').id, 'hindustan-family');
  assert.equal(findCombo('doms-cubo', 'nataraj-hb').name, 'Sharp Corners');
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `node --test tests/parts.test.js` — Expected: FAIL, "every eraser + lead pair has a combo" at `apsara-nondust+doms-y1`.

- [ ] **Step 4: Implement**

Add `star: true` to the 7 existing good entries, `star: false` to Sleepy Bench. Append the 28 standard combos from the spec's table after `hindustan-family` (`id` = kebab-case of the name, `desc` like `Glide +1, Attack −1`, `bad: false, star: false`, `mods` keys from `attack defense stamina stability glide speed durability`). Add `star` to the combo object `buildTop` returns. Fix any existing test that expected "no combo".

- [ ] **Step 5: Run to verify they pass**

Run: `npm test` — Expected: all pass.

---

### Task 2: The earned kit

**Files:**
- Create: `src/kit.js`
- Modify: `src/settings.js`
- Test: `tests/kit.test.js`, `tests/settings.test.js` (create if missing)

**Interfaces:**
- Consumes: `RUNGS` from `src/tournament.js`; `ERASERS`, `LEADS` from `src/parts.js`; `ABILITY_IDS` from `src/abilities.js`.
- Produces (`src/kit.js`):
  - `STARTER: { erasers: string[], leads: string[], abilities: string[] }`
  - `FULL_KIT: { erasers, leads, abilities }` (everything)
  - `rungsBeaten(progress: {rung, champion}): number` (0–5)
  - `earnedKit(progress): { erasers: string[], leads: string[], abilities: string[] }`
  - `kitFor({ mode: 'cpu'|'tournament'|'2p'|'friends', humans?: number, progress }): kit`
  - `inKit(kit, parts: {eraserId, leadId}, ability?: string): boolean`
  - `fitParts(kit, parts): {eraserId, leadId}` and `fitAbility(kit, ability): string` (unchanged if allowed, else the kit's first)
  - `holderOf(kind: 'eraser'|'lead'|'ability', id): string | null` (the rung name that holds it, e.g. `'The Topper'`)
  - `rewardFor(rungIndex, progressBefore): { erasers: string[], leads: string[], abilities: string[], combos: number }` (names of what a first win adds; all empty and 0 on a replay)
  - `humansIn(room): number` (seats whose `kind !== 'cpu'`)
  - `creatorMustRepick(room, progress): boolean` (one human, and seat 0's parts or ability are outside `earnedKit(progress)`)
- Produces (`src/settings.js`): `settings.kitNote: boolean` (true once for a save made before this version), `settings.kitVersion: 1`.

- [ ] **Step 1: Write the failing tests**

```js
const P = (rung, champion = false) => ({ rung, champion });
test('a new player has the starting kit: 4 tops', () => {
  const k = earnedKit(P(0));
  assert.deepEqual(k, { erasers: ['apsara-nondust', 'doms-cubo'], leads: ['nataraj-hb', 'doms-y1'], abilities: ['recentre', 'secondWind'] });
});
test('each rung beaten adds that opponent\'s kit', () => {
  const sizes = [0, 1, 2, 3, 4].map((r) => earnedKit(P(r))).map((k) => k.erasers.length * k.leads.length);
  assert.deepEqual(sizes, [4, 9, 12, 20, 30]);
  assert.deepEqual(earnedKit(P(1)).abilities, ['recentre', 'secondWind', 'dash']);
});
test('a champion has beaten five rungs and owns everything', () => {
  assert.equal(rungsBeaten(P(4, true)), 5);
  const k = earnedKit(P(4, true));
  assert.equal(k.erasers.length * k.leads.length, 42);
  assert.equal(k.abilities.length, 6);
});
test('friends and same-device 2P get the full kit; one human alone does not', () => {
  assert.equal(kitFor({ mode: '2p', progress: P(0) }).erasers.length, 7);
  assert.equal(kitFor({ mode: 'friends', humans: 2, progress: P(0) }).erasers.length, 7);
  assert.equal(kitFor({ mode: 'friends', humans: 1, progress: P(0) }).erasers.length, 2);
  assert.equal(kitFor({ mode: 'cpu', progress: P(0) }).erasers.length, 2);
});
test('a remembered top outside the kit falls back to a starting top', () => {
  const k = earnedKit(P(0));
  assert.deepEqual(fitParts(k, { eraserId: 'apsara-jumbo', leadId: 'faber-2b' }), { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' });
  assert.deepEqual(fitParts(k, { eraserId: 'doms-cubo', leadId: 'doms-y1' }), { eraserId: 'doms-cubo', leadId: 'doms-y1' });
  assert.equal(fitAbility(k, 'plant'), 'recentre');
  assert.equal(inKit(k, { eraserId: 'doms-cubo', leadId: 'nataraj-hb' }, 'secondWind'), true);
  assert.equal(inKit(k, { eraserId: 'doms-cubo', leadId: 'nataraj-hb' }, 'dash'), false);
});
test('locked parts name who holds them, and a win lists what it adds', () => {
  assert.equal(holderOf('eraser', 'faber-dustfree'), 'The Topper');
  assert.equal(holderOf('eraser', 'apsara-nondust'), null);
  const r = rewardFor(3, P(3));
  assert.deepEqual([r.erasers.length, r.leads.length, r.abilities.length, r.combos], [1, 1, 1, 10]);
  assert.equal(rewardFor(1, P(1)).leads.length, 0);          // Doms Y1+ is already in the starting kit
  assert.equal(rewardFor(0, P(3)).combos, 0);               // replaying an old rung adds nothing
});
test('a room with one human and a full-kit top must re-pick', () => {
  const seat = (kind, parts, ability) => ({ kind, parts, ability, ready: true });
  const jumbo = { eraserId: 'apsara-jumbo', leadId: 'faber-2b' };
  assert.equal(creatorMustRepick({ seats: [seat('host', jumbo, 'plant'), seat('cpu', jumbo, 'plant')] }, P(0)), true);
  assert.equal(creatorMustRepick({ seats: [seat('host', jumbo, 'plant'), seat('guest', jumbo, 'plant')] }, P(0)), false);
});
```

Settings tests: a save without `kitVersion` loads with `kitNote: true`; no save at all loads with `kitNote: false`; both have `kitVersion: 1`.

- [ ] **Step 2: Run to verify they fail** — `node --test tests/kit.test.js` — Expected: FAIL, cannot find module `../src/kit.js`.
- [ ] **Step 3: Implement `src/kit.js` and the two settings fields** (kit arrays keep the order starter-first, then rung order).
- [ ] **Step 4: Run to verify they pass** — `npm test` — Expected: all pass.

---

### Task 3: Rising difficulty (logic)

**Files:**
- Create: `src/rising.js`
- Modify: `src/ai.js`, `src/economy.js`, `src/settings.js`
- Test: `tests/rising.test.js`, `tests/ai.test.js`, `tests/economy.test.js`

**Interfaces:**
- Produces (`src/rising.js`): `RISING = { MIN: 1, MAX: 7, START: 2 }`; `newRising(): { level: 2, streak: 0 }`; `cleanRising(raw): { level, streak }` (clamps, repairs); `afterMatch(rising, won: boolean): { level, streak, moved: -1 | 0 | 1 }`.
- Produces (`src/ai.js`): `profile(difficulty: 'easy'|'medium'|'hard'|number): { rpm, spread, perfect, reaction, mash, smarts: 'easy'|'medium'|'hard' }`. `cpuLaunch`, `createCpu`, `pickCombo`, `pickAbility` accept a level number wherever they accept a name.
- Produces (`src/economy.js`): `matchCoins` accepts `difficulty` as a level number (30, 40, 45, 55, 65, 70, 80) and a new `humans` field; `mode: '2p'` pays nothing; `mode: 'friends'` pays the old 2P table only when `humans >= 2`.
- Produces (`src/settings.js`): `settings.rising`, loaded through `cleanRising`.

- [ ] **Step 1: Write the failing tests**

```js
test('two wins in a row go up a level, two losses go down, mixed results stay', () => {
  let r = newRising();                                   // level 2
  r = afterMatch(r, true); assert.equal(r.level, 2); assert.equal(r.moved, 0);
  r = afterMatch(r, true); assert.equal(r.level, 3); assert.equal(r.moved, 1); assert.equal(r.streak, 0);
  r = afterMatch(r, true); r = afterMatch(r, false); r = afterMatch(r, true); assert.equal(r.level, 3);
  r = afterMatch(afterMatch(r, false), false); assert.equal(r.level, 2); assert.equal(r.moved, -1);
});
test('the level never leaves 1 to 7, and bad saved data is repaired', () => {
  let r = { level: 7, streak: 1 }; r = afterMatch(r, true); assert.equal(r.level, 7);
  r = { level: 1, streak: -1 }; r = afterMatch(r, false); assert.equal(r.level, 1);
  assert.deepEqual(cleanRising({ level: 99, streak: 'x' }), { level: 7, streak: 0 });
  assert.deepEqual(cleanRising({ level: NaN }), { level: 2, streak: 0 });
  assert.deepEqual(cleanRising(null), { level: 2, streak: 0 });
});
test('levels 1, 4 and 7 are Easy, Medium and Hard; the rest sit in between', () => {
  for (const [lv, name] of [[1, 'easy'], [4, 'medium'], [7, 'hard']]) {
    const a = profile(lv), b = profile(name);
    for (const k of ['rpm', 'spread', 'perfect', 'reaction', 'mash']) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `${lv} ${k}`);
  }
  for (let lv = 1; lv < 7; lv++) assert.ok(profile(lv + 1).rpm > profile(lv).rpm);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((l) => profile(l).smarts), ['easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard']);
});
test('coins: Rising pays by level, same-device 2P pays nothing, friends need two humans', () => {
  const win = (o) => matchCoins({ won: true, roundsWon: 0, ...o }).total;
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((l) => win({ mode: 'cpu', difficulty: l })), [30, 40, 45, 55, 65, 70, 80]);
  assert.equal(matchCoins({ mode: '2p', won: true, roundsWon: 3, rubberality: true }).total, 0);
  assert.equal(win({ mode: 'friends', humans: 2 }), 20);
  assert.equal(matchCoins({ mode: 'friends', humans: 1, won: true, roundsWon: 3 }).total, 0);
});
```

- [ ] **Step 2: Run to verify they fail** — `node --test tests/rising.test.js tests/ai.test.js tests/economy.test.js` — Expected: FAIL (missing module / `profile` not exported / 2P still pays 20).
- [ ] **Step 3: Implement.** `profile(level)` blends linearly from Easy to Medium over levels 1–4 and Medium to Hard over 4–7; `mash` comes from today's `MASH_RATE` (4, 6, 8). Replace every `DIFFICULTY[difficulty]`, `MASH_RATE[difficulty]` and `difficulty === 'hard' | 'medium' | 'easy'` inside `ai.js` with `profile(difficulty)` / `.smarts`. Update the old economy test that expected 2P to pay 20.
- [ ] **Step 4: Run to verify they pass** — `npm test` — Expected: all pass.

---

### Task 4: The computer builds from the player's kit

**Files:**
- Modify: `src/ai.js`
- Test: `tests/ai.test.js`

**Interfaces:**
- Consumes: a kit `{ erasers, leads, abilities }` (Task 2).
- Produces: `pickCombo(difficulty, opponentSpec, rng = Math.random, kit = null)` and `pickAbility(difficulty, mySpec, oppSpec, rng = Math.random, kit = null)`. With `kit = null` they behave exactly as today.

- [ ] **Step 1: Write the failing tests**

```js
const START = { erasers: ['apsara-nondust', 'doms-cubo'], leads: ['nataraj-hb', 'doms-y1'], abilities: ['recentre', 'secondWind'] };
test('with a kit, every difficulty builds only from it', () => {
  const rng = seeded(7);
  for (const d of ['easy', 'medium', 'hard', 2, 5, 7]) for (let i = 0; i < 60; i++) {
    const opp = buildTop('doms-cubo', 'doms-y1');           // attack: Hard wants a defense eraser, the kit has none
    const p = pickCombo(d, opp, rng, START);
    assert.ok(START.erasers.includes(p.eraserId) && START.leads.includes(p.leadId), `${d}: ${p.eraserId}+${p.leadId}`);
    assert.ok(START.abilities.includes(pickAbility(d, buildTop(p.eraserId, p.leadId), opp, rng, START)));
  }
});
test('without a kit, picks are unchanged', () => {
  assert.deepEqual(pickCombo('hard', buildTop('camlin-dustfree', 'camlin-exam'), seeded(1)), pickCombo('hard', buildTop('camlin-dustfree', 'camlin-exam'), seeded(1), null));
});
```

(`seeded` is the seeded random helper exported by `tests/helpers.js`.)

- [ ] **Step 2: Run to verify they fail** — Expected: FAIL, Hard returns an eraser outside the kit.
- [ ] **Step 3: Implement.** Filter the eraser and lead pools by the kit. Hard: use erasers of the wanted archetype inside the kit; if there are none, fall through to the "any non-bad pair in the kit" branch. `steadiestLead` searches kit leads. The random loop tries each kit pair at most once before accepting a bad one, so it cannot spin forever. `pickAbility`: take the usual choice if the kit has it, else pick from `kit.abilities`.
- [ ] **Step 4: Run to verify they pass** — `npm test` — Expected: all pass.

---

### Task 5: Screens (locks, notes, Rising)

**Files:**
- Modify: `src/ui.js`, `styles.css`
- Test: `tests/kit-ui.test.js` (new, using the `fakeUI` pattern from `tests/friends-ui.test.js`)

**Interfaces:**
- Consumes: `holderOf` (Task 2).
- Produces (data passed to `ui.show`):
  - `'picker'`: adds `kit: { erasers: string[], leads: string[] }` (omit or `null` = nothing locked).
  - `'ability'`: adds `kit: { abilities: string[] }`.
  - `'difficulty'`: adds `rising: { level: number }`; the Rising card sends action `difficulty` with value `rising`.
  - `'title'`: adds `kitNote: boolean`; the note's button sends action `kit-note-ok`.
  - match-over sheet: adds `won: { erasers: string[], leads: string[], abilities: string[], combos: number } | null` and `risingMoved: { level: number, moved: -1 | 1 } | null`.

- [ ] **Step 1: Write the failing tests**

```js
const KIT = { erasers: ['apsara-nondust', 'doms-cubo'], leads: ['nataraj-hb', 'doms-y1'] };
test('locked parts show a padlock and who holds them, and cannot be picked', () => {
  const { ui, root, click, calls } = fakeUI();
  ui.show('picker', { player: 0, who: 'You,', color: '#2f5fd0', note: '', eraserId: 'apsara-nondust', leadId: 'nataraj-hb', kit: KIT });
  assert.match(root.innerHTML, /is-locked[^>]*data-value="faber-dustfree"|data-value="faber-dustfree"[^>]*is-locked/);
  assert.match(root.innerHTML, /Beat The Topper to win this/);
  click('pick-eraser', 'faber-dustfree'); click('ready');
  assert.deepEqual(calls.at(-1), ['ready', { eraserId: 'apsara-nondust', leadId: 'nataraj-hb' }]);
});
test('with no kit given, nothing is locked', () => {
  const { ui, root } = fakeUI();
  ui.show('picker', { player: 0, who: 'Player 1,', color: '#2f5fd0', note: '', eraserId: 'apsara-jumbo', leadId: 'faber-2b' });
  assert.doesNotMatch(root.innerHTML, /is-locked/);
});
test('every top shows a combo note: star for brand matches, plain for the rest', () => {
  const { ui, root } = fakeUI();
  ui.show('picker', { player: 0, who: 'You,', color: '#2f5fd0', note: '', eraserId: 'apsara-nondust', leadId: 'nataraj-hb' });
  assert.match(root.innerHTML, /★ Deadly Duo/);
  ui.show('picker', { player: 0, who: 'You,', color: '#2f5fd0', note: '', eraserId: 'doms-cubo', leadId: 'nataraj-hb' });
  assert.match(root.innerHTML, /Sharp Corners/); assert.doesNotMatch(root.innerHTML, /★ Sharp Corners|No combo yet/);
});
test('locked abilities cannot be picked', () => { /* 'ability' screen with kit.abilities = ['recentre','secondWind']: 'plant' card is-locked with "Beat The Principal to win this"; clicking it then 'ability-ready' still sends the selected one */ });
test('the difficulty screen leads with Rising and its level', () => {
  const { ui, root } = fakeUI();
  ui.show('difficulty', { rising: { level: 3 } });
  assert.match(root.innerHTML, /data-action="difficulty" data-value="rising"[\s\S]*Rising[\s\S]*level 3 of 7/);
  assert.ok(root.innerHTML.indexOf('data-value="rising"') < root.innerHTML.indexOf('data-value="easy"'));
});
test('a tournament win lists what was won; Rising says when the level moves', () => { /* match-over sheet with won = { erasers: ['Faber-Castell Dust-Free'], leads: ['Faber 2B'], abilities: ['Graphite Shield'], combos: 10 } contains "You won" and "10 new combos"; with risingMoved { level: 4, moved: 1 } contains "level 4" */ });
test('existing players get a one-time note on the title screen', () => { /* title with kitNote: true contains "win parts in the School Tournament" and a button with data-action="kit-note-ok"; with kitNote false it does not */ });
```

- [ ] **Step 2: Run to verify they fail** — `node --test tests/kit-ui.test.js` — Expected: FAIL on the first assertion (`is-locked` not found).
- [ ] **Step 3: Implement.** Locked buttons get class `is-locked`, `aria-disabled="true"` and the line "Beat <holder> to win this"; `pick-eraser` / `pick-lead` / `pick-ability` on a locked id are ignored inside `ui.js`. `comboHtml`: `★ name` with class `sticky` for star, plain name with class `sticky sticky-std` for standard, `⚠` for bad; remove the "No combo yet" branch. Change the how-to line to "Every pair has a combo; ★ star combos come from matching brands." Add the styles in the notebook look.
- [ ] **Step 4: Run to verify they pass** — `npm test` — Expected: all pass.

---

### Task 6: Wire solo play (vs Computer and Tournament)

**Files:**
- Modify: `src/main.js`
- Test: covered by Tasks 2–5 unit tests plus the browser run in Task 8 (`main.js` needs a page)

**Interfaces:**
- Consumes: `kitFor`, `fitParts`, `fitAbility`, `inKit`, `rewardFor` (Task 2); `afterMatch`, `profile` (Task 3); `pickCombo`/`pickAbility` with a kit (Task 4); screen data (Task 5).

- [ ] **Step 1:** Add `const soloKit = () => kitFor({ mode: session.mode, humans: friends ? humansIn(friends.room) : 1, progress: settings.tournament })`. `openPicker` and `openAbility` pass `kit` only when it is not the full kit, and open on `fitParts(kit, remembered)` / `fitAbility(kit, remembered)`.
- [ ] **Step 2:** `partsReady` / `abilityReady` ignore a pick that fails `inKit` (reopen the screen).
- [ ] **Step 3:** `case 'difficulty'`: value `rising` sets `session.rising = true` and `session.difficulty = settings.rising.level`; `ui.show('difficulty', { rising: settings.rising })`. The picker note reads `Versus the computer (Rising · level N of 7).`
- [ ] **Step 4:** `beginMatch` and the Hard re-pick in `startRound` pass `Math.random, kit` to `pickCombo` / `pickAbility`, and test `profile(difficulty).smarts === 'hard'` instead of `=== 'hard'`.
- [ ] **Step 5:** `payOut`: for `mode: 'cpu'` with `session.rising`, apply `afterMatch` once per match, save, and return `risingMoved`. `tournamentResult`: compute `rewardFor(rung, progressBefore)` before `advance` and return it as `won`.
- [ ] **Step 6:** Title: pass `kitNote: settings.kitNote`; `case 'kit-note-ok'` clears it and saves.
- [ ] **Step 7:** Run: `npm test` — Expected: all pass. Run: `node --check src/main.js` — Expected: no output.

---

### Task 7: Friends rooms and the coin holes

**Files:**
- Modify: `src/main.js`
- Test: `tests/kit.test.js` (already covers `humansIn`, `creatorMustRepick`, `kitFor` for rooms), `tests/economy.test.js` (Task 3)

**Interfaces:**
- Consumes: `humansIn`, `creatorMustRepick`, `kitFor` (Task 2); `matchCoins({ mode: 'friends', humans })` (Task 3).

- [ ] **Step 1:** `lobby-pick` opens the picker with `kitFor({ mode: 'friends', humans: humansIn(friends.room), progress: settings.tournament })` (guests count the room they see).
- [ ] **Step 2:** `hostStartMatch`: if `creatorMustRepick(friends.room, settings.tournament)`, set seat 0 `ready: false`, `broadcastLobby()`, `showLobby('Pick again: that top is for games with friends.')` and return.
- [ ] **Step 3:** `lobbyAddCpu`: when `humansIn(friends.room) === 1`, pass the creator's earned kit to `pickCombo` / `pickAbility`.
- [ ] **Step 4:** `friendsConfig` adds `humans: humansIn(room)`; `payOut` calls `matchCoins({ mode: online() ? 'friends' : g.config.mode, humans: g.config.humans, ... })`.
- [ ] **Step 5:** Run: `npm test` — Expected: all pass.

---

### Task 8: Balance, docs and the real-browser check

**Files:**
- Create: `tools/kit-check.mjs`
- Modify: `README.md`, `tools/pairs.mjs` (add a `--compare tools/baseline-pairs.json` flag)
- Possibly modify: `src/parts.js` (swap a standard combo's stat if a check fails)

- [ ] **Step 1: Balance.** Run: `node tools/pairs.mjs 40 1 --compare tools/baseline-pairs.json`
Expected: prints `OK` when the new best pair is at most 3 points above the old best and the new worst at most 3 points below the old worst; otherwise lists the offending pairs. Swap the up or down stat of an offending *standard* combo and re-run until `OK`.
- [ ] **Step 2: Rungs are winnable.** `tools/kit-check.mjs [rounds] [seed]`: for each rung, play the best top in the kit a player has on arrival (Hard computer) against that rung's opponent with its arena, modifier and boss flag. Run: `node tools/kit-check.mjs 300 1`
Expected: five lines, each `rung N: best top X+Y wins NN%` with NN ≥ 35. If a rung fails, lower that rung's `difficulty` one step in `src/tournament.js` and re-run.
- [ ] **Step 3: README.** Update "How to play" (earned kit, combos for every pair, Rising), the modes list, and the code-map rows for `src/kit.js`, `src/rising.js`, the two tools.
- [ ] **Step 4: Full suite.** Run: `npm test` — Expected: all pass, 0 fail.
- [ ] **Step 5: Browser.** With the dev server (`.claude/launch.json` → `rubber-rumble`), on a fresh profile and on a saved champion profile: starting kit shows 2 erasers and 2 leads with padlocks naming their holders; a tournament win shows "You won…" and unlocks; Rising moves after two wins; same-device 2P shows everything and pays no coins; a room with one human uses the earned kit and blocks Start on a full-kit top; an existing save gets the one-time note; no console errors.
