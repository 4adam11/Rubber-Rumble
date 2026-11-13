# Rubber Rumble

The school-desk game where you push a sharpened pencil lead into the back of an eraser and spin it like a top, now in the browser. Two tops battle in a steel thali. The last one spinning wins.

- **Play vs Computer** (Easy / Medium / Hard) or **2 Players on one device**.
- Works on phones (touch) and laptops (keyboard/mouse). No install, no account, no libraries.

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

Balance check (thousands of CPU-vs-CPU rounds):

```bash
node tools/balance.mjs 200 1   # rounds per matchup, seed
```

## How to play

1. **Build a top**: pick an eraser (the body) and a pencil lead (the tip).
2. **Place** it on your side of the thali rim.
3. **Twist**: flick two thumbs past each other again and again (touch), or mash your two keys one after the other.
4. **Let go** when the ring around your top is tight for a **Perfect Release** (no wobble, +5% spin).
5. **Battle**: nudge your top around (costs a little spin) and fire your special once per round.
6. You lose a round if your top **stops**, **tips over**, or gets **knocked out**. Hard hits can **snap the lead**. Best of 3.

| | Player 1 | Player 2 |
|---|---|---|
| Place / twist | `A` `D` | `←` `→` |
| Let go | `W` | `↑` |
| Steer | `W A S D` | Arrows |
| Special | `Space` | `Enter` |
| Pause | `Esc` / `P` | |

Touch: drag to place, two-thumb flick to twist, lift to let go. In battle, drag on your side to steer and tap ★ for your special.

## Parts

| Eraser | Mass | Size | Atk | Def | Sta | Type → Special |
|---|---|---|---|---|---|---|
| Apsara Non-Dust | 5 | 5 | 6 | 6 | 6 | Balance → Recentre |
| Apsara Jumbo | 9 | 8 | 4 | 9 | 6 | Defense → Plant |
| Nataraj 621 Plasto | 3 | 4 | 8 | 3 | 5 | Attack → Smash Dash |
| Doms Cubo | 5 | 5 | 9 | 4 | 4 | Attack → Smash Dash (wobbly cube) |
| Camlin Dust-Free | 5 | 5 | 5 | 5 | 8 | Stamina → Second Wind |
| Faber-Castell Dust-Free | 7 | 6 | 5 | 7 | 8 | Stamina → Second Wind |
| Fruit-Scented Fancy Eraser | 2 | 4 | 6 | 3 | 4 | Wildcard → random each round |

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
| Doms Double | Doms Cubo + Doms Y1+ | Cube wobble cancelled, Stamina +1 |
| Exam Hall | Camlin + Camlin | Stamina +2 |
| Topper's Kit | Faber-Castell + Faber-Castell | Defense +2, Stability +1 |
| Sugar Rush | Fruit-Scented + Apsara Platinum | Speed +2, Stamina −1 |
| Sleepy Bench ⚠ | Apsara Jumbo + Faber-Castell 2B | Speed −2, Stability −2 |
| Hindustan Family | any Apsara/Nataraj + any Apsara/Nataraj | Stamina +1, Durability +1 |

Brand names are plain part names only. This is an original fan game with no logos and no affiliation with any brand.

## Code map

| File | What it does |
|---|---|
| `src/parts.js` | Erasers, leads, combos, `buildTop()` |
| `src/physics.js` | Bowl, spin drain, wobble, collisions, lead snap, specials (tuning constants in `CONST`) |
| `src/launch.js` | Twist-launch state machine and touch/mouse stroke detectors |
| `src/ai.js` | Computer opponent: combo picks, launches, steering |
| `src/match.js` | Best-of-3 scoring |
| `src/input.js` | Touch / mouse / keyboard → per-player intents |
| `src/layout.js`, `src/render.js` | Screen mapping and canvas drawing |
| `src/ui.js`, `styles.css` | Notebook-paper menus |
| `src/audio.js`, `src/settings.js` | WebAudio synth; saved mute + last parts |
| `src/main.js` | Game flow and loop (`window.rubberRumble` is a console debug handle) |
| `docs/` | Design spec and implementation plan |
