# Rubber Rumble

The school-desk game where you push a sharpened pencil lead into the back of an eraser and spin it like a top, now in the browser. Two tops battle in a steel thali. The last one spinning wins.

- **Play vs Computer** (Easy / Medium / Hard) or **2 Players on one device**.
- Works on phones (touch, vibration, add-to-home-screen) and laptops (keyboard/mouse). No install, no account, no libraries.
- **Live:** https://rubber-rumble.vercel.app

## Run it

ES modules don't load from `file://`, so serve the folder:

```bash
python -m http.server 5182
```

Then open http://localhost:5182.

Tests (Node 18+):

```bash
npm test
```

Balance check (thousands of CPU-vs-CPU rounds, with abilities, across all arenas):

```bash
node tools/balance.mjs 200 1 all   # rounds per matchup, seed, arena (thali|tiffin|geometry|all)
```

## How to play

1. **Build a top**: pick an eraser (the body) and a pencil lead (the tip). The stat bars fill and empty as you swap parts.
2. **Pick your comeback ability** (see below) and an **arena**.
3. **Place** your top on your side of the rim.
4. **Twist**: flick two thumbs past each other again and again (touch), or mash your two keys one after the other.
5. **Let go** when the ring around your top is tight for a **Perfect Release** (no wobble, +5% spin).
6. **Battle**: your **health bar is your spin**. It drains over time and drops on every hit. Nudge your top around (costs a little health).
7. At **30% health your ability unlocks**. Fire it once to turn the fight around.
8. You lose a round when your health runs out, you **tip over**, or you get **knocked out**. Hard hits can **snap the lead**. Best of 3.

| | Player 1 | Player 2 |
|---|---|---|
| Place / twist | `A` `D` | `←` `→` |
| Let go | `W` | `↑` |
| Steer | `W A S D` | Arrows |
| Ability | `Space` | `Enter` |
| Pause | `Esc` / `P` | |

Touch: drag to place, two-thumb flick to twist, lift to let go. In battle, drag on your side to steer and tap the big ability button when it lights up. The **How to play** screen has an animated demo of every control.

## Abilities

| Ability | Effect |
|---|---|
| ⚡ Smash Dash | Charge at your rival; your next hit does 1.5× damage |
| ⚓ Plant | Dig in for 2.5 s: 3× heavier, half damage |
| 🌀 Second Wind | Win back 20% health and steady the wobble |
| ◎ Recentre | Kill the wobble and slide back toward the middle |
| 🛡 Graphite Shield | Blocks the next two hits completely |
| ✦ Crumb Trail | Drop eraser crumbs for 4 s; your rival slows down in them |

## Arenas

| Arena | Level | What's in it |
|---|---|---|
| Steel Thali | Basic | Smooth steel, deep bowl |
| Tiffin Lid | Medium | Flatter lid with sticky dal stains that slow you |
| Geometry Box | Hard | Ink blots and shaving piles that slow you, plus a sharpener and a compass pin to bounce off |

## Parts

| Eraser | Mass | Size | Atk | Def | Sta | Type |
|---|---|---|---|---|---|---|
| Apsara Non-Dust | 5 | 5 | 6 | 6 | 6 | Balance |
| Apsara Jumbo | 9 | 8 | 4 | 9 | 6 | Defense (braces: −15% hit damage) |
| Nataraj 621 Plasto | 3 | 4 | 8 | 3 | 5 | Attack |
| Doms Neon Hexagon | 5 | 5 | 9 | 4 | 4 | Attack (hex corners hit harder, wobbly) |
| Camlin Dust-Free | 5 | 5 | 5 | 5 | 8 | Stamina |
| Faber-Castell Dust-Free | 7 | 6 | 5 | 7 | 8 | Stamina |
| Fruit-Scented Fancy Eraser | 2 | 4 | 6 | 3 | 4 | Wildcard |

| Lead | Stability | Glide | Speed | Durability |
|---|---|---|---|---|
| Nataraj 621 HB | 7 | 6 | 6 | 6 |
| Apsara Platinum Extra Dark | 5 | 3 | 9 | 4 |
| Apsara Absolute | 6 | 5 | 5 | 10 |
| Doms Y1+ | 6 | 9 | 5 | 5 |
| Camlin Exam HB | 8 | 6 | 5 | 6 |
| Faber-Castell 2B | 9 | 5 | 3 | 7 |

| Combo | Eraser + Lead | Effect |
|---|---|---|
| Deadly Duo | Apsara Non-Dust / Jumbo + Nataraj 621 HB | Attack +2, Stability +1 |
| Doms Double | Doms Neon Hexagon + Doms Y1+ | Hex wobble cancelled, Stamina +1 |
| Exam Hall | Camlin + Camlin | Stamina +2 |
| Topper's Kit | Faber-Castell + Faber-Castell | Defense +2, Stability +1 |
| Sugar Rush | Fruit-Scented + Apsara Platinum | Speed +2, Stamina −1 |
| Sleepy Bench ⚠ | Apsara Jumbo + Faber-Castell 2B | Speed −2, Stability −2 |
| Hindustan Family | any Apsara/Nataraj + any Apsara/Nataraj | Stamina +1, Durability +1 |

Brand names are plain part names only. The erasers and pencils are drawn from scratch in the real products' colours; there are no logos or product photos, and this original fan game has no affiliation with any brand.

## Code map

| File | What it does |
|---|---|
| `src/parts.js` | Erasers, leads, combos, `buildTop()` |
| `src/abilities.js`, `src/arenas.js` | Comeback abilities and arena layouts |
| `src/physics.js` | Bowl, health/spin drain, wobble, collisions, lead snap, abilities, slowing patches, bumpers (tuning in `CONST`) |
| `src/launch.js` | Twist-launch state machine and touch/mouse stroke detectors |
| `src/ai.js` | Computer opponent: combo + ability picks, launches, steering |
| `src/match.js` | Best-of-3 scoring |
| `src/input.js` | Touch / mouse / keyboard → per-player intents |
| `src/layout.js` | Screen ↔ arena mapping and where the health bars go |
| `src/render.js` | Tops, effects (trails, shockwaves, lead-snap slow-mo), launch, banners |
| `src/art.js`, `src/arena-art.js` | Eraser/pencil art and arena backgrounds |
| `src/hud.js`, `src/intro.js` | Fighting-game health bars; the VS intro |
| `src/demos.js` | Animated How-to-play demos |
| `src/ui.js`, `styles.css` | Notebook-paper menus |
| `src/audio.js`, `src/settings.js` | WebAudio synth; saved mute, parts, ability and arena |
| `src/main.js` | Game flow and loop (`window.rubberRumble` is a console debug handle) |
| `assets/` | Logo / tab icon / home-screen icons |
| `docs/` | Design spec and implementation plan |
