# Rubber Rumble — Design Spec

Date: 2026-11-13
Status: approved in chat, awaiting written-spec review

## 1. What it is

A browser game based on the Indian school trick of pushing a sharpened pencil
lead into the back of an eraser and spinning it like a top. Two tops battle in a
steel thali (plate) on a school desk; the first top to stop loses.

It is an original game: no Beyblade names, characters, art or sounds. Real
stationery brand names (Apsara, Nataraj, Doms, Camlin, Faber-Castell) are used
only as plain-text part names — no logos or product artwork.

### Goals / success criteria
- Plays well on both phone (touch) and laptop (keyboard/mouse) in a browser.
- Modes: **vs Computer** (Easy / Medium / Hard) and **2 players on one device**.
- Choosing eraser + lead visibly changes how a top behaves; combos matter.
- The launch feels like the two-thumb twist and rewards skill.
- Loads instantly, works offline once loaded, no install, no account.

### Out of scope (v1)
Online multiplayer, unlocks/currency, accounts, leaderboards, 3D.

## 2. Tech approach

- Plain HTML + CSS + JavaScript ES modules, Canvas 2D. No libraries, no build.
- Custom physics (tops are circles with spin, wobble and a bowl slope).
- Folder: `rubber-rumble/`, served by a static server (ES modules don't load from
  `file://`). A `rubber-rumble` entry is added to `.claude/launch.json`
  (`python -m http.server 5182 --directory rubber-rumble`).
- Logic modules are pure (no DOM) so they can be tested with Node's built-in
  `node:test` runner.

### Files
| File | Purpose | Depends on |
|---|---|---|
| `index.html` | Page shell, canvas, screen containers, CSS | — |
| `src/parts.js` | Eraser, lead, combo data; `buildTop(eraserId, leadId)` → stats | — |
| `src/physics.js` | `createWorld`, `step(world, dt, inputs)`: movement, bowl, collisions, spin drain, wobble, lead snap, round-end detection | parts output |
| `src/launch.js` | Twist-launch state machine (place → twist → release) per player, turns raw input into `{x, y, rpm, wobble}` | — |
| `src/input.js` | Unifies touch / mouse / keyboard into per-player intents (twist strokes, steer vector, special, release) | DOM |
| `src/ai.js` | CPU: combo pick, launch result, per-frame steer/special intents | parts, physics state |
| `src/render.js` | Draws desk, thali, tops, sparks, HUD on canvas | physics state |
| `src/ui.js` | Menus: title, mode, difficulty, part picker + stat card, round/match results, pause | DOM, parts |
| `src/audio.js` | Tiny WebAudio synth: spin hum, clack, snap, win/lose | — |
| `src/main.js` | Game loop + screen flow (fixed 120 Hz physics step, render on rAF) | all |
| `tests/*.test.js` | Tests for parts and physics | parts, physics |

## 3. Parts

All parts are available from the start.

### Erasers (body) — stats 1–10
| id | Name | Mass | Size | Attack | Defense | Stamina | Archetype | Notes |
|---|---|---|---|---|---|---|---|---|
| `apsara-nondust` | Apsara Non-Dust | 5 | 5 | 6 | 6 | 6 | Balance | grippy all-rounder |
| `apsara-jumbo` | Apsara Jumbo | 9 | 8 | 4 | 9 | 6 | Defense | big, heavy wall |
| `nataraj-621` | Nataraj 621 Plasto | 3 | 4 | 8 | 3 | 5 | Attack | hard, light |
| `doms-cubo` | Doms Cubo | 5 | 5 | 9 | 4 | 4 | Attack | square body: +2 base wobble, corner hits |
| `camlin-dustfree` | Camlin Dust-Free | 5 | 5 | 5 | 5 | 8 | Stamina | steady |
| `faber-dustfree` | Faber-Castell Dust-Free | 7 | 6 | 5 | 7 | 8 | Stamina | dense |
| `fruit-scented` | Fruit-Scented Fancy Eraser | 2 | 4 | 6 | 2 | 4 | Wildcard | special is random each round |

### Leads (tip) — stats 1–10
| id | Name | Stability | Glide | Speed | Durability |
|---|---|---|---|---|---|
| `nataraj-hb` | Nataraj 621 HB | 7 | 6 | 6 | 6 |
| `apsara-platinum` | Apsara Platinum Extra Dark | 5 | 3 | 9 | 4 |
| `apsara-absolute` | Apsara Absolute | 6 | 5 | 5 | 10 |
| `doms-y1` | Doms Y1+ | 6 | 9 | 5 | 5 |
| `camlin-exam` | Camlin Exam HB | 8 | 6 | 5 | 6 |
| `faber-2b` | Faber-Castell 2B | 9 | 5 | 3 | 7 |

- Stability: resists wobble. Glide: lower spin drain. Speed: steering/drift
  acceleration. Durability: how hard a hit must be to snap the lead.

### Combos (applied once, first match wins, in this order)
| Combo | Eraser | Lead | Effect |
|---|---|---|---|
| Deadly Duo | `apsara-nondust` or `apsara-jumbo` | `nataraj-hb` | Attack +2, Stability +1 |
| Doms Double | `doms-cubo` | `doms-y1` | base wobble −2 (cancels cube penalty), Stamina +1 |
| Exam Hall | `camlin-dustfree` | `camlin-exam` | Stamina +2 |
| Topper's Kit | `faber-dustfree` | `faber-2b` | Defense +2, Stability +1 |
| Sugar Rush | `fruit-scented` | `apsara-platinum` | Speed +2, Stamina −2 |
| Sleepy Bench | `apsara-jumbo` | `faber-2b` | Speed −2 |
| Hindustan Family | any Apsara/Nataraj eraser | any Apsara/Nataraj lead | Stamina +1, Durability +1 |

Stats are clamped to 1–10 after bonuses.

### Stat card (shown in picker, 1–10 bars)
- **Attack** = eraser Attack
- **Defense** = eraser Defense
- **Stamina** = round((eraser Stamina + lead Glide) / 2)
- **Balance** = round((lead Stability × 2 − base wobble) / 2), where base wobble = 2 for `doms-cubo`, 1 for `fruit-scented`, else 0 (after combo changes)
- **Speed** = round((lead Speed × 2 − eraser Mass + 5) / 2)
plus combo name/effect if one applies, and the special move.

## 4. Launch — the two-thumb twist

Both players launch at the same time (in vs CPU the CPU's result is computed by
`ai.js`). Total window ≈ 4 s, shown with a countdown.

1. **Place (≈1.5 s)** — drag your top to a spot on your half of the thali rim
   (keyboard: `A`/`D` or `←`/`→` slide along the rim). Default spot if untouched.
2. **Twist (≈2.5 s)** — fill an RPM meter.
   - Touch: two fingers on your side; each time the two fingers move past each
     other in opposite vertical directions (one up, one down) by ≥ 30 px, that is
     one stroke. Stroke value scales with finger speed.
   - Keyboard: alternate keys — P1 `A`↔`D`, P2 `←`↔`→`. Each alternation = one
     stroke; repeating the same key does nothing.
   - Mouse: circular drag around the top; each ~half turn = one stroke.
   - RPM gained per stroke = `maxRPM / 22` (so ~22 good strokes fill it), with
     mild diminishing returns above 80 %.
3. **Release** — a wobble ring pulses (period 0.8 s). Release = lifting fingers /
   pressing `W` (P1) or `↑` (P2) / mouse up, or auto-release when time ends.
   - Ring tight (within 15 % of minimum): **Perfect Release** → starting wobble
     0, +5 % RPM, "PERFECT!" text.
   - Otherwise starting wobble = 0.1–0.4 depending on ring size.
   - Auto-release at time-out counts as a mid-ring release.

`maxRPM` = 1000 × (1.15 − Mass × 0.03). Heavy erasers have a lower ceiling but
drain slower (see physics).

## 5. Battle

### Arena
- Thali radius R (scaled to screen). The bowl pulls each top toward the centre
  with acceleration `k × distance` (slope).
- Out of the thali: centre distance > R + top radius → **ring-out**.

### Top state
`{x, y, vx, vy, rpm, wobble (0–1), leadSnapped, specialUsed, specialActiveUntil}`

### Each physics step (dt = 1/120 s)
- Steering intent (vector, length 0–1) adds acceleration ∝ Speed; while
  steering, rpm drains an extra `STEER_COST × |steer|` per second (starting
  value 2 % of maxRPM per second at full steer).
- Free drift: a small random tangential push ∝ (1 − Stability/10), so tops
  wander like real ones.
- Velocity damping (floor friction).
- Spin drain per second = `BASE_DRAIN × (1.3 − Stamina/10) × (1 + wobble)`.
  Mass reduces drain slightly: × (1.1 − Mass × 0.02).
- Wobble grows when rpm < 35 % of maxRPM: `+ WOBBLE_RATE × (1 − Stability/12)`
  per second; wobble also rises from hits. Wobble ≥ 1 → **tips over**.
- Collision (circle–circle): push apart, exchange momentum with restitution
  0.8 (mass-weighted). Impact = relative normal speed.
  - Each top loses rpm = `impact × HIT_DAMAGE × oppAttack / ownDefense`.
  - Doms Cubo deals +15 % hit damage (corners).
  - Each top gains wobble = `impact × HIT_WOBBLE × (1 − Stability/12)`.
  - **Lead snap**: if impact > `SNAP_BASE × Durability` and lead not yet snapped
    → rpm −25 %, wobble +0.3, `leadSnapped = true`, snap sound + shavings burst.
    Max once per top per round.
- Pencil-shaving sparks spawn at the contact point, count ∝ impact.

### Specials (one per round — keys in §6; touch: special button on your side)
| Archetype | Special | Effect |
|---|---|---|
| Attack | Smash Dash | 0.35 s burst of high acceleration toward opponent; next hit ×1.5 damage |
| Defense | Plant | 2 s: mass ×3, steering disabled, takes 50 % hit damage |
| Stamina | Second Wind | +15 % of maxRPM, wobble −0.2 |
| Balance | Recentre | wobble → 0, velocity damped toward centre |
| Wildcard | (random of the four, rolled at round start, shown on HUD) | |

### Round end
A top loses the round when: rpm ≤ 0 (stopped), wobble ≥ 1 (tipped over), or
ring-out. If both happen in the same step, the top with more rpm left wins; if
equal, draw (round replayed). After 60 s, the higher-rpm top wins ("time").

### Match
Best of 3 rounds. Between rounds each player may change parts (CPU may too on
Hard). Results screen shows winner, how each round ended, and Rematch / Change
Parts / Menu.

## 6. Controls summary
| | Player 1 | Player 2 |
|---|---|---|
| Keyboard steer | `W A S D`* | Arrow keys* |
| Keyboard twist | alternate `A`/`D` | alternate `←`/`→` |
| Keyboard release | `W` | `↑` |
| Keyboard special | `Space` (battle) | `Enter` (battle) |
| Touch | left half (portrait: bottom half) | right half (portrait: top half) |

\*Launch and battle are separate phases, so `A`/`D` and arrows mean "slide /
twist" during the launch and "steer" during the battle without conflict.

- 2 players on a laptop use the keyboard only (mouse is vs CPU only).
- vs CPU on touch: the human uses the whole screen.
- Touch battle: drag anywhere on your side = virtual joystick from the touch
  point; on-screen special button on your side.
- Mouse (vs CPU): drag to steer, right-click or on-screen button for special.

## 7. Computer opponent
| | Easy | Medium | Hard |
|---|---|---|---|
| Launch RPM (fraction of max) | 0.60 ± 0.10 | 0.80 ± 0.08 | 0.92 ± 0.05 |
| Perfect release chance | 10 % | 35 % | 65 % |
| Reaction delay | 0.5 s | 0.25 s | 0.1 s |
| Combo pick | random | random sensible (no "bad" combos) | counter-pick vs player's combo |

Behaviour each tick: if ahead on rpm and Attack ≥ opponent Defense → steer at
opponent; else orbit near centre to avoid ring-out; steer away from rim when
close to it. Uses special when: Attack — opponent within range; Defense —
opponent closing fast; Stamina — rpm < 30 %; Balance — wobble > 0.6.

Hard counter-pick: vs Attack archetype pick Defense; vs Defense pick Stamina;
vs Stamina pick Attack; vs Balance/Wildcard pick a Deadly Duo.

## 8. Look & feel
- Top-down view of a wooden school desk; the arena is a steel thali with a
  radial metallic gradient and rim highlight.
- Tops: eraser drawn as a rounded rectangle (cube for Doms Cubo) in its colour,
  rotating with rpm; motion blur ring at high rpm; small pencil-stub highlight at
  centre; wobble shown as an off-centre orbit of the drawing.
- UI on ruled notebook paper, handwritten-style Google Font (e.g. "Kalam") for
  headings, a clean sans for numbers; sketchy doodle borders; stat bars look
  like hand-shaded boxes.
- HUD: each player's rpm bar, wobble meter, special ready/used, round pips.
- Responsive: landscape and portrait; 16 px gutters; nothing overflows at 360 px
  width. Respects `prefers-reduced-motion` (fewer sparks/shake).
- Sound on by default with a mute toggle; settings (mute, last parts) saved in
  `localStorage` inside try/catch.

## 9. Error handling
- `localStorage` unavailable → defaults, no crash.
- AudioContext blocked until first interaction → start audio on first tap/key.
- Tab hidden → auto-pause; physics step clamps large dt to avoid tunnelling.
- Window resize/rotation → re-layout canvas and rescale arena; positions stored
  in arena units, not pixels.

## 10. Testing
- `node --test rubber-rumble/tests/` covering:
  - `buildTop`: every eraser×lead pair produces stats in 1–10; each named combo
    triggers for its parts and only its parts; combo order precedence.
  - physics: a lone top in the bowl drifts toward centre; spin drains to 0 and
    the round ends with reason `stopped`; ring-out detection; collision conserves
    momentum (within tolerance) and lowers both rpm; lead snap fires at most
    once and only above the threshold; higher-Stamina combo outlasts a
    lower-Stamina one with identical launch.
  - launch: alternating keys add strokes, repeated key doesn't; perfect-release
    window.
- Manual play-test in the browser at phone (375×812) and desktop sizes: full
  match vs CPU on each difficulty, a 2P match, touch launch, pause/resume.
