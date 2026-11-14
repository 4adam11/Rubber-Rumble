# Play with Friends (online, 2–4 players) — Design

Date: 2026-11-14
Status: draft for approval

## 1. Intent

Friends want to battle each other from their own phones and laptops, not only
pass-and-play on one device. One player makes a room and shares a short code;
up to three friends join with that code. Everyone's top goes into the same
thali at once and the last one spinning wins — the Beyblade "everyone launches
together" moment, now with 3–4 tops.

Same-day tweaks already made (not part of this design, listed for the record):
FINISH IT! window 4 s → 6 s; phone twist time 4.5 s → 3.5 s (charge speed raised
so a full pull fills in ~2.5 s).

### Goals
- **Play with Friends** on the title screen → **Create room** or **Join room**.
- A room holds **2–4 players**, each on their own device, joined by a code like
  `RR-7K2Q`. *(user's decision)*
- **All tops fight in one bowl at once**; last top spinning wins the round.
  *(user's decision)*
- Works on phone and laptop, with each device's own controls (twist pad on
  touch, keys/mouse on laptop).
- Every existing battle feature keeps working with 3–4 tops: abilities,
  Spin Clash, lead snap / Snap KO, arena obstacles, announcer, sounds, skins.

### Non-goals
- Accounts, friend lists, matchmaking with strangers, leaderboards.
- Spectators beyond the (up to 4) players.
- Online School Tournament (tournament stays single-player).
- Voice or text chat.
- Rejoining a match after leaving it.

### Anti-goals (would make this a failure even if it technically works)
- Breaking or slowing down solo / same-device play, or making the game need the
  internet when it isn't in a friends room.
- A paid service, a server to maintain, or keys the owner must manage.
- Friends seeing a battle that visibly disagrees with the host's (tops in
  different places, different winner).
- Laggy-feeling controls for the person whose device runs the battle.

## 2. Constraints

- The game is static files on Vercel; there is no backend. Vercel cannot host
  WebSockets.
- Existing code: plain ES modules, Canvas 2D, no build step, `node --test`.
  Physics, launch, match, AI and finisher modules are pure and tested.
- The engine is written for exactly 2 tops in many places (`w.tops[1 - i]`,
  `[0, 1].map`, `const [a, b] = w.tops`, two-element arrays in `match.js`,
  `main.js`, `hud.js`, `render.js`, `intro.js`, `input.js`).
- No brand logos; all parts stay free (unchanged).
- First third-party library: the original spec said "no libraries". PeerJS is
  the one exception, loaded **only when the player opens Play with Friends**,
  from a pinned CDN URL, so solo play stays library-free and offline-capable.

## 3. Approaches considered

1. **Direct device-to-device (WebRTC via PeerJS), host-authoritative — chosen.**
   The room creator's device ("host") runs the one true battle; guests send
   their inputs and draw the snapshots the host sends back. PeerJS's free public
   broker only introduces the devices; game data then flows directly between
   them. Free, no account, no server. Trade-off: strict school/office networks
   that block direct connections can't join (no paid relay/TURN server).
2. **Hosted realtime service (Firebase / Supabase / Ably).** Works on more
   networks, but needs an account, keys and free-tier limits the owner must
   manage — against the anti-goals.
3. **Lockstep (every device simulates from shared inputs).** Least data, but
   JavaScript maths (`Math.sin`, `Math.exp`, …) can differ between browsers, so
   bowls drift apart — fails the "visibly disagrees" anti-goal. Ruled out.

The owner handed the "how" to the builder; approach 1 is the builder's pick.

## 4. Design

### 4.1 Engine: 2 → N tops (N = 2…4)

This also benefits offline modes, but offline modes keep using N = 2 for now.

- **Physics (`physics.js`)**
  - `createWorld(specs, launches, …)` accepts 2–4 specs/launches.
  - Collisions: every pair (i < j) each step.
  - Tops that are out (`lossReason` non-null) get `out: true`, an `outAt` time and
    an `outReason`; they stop moving, stop colliding, fade out in the renderer,
    and emit `{ type: 'out', i, reason }`.
  - `moveTop`'s `opp` (used for steering/AI aim) becomes "nearest live rival".
  - Round ends when ≤ 1 top is live: winner = the survivor, reason = the
    `outReason` of the **last** top to go out. If the last tops go out on the same
    step: higher pre-step rpm wins, equal = draw (same rule as today). Time limit:
    highest rpm among live tops wins (`reason: 'time'`), tie = draw.
  - **Spin Clash**: one at a time, between the pair in contact that triggers it
    (`clash.pair = [i, j]`); other tops freeze during the clash as today (world
    holds still). Only those two players mash. Clash event carries the pair.
  - Specials/zones/bumpers/quake/wind loop over all tops. Crumb Trail slows every
    rival, not just "the other".
  - `simulate`/`step` take an intents array of length N.
  - Balance: with 4 tops, `HIT_DAMAGE` stays; check `tools/balance.mjs` with a
    4-top free-for-all run (mean round length target 15–30 s) and tune only an
    `N`-dependent factor if rounds are far off.
- **Launch (`launch.js`)**: seats instead of sides. Seat k's home angle =
  `π + k·2π/N` (N = 2 gives today's π and 0). Slide range = `min(π/3, π/N − 0.1)`
  so neighbours can't overlap.
- **Match (`match.js`)**: arrays sized N. Scoring unchanged: round winner gets
  `POINTS[reason]` (how the last rival went out), first to 4 wins, draws replay.
- **AI (`ai.js`)**: CPU steers at the nearest live rival; mashes only in its own
  clash.

### 4.2 Each player's view

- Each device rotates the bowl so **its own top starts at the bottom**
  (portrait) or **left** (landscape). Layout gets a `viewAngle` (radians) used by
  `arenaToScreen` / `screenToArena`; offline modes keep today's mapping.
- HUD: your own health bar full-size in your corner; rivals as compact bars
  (name, eraser icon, health, points pips) across the top. Colours per seat:
  blue, red, green, amber.
- Launch labels, banners, stamps and the clash meter name players by nickname.

### 4.3 Rooms, lobby and flow

- **Title** gets **Play with Friends** → screen with **Create room** / **Join
  room** and a **nickname** field (saved in settings, default "Player").
- **Create**: host gets code `RR-XXXX` (4 chars from an unambiguous alphabet,
  e.g. no 0/O/1/I), shown big with a **Copy** button and a **Share** button
  (`navigator.share` where available). The PeerJS peer id is
  `rubber-rumble-<code>`.
- **Join**: type the code (case-insensitive, `RR-` optional) → connect. Errors:
  "No room with that code", "Room is full", "Match already started",
  "Couldn't connect — this network may block it".
- **Lobby** (everyone sees the same list, host is seat 1):
  - Seats 1–4: nickname, chosen eraser + pencil (thumbnail), ability, and a
    Ready tick. Empty seats show "Waiting…" — the host can tap **+ Computer**
    (Easy/Medium/Hard) to fill one, or remove it.
  - Each player taps **Pick my top** → existing picker → ability screen → back to
    lobby, marked Ready.
  - Host picks the arena (existing arena screen).
  - Host's **Start** is enabled when there are ≥ 2 seats filled and every human
    is Ready.
  - Leaving the lobby frees the seat.
- **Match**: VS intro (shows all 2–4 tops) → launch → battle → round result →
  next round (host taps Next; guests see "Waiting for host…") → match result.
  The match winner plays FINISH IT! on their own device; others watch it (a
  CPU winner's finisher is run by the host with the existing `cpuFinishes`). Then
  **Rematch** (host) returns everyone to a fresh match with the same seats, or
  **Back to lobby**.
- **Pause** is not available online; the pause button opens a small menu with
  Sound on/off and **Leave room**.
- Coins: each device pays out to its own wallet after each match using the
  existing `matchCoins`, from that player's point of view. Skins: each player's
  equipped sleeve/pencil skin is sent in their seat info and drawn for everyone.

### 4.4 Network model (host-authoritative)

- Transport: one PeerJS `DataConnection` per guest (reliable, JSON). A small
  `net.js` wraps PeerJS behind an interface `{ host(code), join(code), send,
  onMessage, onClose }` so the game logic can be tested with an in-memory fake.
- **Host** runs `createWorld`/`simulate` exactly as offline, using:
  its own local input; guests' latest intents; CPU brains for CPU seats.
- **Guests → host**: `intent` at ~30 Hz during battle (`steer`, plus edge
  counters for `special` presses and clash `taps` so none are lost);
  during launch, their own launch state is run **locally** for responsive
  feel and sent as `launch` updates (~15 Hz: phase, rimAngle, rpm, spinDir) and a
  final `launchDone` (the launch result). The host uses guests' results to build
  the world.
- **Host → guests**: `snapshot` at 20 Hz (time, per top: x, y, vx, vy, angle,
  rpm, wobble, out, flags — snapped, shield, planted, dash, specialUsed, unlocked;
  clash state; zones) plus every physics event since the last snapshot. Guests
  render by interpolating between the two latest snapshots (~100 ms behind) and
  feed the events to the existing renderer/audio/announcer hooks.
- Lobby/match messages: `hello`, `lobby`, `seat`, `start` (config + seed),
  `round`, `result`, `finishStart`, `finishMove`, `finishResult`, `rematch`,
  `bye`. Every message has a `v` (protocol version); mismatched versions get
  "Update the game (refresh) to join".
- **Disconnects**: a guest who drops mid-match → their seat becomes a Medium CPU
  for the rest of the match and everyone sees "<name> left — CPU takes over".
  In the lobby their seat just empties. Host drops → guests see "Room closed"
  and return to the title.
- Host device does physics for up to 4 tops plus 20 Hz broadcast; that's well
  within a phone's budget.

### 4.5 Files

| File | Change |
|---|---|
| `src/physics.js`, `src/launch.js`, `src/match.js`, `src/ai.js` | N tops (above) |
| `src/layout.js` | `viewAngle` in the screen ↔ arena mapping |
| `src/render.js`, `src/hud.js`, `src/intro.js` | draw N tops / bars / VS cards; seat colours |
| `src/net.js` (new) | PeerJS wrapper + in-memory fake for tests; lazy-loads PeerJS |
| `src/room.js` (new) | pure lobby state: seats, ready, CPU fill, start rules, codes |
| `src/online.js` (new) | host loop / guest loop: message handling, snapshots, interpolation |
| `src/ui.js`, `styles.css` | friends, join, lobby screens; compact HUD bars |
| `src/main.js` | Play with Friends flow; reuse match flow with N seats |
| `src/settings.js` | nickname |
| `README.md` | how to play with friends |

### 4.6 Testing

- Unit: N-top physics (pairwise hits, outs, last-standing winner, simultaneous
  outs, time limit, clash pair, crumbs vs all rivals); launch seat angles and
  slide limits for N = 2–4; match with N seats; room rules (codes, seat fill,
  CPU fill, start conditions, leave); protocol encode/decode and version check;
  host + 2 guests over the in-memory fake transport play a whole round to a
  result.
- Existing 153 tests stay green; offline 1P / 2P behaviour unchanged.
- Browser: 2–4 tabs in the preview browser on one machine, joined by code,
  phone and laptop sizes; also a 2-friends + 2-CPU room.
- Balance run: 4-top FFA rounds via `tools/balance.mjs`.

## 5. Builder's calls (marked)

These were not discussed; they are the builder's calls and can be changed:
- Online 2-player rooms use the same rules as 3–4 (last spinning, points).
- Out tops fade away rather than lying in the bowl.
- Rematch / Back to lobby after a match; host controls round advance.
- Code format `RR-XXXX`; PeerJS pinned version from cdnjs/unpkg.
- Guests run their own launch locally; host runs the battle.
- No pause online.

## 6. Left to the builder

Message field names, snapshot packing, interpolation details, HUD exact layout
for 4 bars at 360 px wide, CPU difficulty default for filled seats (Medium),
PeerJS connection options (default STUN only), error copy details.
