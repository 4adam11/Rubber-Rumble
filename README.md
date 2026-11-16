# Rubber Rumble

The school-desk game where you push a sharpened pencil lead into the back of an eraser and spin it like a top, now in the browser. Two tops battle in a steel thali. The last one spinning wins.

- **Play vs Computer** (Rising, a level that grows with you, or Easy / Medium / Hard), **2 Players on one device**, or **Play with Friends**: 2–4 players online, each on their own phone or laptop, joined with a room code.
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

Balance check (thousands of CPU-vs-CPU rounds, with abilities, across all arenas; `tools/ffa.mjs` does the same for 3–4 tops at once):

```bash
node tools/balance.mjs 200 1 all   # rounds per matchup, seed, arena (thali|tiffin|geometry|all)
```

Two more checks, used when parts, combos or tournament opponents change:

```bash
node tools/pairs.mjs 20 1 --compare tools/baseline-pairs.json
```

```bash
node tools/kit-check.mjs 200 1
```

The first plays every pair against every other and checks no pair is stronger or weaker than the recorded range allows. The second checks each tournament opponent can be beaten with the kit a player owns on reaching it. `tools/try-combo.mjs` tries different stat swaps for one standard combo.

## How to play

1. **Build a top**: pick an eraser (the body) and a pencil lead (the tip). The stat bars fill and empty as you swap parts. Every pair makes a combo. Playing alone you start with a small kit and win more parts in the School Tournament; with friends everything is unlocked.
2. **Pick your comeback ability** (see below) and an **arena**.
3. **Place** your top on your side of the rim.
4. **Twist**: on a phone, put one thumb on each of the two grips stacked at the bottom of the screen, pull them apart (top grip one way, bottom grip the other) and **hold**: the spin charges while you hold, and phones get 3.5 s to charge. On a keyboard, mash your two keys one after the other.
5. **Let go** when the ring around your top is tight for a **Perfect Release** (no wobble, +5% spin).
6. **Battle**: your **health bar is your spin**. It drains over time and drops on every hit. Nudge your top around (costs a little health).
7. At **30% health your ability unlocks**. Fire it once to turn the fight around.
8. You lose a round when your health runs out, you **tip over**, or you get **knocked out**. Hard hits can **snap the lead**. First to 4 points wins.

| | Player 1 | Player 2 |
|---|---|---|
| Place / twist | `A` `D` | `←` `→` |
| Let go | `W` | `↑` |
| Steer | `W A S D` | Arrows |
| Ability | `Space` | `Enter` |
| Spin Clash | mash `A` `D` | mash `←` `→` |
| FINISH IT! | `W A S D` + `Space` | Arrows + `Enter` |
| Pause | `Esc` / `P` | |

Touch: drag to place, then pull the **twist pad** grips apart and hold to charge (two grips, one above the other, at the bottom of the screen; in 2-player portrait Player 2's pad is at the top, facing them), and let go of both to launch. In battle, drag on your side to steer and tap the big ability button when it lights up. The **How to play** screen has an animated demo of every control.

## Scoring, clashes and finishers

- **Points, first to 4** (Beyblade X style): Spin Finish 1 · Tip Finish 2 · Knock-Out 2 · **Snap KO 3** (a snapped lead takes a second big hit and the eraser crumbles). Winning a round without taking damage is a **Flawless**.
- **Spin direction:** the way you first pull (top grip right = ↻, left = ↺) or first key sets the spin. Opposite spins hit harder.
- **Spin Clash:** when the tops grind together they lock up; mash your keys (or tap) faster than your rival to steal their spin.
- **FINISH IT!** After the match-winning round, enter the shown moves within 6 seconds for a **Rubberality** (Sharpener Shred or Rub-Out).
- **Announcer:** round calls, "Ghumao!", finish calls and Flawless, using your device's built-in voice.

## Play with Friends (online, 2–4 players)

1. One player taps **Play with Friends → Create a room** and gets a code like `RR-7K2Q` (Copy or Share it; a shared link fills the code in for your friends).
2. Up to three friends tap **Join room** and type the code.
3. In the lobby everyone taps **Pick my top**. The room creator picks the arena, can fill empty seats with computers (Easy / Medium / Hard), and taps **Start the battle** once 2+ players are in and ready.
4. All the tops launch together; the last one spinning wins the round (points as usual, first to 4). Each screen turns the bowl so your own top starts nearest you.

How it works: the room creator's device runs the battle and the others send their moves to it, directly between devices (WebRTC, using the free PeerJS service to find each other; no account or server). So:
- keep the game open on the room creator's device during a match;
- if a friend drops out, a computer takes over their top; if the room creator leaves, the room closes;
- mobile data and many school or office Wi-Fi networks block direct connections. Then the game's messages go through a **relay** (Metered.ca), if the relay is set up (below). Without one, friends on those networks can't join; the same Wi-Fi (or one phone's hotspot) still works.

### Turning on the relay (Metered.ca)

The keys are kept on the server, never in the game's code: the game asks `/api/turn` (a Vercel function, `api/turn.mjs`) for relay servers, and only the game's own pages may ask.

1. Sign up at metered.ca (free plan) and create an app. Its address looks like `your-app.metered.live`.
2. In Vercel → the project → **Settings → Environment Variables**, add (for Production):
   - `METERED_APP`: the app name (`your-app`);
   - `METERED_SECRET_KEY`: Metered dashboard → **Developers** → Secret key (**Reveal**). With it, the server makes relay passes that expire after 48 hours and a fresh one every 24 hours, so a copied pass stops working within 2 days;
   - `METERED_API_KEY` (optional fallback): the API key of a fixed pass from the app's TURN credentials, used if the secret key is missing or Metered refuses it.
3. Redeploy. To check the relay on its own, open the game with `?relay=only` on both devices: every connection then has to go through the relay.

Never put these keys in the code: the GitHub repo is public. If the relay can't be reached, the game falls back to direct connections. Relay traffic counts against the Metered plan's monthly allowance, and only games that can't connect directly use it.

## School Tournament

Five rungs, each with a twist, saved as you go: Class Bully → The Backbencher (oily desk) → Class Monitor (ceiling fan) → The Topper (earthquake drill) → **The Principal** (boss with a giant eraser).

### The earned kit

Playing alone (vs Computer, the tournament, or an online room with no other human in it) you build from the parts you have **won**. Beat an opponent and their eraser, lead and ability are yours:

| When | You gain | Tops you can build |
|---|---|---|
| Start | Apsara Non-Dust, Doms Neon Hexagon · Nataraj HB, Doms Y1+ · Recentre, Second Wind | 4 |
| Beat Class Bully | Nataraj 621 Plasto · Platinum · Smash Dash | 9 |
| Beat The Backbencher | Fruit-Scented Fancy Eraser · Crumb Trail | 12 |
| Beat Class Monitor | Camlin Dust-Free · Camlin Exam | 20 |
| Beat The Topper | Faber-Castell Dust-Free · Faber 2B · Graphite Shield | 30 |
| Beat The Principal | Apsara Jumbo · Absolute · Plant | 42 |

- A combo is on as soon as you own both of its parts, so every win also unlocks a batch of combos.
- The kit is worked out from your tournament progress; nothing is bought, and coins stay for looks only.
- In solo games the computer builds only from parts you own.
- **With two or more humans** (2 Players on one device, or an online room with a friend in it) everyone has every part, ability and combo.
- Coins are paid for real opposition only: 2 Players on one device pays nothing, and an online match pays only if two or more humans started it.

### Rising difficulty

Play vs Computer offers **Rising**: 7 levels (1 plays like Easy, 4 like Medium, 7 like Hard). You start at level 2; two match wins in a row move up a level and two losses in a row move down. A win pays 30 coins at level 1 up to 80 at level 7. Easy, Medium and Hard are still there.

## Stationery Shop

Win matches to earn pocket money (bonuses for Flawless, Snap KO, Rubberality and tournament rungs). Spend it on eraser sleeves (Galaxy, Tiger, Tiranga, Neon, Gold Foil) and pencil paints (Rainbow, Camo, Gold). Looks only: every part stays free.

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

Those are the **star combos** (★, from matching brands) and the one bad combo. The other 28 pairs each have a **standard combo**: a name, one stat +1 and one stat −1 (for example Paper Plane: Glide +1, Defense −1). The full list is in `src/parts.js`.

Brand names are plain part names only. The erasers and pencils are drawn from scratch in the real products' colours; there are no logos or product photos, and this original fan game has no affiliation with any brand.

## Code map

| File | What it does |
|---|---|
| `src/parts.js` | Erasers, leads, a combo for every pair, `buildTop()` |
| `src/kit.js` | The earned kit: what a solo player owns, from tournament progress; full kit for 2+ humans |
| `src/rising.js` | Rising difficulty: the level and when it moves |
| `src/abilities.js`, `src/arenas.js` | Comeback abilities and arena layouts |
| `src/physics.js` | Bowl, health/spin drain, wobble, collisions (every pair, 2–4 tops), lead snap, abilities, slowing patches, bumpers (tuning in `CONST`) |
| `src/launch.js` | Twist-launch state machine and touch/mouse stroke detectors |
| `src/ai.js` | Computer opponent: combo + ability picks (inside the player's kit), launches, steering; `profile()` for every difficulty and Rising level |
| `src/match.js` | Points scoring (first to 4) |
| `src/finisher.js`, `src/announcer.js` | FINISH IT! sequences; announcer lines |
| `src/tournament.js`, `src/economy.js` | School Tournament ladder; coins and the shop |
| `src/input.js` | Touch / mouse / keyboard → per-player intents |
| `src/room.js`, `src/net.js`, `src/relay.js`, `src/online.js` | Friends rooms and codes; PeerJS connections + heartbeat; relay settings; snapshots and smoothing |
| `api/turn.mjs`, `api/_turn.mjs` | Server: hands out Metered relay servers (keys in Vercel settings; rotating 48-hour passes) |
| `src/twistpad.js` | The phone twist pad: two stacked grips pulled apart and held to charge |
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
