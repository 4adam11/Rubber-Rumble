# Play with Friends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Online rooms for 2–4 players joined by code, all tops fighting in one bowl at once.

**Architecture:** The engine goes from 2 tops to N (2–4). The room creator's device ("host") runs the only simulation; guests run their own launch locally, send inputs, and draw interpolated snapshots. PeerJS (lazy-loaded) carries JSON messages over WebRTC data channels; a fake in-memory transport stands in for tests.

**Tech Stack:** ES modules, Canvas 2D, `node --test`, PeerJS 1.5.4 (CDN, friends mode only).

**Spec:** `docs/specs/2026-11-14-friends-mode-design.md`

## Global Constraints

- Offline modes (vs Computer, 2P same device, Tournament, demo) behave exactly as before; all 153 existing tests stay green.
- PeerJS is loaded only when Play with Friends is opened, from a pinned CDN URL.
- Room size 2–4; code `RR-XXXX` from alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`; peer id `rubber-rumble-<XXXX>`.
- Seat colours: `#2f5fd0` blue, `#d8432f` red, `#2e9e4f` green, `#e0a020` amber.
- Seat k home angle `π + k·2π/N`; slide range `min(π/3, π/N − 0.1)`.
- Snapshots 20 Hz, guest intents 30 Hz, guest launch updates 15 Hz; protocol `v: 1`.
- Scoring unchanged: `POINTS[reason]` for the round winner, first to 4.
- No pause online; dropped guest → Medium CPU; host gone → "Room closed".

## Review Focus

1. Two tops going out on the same step in a 3–4 top round — the winner must be the survivor, never a top that is out.
2. A guest who closes the tab mid-launch — the host must not wait forever for their launch.
3. A Spin Clash between seats 2 and 3 — only those two mash, and the meter shows their colours.
4. Joining with a lowercase code, with or without `RR-`, or a code for a full/started room — clear error, no crash.
5. Phone guest on a 360 px screen with 4 players — HUD and twist pad must not overlap.

---

### Task 1: Physics for 2–4 tops

**Files:** Modify `src/physics.js`; Test `tests/physics-n.test.js`

**Interfaces:**
- Produces: `createWorld(specs[N], launches[N], rng, opts)`; tops gain `out: boolean`, `outReason`, `index`; events `{type:'out', i, reason}`; `hit` events gain `a`, `b`; `w.clash` gains `pair: [i, j]`, `mash` stays `[mi, mj]` (pair order); `clashEnd.winner` is a top index; `simulate(w, elapsed, intents[N])`.

- [ ] Write tests: (a) 3 tops, pairwise collision changes both tops' velocities for a touching pair (1,2) not involving 0; (b) a top with rpm forced to 0 in a 3-top world emits `out`, stops moving and colliding, round continues; (c) last survivor wins with the last-out reason; (d) two of three remaining go out in one step → survivor wins; (e) all live tops out the same step → higher pre-step rpm wins, equal → draw; (f) time limit picks highest-rpm live top; (g) clash between seats 1 and 2 in a 3-top world uses only intents 1 and 2 for mash and `clashEnd.winner` ∈ {1, 2}; (h) crumb zone owned by 0 slows tops 1 and 2; (i) 2-top seeded round gives identical result/time to the pre-change engine (snapshot a seeded result before editing).
- [ ] Run, see failures.
- [ ] Implement: pair loop `collidePair(w, i, j)` over live pairs; skip out tops in `moveTop`/specials/bumpers/quake; dash aims at nearest live rival; per-pair contact timers `w.contacts[key]`; end-of-step rules above; N-sized pending arrays in `simulate`.
- [ ] Run full suite: all pass.

### Task 2: Seats — launch, scoring, CPU

**Files:** Modify `src/launch.js`, `src/match.js`, `src/ai.js`, `tools/balance.mjs`; Test `tests/seats.test.js`

**Interfaces:**
- Produces: `createLaunch(spec, seat, { twistTime, seats = 2 })` with `state.home`, `state.range`; `seatAngle(seat, seats)`; `createMatch({ target, seats = 2 })`; `createCpu(diff, i)` steering at nearest live rival, mashing only when `w.clash.pair` includes it; `cpuLaunch(spec, diff, seat, seats = 2)`.
- [ ] Tests: seat angles for N = 2 equal π and 0; N = 4 slide ranges never overlap; match with 4 seats records points for seat 3; CPU in a 3-top world targets nearest live rival; CPU not in the clash pair returns `mash: 0`.
- [ ] Implement; `tools/balance.mjs` gains `ffa` mode (4 random CPU tops) printing mean round length and win share by archetype.
- [ ] Run suite + `node tools/balance.mjs ffa 200 1 thali` — mean round 15–30 s; if not, scale `HIT_DAMAGE` by an N factor only.

### Task 3: Per-player view, N tops on screen

**Files:** Modify `src/layout.js`, `src/render.js`, `src/hud.js`, `src/intro.js`, `src/twistpad.js` (none expected); Test `tests/view.test.js`

**Interfaces:**
- Produces: `computeLayout(w, h, view = 0)` → `L.view`; `arenaToScreen`/`screenToArena`/`screenToArenaVec` rotate by `L.view`; `renderer.setView(angle)` (rebuilds background); `PLAYER_COLORS` length 4; `hud.draw` accepts 2–4 players (first = this device), compact rivals list when N > 2; `drawIntro` grid of cards when N > 2; `drawLaunch` uses `s.home/s.range`; clash meter uses `clash.pair` colours; out tops fade (`t.out`).
- [ ] Tests: round trip screen↔arena with view ≠ 0; seat k home lands at the bottom centre in portrait when `view = −k·2π/N`; hud/intro draw 3 and 4 players with fake ctx.
- [ ] Implement; run suite.

### Task 4: Rooms, codes, transport

**Files:** Create `src/room.js`, `src/net.js`; Test `tests/room.test.js`, `tests/net.test.js`

**Interfaces:**
- Produces (`room.js`): `makeCode(rng) → 'XXXX'`, `parseCode(text) → 'XXXX'|null`, `createRoom(hostSeat) → room`, `addGuest(room, peerId, name) → {room, seat}|{error:'full'|'started'}`, `setSeat(room, seat, patch)`, `addCpu(room, difficulty)`, `removeSeat(room, seat)`, `canStart(room) → boolean`, `seatOfPeer(room, peerId)`. Room: `{ code, arena, started, seats: [{ kind:'host'|'guest'|'cpu', peer, name, parts, ability, skin, ready, difficulty }] }`.
- Produces (`net.js`): `PROTOCOL = 1`; `loadPeer() → Promise<Peer class>`; `hostRoom(code, { Peer }) → Promise<link>`; `joinRoom(code, { Peer }) → Promise<link>`; link `{ send(to|'*', msg), on(type, fn), onPeer(fn), onLeave(fn), close() }`; `createFakeNetwork()` returning `{ Peer }` usable by both.
- [ ] Tests: codes avoid ambiguous chars; `parseCode('rr-7k2q')`, `'7K2Q'` → `'7K2Q'`, `'RR-7K2'` → null; 5th join → `full`; join after start → `started`; `canStart` needs ≥ 2 seats and all humans ready; over fake network host + 2 guests exchange hello/lobby; a guest closing fires `onLeave` on host; wrong `v` rejected.
- [ ] Implement; run suite.

### Task 5: Host and guest game loops

**Files:** Create `src/online.js`; Modify `src/main.js`, `src/input.js` (none expected); Test `tests/online.test.js`

**Interfaces:**
- Produces: `packTops(world) / applySnapshot(mirror, snap, now)`, `interpolate(mirror, now)` (x, y, angle lerp, 100 ms behind), `mergeRemoteLaunch(state, msg)`, `launchDeadline(state) = PLACE_TIME + twistTime + 1.5`.
- main.js: `game.net = { role, me, link }`; host: remote intents/launches feed `stepBattle/stepLaunch`; broadcasts snapshot + events; guest: mirror world, own local launch, sends intents, renders host screens; event handling factored into `handleWorldEvents(w, events)` used by both.
- [ ] Tests: pack/apply round trip; interpolation midpoint; merged remote launch never moves backwards from `done`; deadline finishes a silent guest's launch.
- [ ] Implement; run suite.

### Task 6: Screens and flow

**Files:** Modify `src/ui.js`, `styles.css`, `src/main.js`, `src/settings.js`, `index.html` (none expected); Test `tests/friends-ui.test.js`

**Interfaces:** ui screens `friends` (nickname, Create, Join code field), `lobby` (seats, code, Copy/Share, Pick my top, + Computer, arena (host), Start, Leave), `waiting` (guest between rounds); actions `friends`, `create-room`, `join-room`, `lobby-pick`, `lobby-cpu`, `lobby-remove`, `lobby-arena`, `lobby-start`, `leave-room`, `copy-code`.
- [ ] Tests: lobby renders 4 seats, Start disabled until `canStart`; nickname saved/validated (1–12 chars).
- [ ] Implement; run suite.

### Task 7: Polish and proof

- [ ] README "Play with Friends" section; How-to line.
- [ ] Browser: 3 tabs (host + 2 guests) join by code; phone + laptop sizes; 2 friends + 2 CPUs; guest tab closed mid-round → CPU takes over; host closed → "Room closed".
- [ ] Full suite green.
