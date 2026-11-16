# Earned kit, a combo for every pair, Rising difficulty, and cloud save

Status: waiting for approval. Nothing is built yet.

## Why

Friends enjoy Rubber Rumble together but drift away, and playing alone feels flat: every part and ability
is available from the first minute, so there is nothing to work towards, and the computer never grows with
the player. Progress (coins, skins, tournament rungs) also lives only in one browser and is lost when
the browser data is cleared or the player changes phone.

## Goals

1. **Solo players earn their kit.** Alone, a player starts with a small kit and wins the rest by climbing
   the School Tournament.
2. **Every eraser + lead pair has a combo.** All 42 pairs get a named combo; none says "No combo yet".
3. **Friends get everything.** Whenever two or more humans play (same device or online), every part,
   ability and combo is available to everyone.
4. **The computer grows with the player.** A "Rising" difficulty steps up as the player wins and eases
   off when they lose. It should feel harder than before, never extreme.
5. **Progress survives.** A player can sign in with Google and get their progress back on any device.

## Non-goals

- No part, ability or combo is ever bought with coins or money. The shop stays cosmetic.
- No login wall: the game stays fully playable without signing in.
- No leaderboards, friends lists or online profiles.
- No server-side checking of progress. A player who edits their own save only affects their solo game.
- No parental-consent flow (see "Known risks").

## Anti-goals (these would make it a failure)

- A solo lock that can be walked around (for example by opening a room with only a computer in it).
- Unlocks that can be farmed without real play.
- A first screen full of padlocks that puts new players off before their first fight.
- Combos that make every top simply stronger, so combos stop being a choice.
- Anyone losing progress because they signed in.

## Approaches considered

**Combos for every pair**

1. Every combo is a pure bonus. Simplest, but when everything is boosted nothing is, and 28 new bonuses
   need hand-balancing.
2. Star and standard combos, each earned by winning three matches with that pair. Gives a reason to try
   every pair, but completing all 42 takes up to 126 wins.
3. **Chosen: star and standard combos, unlocked in batches by School Tournament rungs.** Faster, no grind.
   The cost, accepted: after the fifth rung there is nothing left to earn.

**Saving progress**

1. **Chosen: Sign in with Google, saved in Firebase.** One tap, no passwords to look after, the free plan
   does not pause when the game is quiet.
2. Sign in with Google, saved in Supabase. Longer setup; free projects pause after a week of no activity.
3. A save code with no accounts. Holds no personal data, but players must keep the code safe.

## Part 1: the earned kit

### What a solo player has

The kit is worked out from School Tournament progress, which the game already saves (`tournament.rung`
is the next rung to fight; `champion` is true after the Principal). Nothing new is stored for it.

Beating an opponent wins their eraser, their lead and their ability ("That eraser? Mine now.").

| When | Erasers added | Leads added | Abilities added | Pairs you can build |
|---|---|---|---|---|
| Start | Apsara Non-Dust, Doms Neon Hexagon | Nataraj HB, Doms Y1+ | Recentre, Second Wind | 4 |
| Beat Class Bully | Nataraj 621 Plasto | Platinum | Smash Dash | 9 |
| Beat The Backbencher | Fruit-Scented Fancy Eraser | (already owned) | Crumb Trail | 12 |
| Beat Class Monitor | Camlin Dust-Free | Camlin Exam | (already owned) | 20 |
| Beat The Topper | Faber-Castell Dust-Free | Faber 2B | Graphite Shield | 30 |
| Beat The Principal | Apsara Jumbo | Absolute | Plant | 42 |

*My call:* a combo is switched on as soon as the player owns both of its parts. So each rung is a batch:
new parts, and every combo those parts make (+5, +3, +8, +10, +12 combos). There is no separate
"combo locked" state to track or explain.

*My call:* the starting kit is 2 erasers, 2 leads and 2 abilities (smaller than the "about 3 each" first
suggested), because five of the seven erasers belong to the five opponents and winning them is the reward.
The four starting pairs include two star combos (Deadly Duo, Doms Double), so a new player meets combos
in their first match.

### Where the earned kit applies

- **Earned kit:** Play vs Computer, School Tournament, and any online room in which only one human is
  playing (the rest are computers).
- **Full kit:** 2 Players on the same device, and any online room with two or more humans.

Online rooms, in detail:
- The build screen opened from the lobby shows the full kit when the room has two or more humans at that
  moment, otherwise the room creator's earned kit.
- If the room is down to one human when the creator presses Start, and their top or ability is not in
  their earned kit, their seat goes back to "not ready" with the note "Pick again: that top is for games
  with friends."
- A friend dropping out mid-match changes nothing: the match finishes as it is.
- Computer seats in a one-human room build from the creator's earned kit.

### The build screen

- Locked erasers, leads and abilities are shown greyed with a small padlock and the line
  "Beat The Topper to win this" (the opponent who holds it). They cannot be picked.
- In full-kit games nothing is locked.
- After a tournament win, the result screen shows what was won: "You won: Faber-Castell Dust-Free,
  Faber 2B, Graphite Shield, and 10 new combos."
- The player's remembered last top is replaced by a starting-kit top if it is not in their kit.

### Fairness against the computer

In solo games the computer builds only from the player's earned kit (Hard still counter-picks, but inside
that kit). Tournament opponents keep their fixed tops, which is how the player sees what they will win.

### Players who already have the game

*My call (the owner asked me to choose):* the kit follows tournament progress for everyone, including
people who already play. Nobody paid for anything, coins and skins are untouched, and it gives the
owner's friends the new goal. A School Champion keeps everything; someone who never played the tournament
drops to the starting kit when playing alone, and still has everything with friends.

The first time such a player opens the game after the update, a one-time note explains it: "New: win
parts in the School Tournament. With friends you still have everything."

## Part 2: a combo for every pair

- The **13 existing good combos** stay exactly as they are and are shown as **star combos** (gold ★ note).
- **Sleepy Bench** stays as the one bad combo.
- The **28 pairs with no combo** each get a **standard combo**: a name, one stat +1 and one stat −1.
  Flavour, not free power. Shown as a plain note without the star.
- The line "No combo yet. Try matching brands!" goes away. The hint becomes "★ Star combos come from
  matching brands."

Proposed standard combos (*my call*; the builder may swap a stat if the balance check below fails):

| Eraser | Lead | Name | Up | Down |
|---|---|---|---|---|
| Apsara Non-Dust | Doms Y1+ | Smooth Operator | Glide | Attack |
| Apsara Non-Dust | Camlin Exam | Class Test | Stability | Speed |
| Apsara Non-Dust | Faber 2B | Steady Hand | Defense | Speed |
| Apsara Jumbo | Doms Y1+ | Sliding Almirah | Glide | Stability |
| Apsara Jumbo | Camlin Exam | Front Bencher | Defense | Speed |
| Nataraj 621 Plasto | Doms Y1+ | Paper Plane | Glide | Defense |
| Nataraj 621 Plasto | Camlin Exam | Surprise Test | Attack | Stamina |
| Nataraj 621 Plasto | Faber 2B | Blunt Force | Attack | Speed |
| Doms Neon Hexagon | Nataraj HB | Sharp Corners | Attack | Defense (changed from Stability by the balance check) |
| Doms Neon Hexagon | Platinum | Recess Bell | Speed | Stamina |
| Doms Neon Hexagon | Absolute | Unbreakable Hex | Durability | Glide |
| Doms Neon Hexagon | Camlin Exam | Protractor | Stability | Attack |
| Doms Neon Hexagon | Faber 2B | Hex Tank | Defense | Speed |
| Camlin Dust-Free | Nataraj HB | Homework Done | Stamina | Attack |
| Camlin Dust-Free | Platinum | Last-Minute Revision | Speed | Stability |
| Camlin Dust-Free | Absolute | Full Marks | Durability | Speed |
| Camlin Dust-Free | Doms Y1+ | Free Period | Glide | Defense |
| Camlin Dust-Free | Faber 2B | Double Period | Stamina | Speed |
| Faber-Castell Dust-Free | Nataraj HB | Neat Handwriting | Stability | Attack |
| Faber-Castell Dust-Free | Platinum | Late Runner | Speed | Defense |
| Faber-Castell Dust-Free | Absolute | Brick Wall | Defense | Glide |
| Faber-Castell Dust-Free | Doms Y1+ | Polished Floor | Glide | Stamina |
| Faber-Castell Dust-Free | Camlin Exam | Revision Week | Stamina | Speed |
| Fruit-Scented | Nataraj HB | Tiffin Break | Attack | Defense |
| Fruit-Scented | Absolute | Hard Candy | Durability | Stamina |
| Fruit-Scented | Doms Y1+ | Jelly Slide | Glide | Stability |
| Fruit-Scented | Camlin Exam | Lunchbox Treat | Stability | Speed |
| Fruit-Scented | Faber 2B | Bubblegum | Defense | Glide |

**Balance check (must pass before release):** run `tools/balance.mjs` over all 42 pairs with every combo
on. No pair's overall win rate may be higher than today's best pair or lower than today's worst pair by
more than 3 points. Also check each tournament rung is winnable with the kit a player has when they
reach it: the best top in that kit, played by the Hard computer, must win at least 35% of rounds against
that rung's opponent. If the starting kit cannot beat the Class Bully at that rate, the rungs are
re-tuned, not the kit.

## Part 3: Rising difficulty

- The difficulty screen for Play vs Computer gets a new first choice, **Rising** (marked recommended).
  Easy, Medium and Hard stay as they are.
- Rising has **7 levels**. Level 1 plays like today's Easy, level 4 like Medium, level 7 like Hard. The
  levels in between blend the computer's launch power, launch accuracy, perfect-release chance, reaction
  time and spin-clash tapping evenly between those points. Combo and ability choices behave like Easy at
  levels 1–2, Medium at 3–5 and Hard at 6–7.
- A new player starts at **level 2**. Two match wins in a row move up one level; two match losses in a
  row move down one. It never leaves 1–7.
- The screen shows the level ("Rising · level 3 of 7") and says when it changes ("The computer is
  getting better: level 4").
- A match win pays 30 coins at level 1 rising to 80 at level 7 (30, 40, 45, 55, 65, 70, 80).
- The School Tournament keeps its own fixed difficulties.

Accepted weakness: a player can lose on purpose to stay low. It only makes their own solo game easier and
pays fewer coins, so it is left alone.

## Part 4: two holes closed

- A room with only one human uses the earned kit (above), so opening a room with a computer is no way
  round the solo kit.
- *My call:* 2 Players on the same device pays no coins, and an online match pays coins only if two or
  more humans started it. One person can otherwise win coins against nobody.

## Part 5: cloud save (Sign in with Google)

### What the player sees

- Title screen: a small "☁ Save my progress" button. Tapping it opens a sheet: what is saved (tournament
  progress, coins and skins, Rising level), "Sign in with Google", and a line saying the game can always
  be played without signing in.
- Signed in: the button shows the player's first name and "Saved ✓" (or "Saving…" / "Offline: will save
  later"). The sheet offers "Sign out".
- First sign-in on a device that already has progress: both are merged, nothing is lost.

### What is saved

One small document per player in Firestore at `saves/{their user id}`:
`{ v: 1, updatedAt, save: { tournament, wallet, rising } }`. No name, email or photo is written to it.
Sound on/off, the nickname and the last-used top stay on the device.

### Merging (so signing in can never lose progress)

- Tournament: the further rung wins; champion if either is.
- Wallet: owned skins are combined; coins take the higher number; the equipped skin is this device's.
- Rising: the higher level wins.

The merge is a pure, tested function. It runs when the player signs in and whenever the game loads the
cloud copy; the merged result is written to both the device and the cloud.

### When it syncs

- Loads the cloud copy on start (if signed in) and when the tab becomes visible again.
- Saves after every finished match and every shop purchase, at most once every few seconds.
- If offline or Firebase is unreachable, the game carries on from the device copy and saves later.
  Sync must never block or break play.

### How it is built

- Firebase Authentication (Google provider, pop-up sign-in) and Cloud Firestore.
- Firebase's code is loaded from Google's CDN only when the player opens the save sheet or was signed in
  last time, so players who never sign in download nothing extra.
- The Firebase web settings (`apiKey`, `projectId`…) are public by design and live in a small config file.
- Security rules: a player can read and write only `saves/{their own id}`, and only a document with the
  three expected fields. The builder writes the rules; the owner pastes them into Firebase.
- Sign-out keeps the progress on the device (*my call*): it is their phone.

### What the owner must set up (cannot be done for them)

1. Create a Firebase project (free plan) at console.firebase.google.com.
2. Add a Web app and send the settings block it shows.
3. Authentication → Sign-in method → turn on Google.
4. Authentication settings → add `rubber-rumble.vercel.app` to the authorised domains.
5. Create a Firestore database (Mumbai region) and paste in the rules the builder provides.

## Build order

1. **Stage 1:** Parts 1–4 (earned kit, combos, Rising, the two holes). Ships on its own.
2. **Stage 2:** Part 5 (cloud save). Needs the Firebase settings from the owner.

## Known risks

- **Children's data.** Google sign-in means Firebase holds the email addresses of school-age players.
  India's data protection law is stricter for under-18s. The owner should read up on this before
  promoting the game widely. The save document itself holds no personal details.
- **Pop-up sign-in** can be blocked by some in-app browsers (for example a link opened inside Instagram).
  The sheet says "Open in Chrome or Safari to sign in" if the pop-up fails.
- **Shared phones.** Progress belongs to the device until someone signs in; a sibling on the same phone
  shares it.
- **Nothing left to earn after the Principal.** Accepted with approach 3.
- **The promo video** shows every part available on the solo build screen; after this change a new solo
  player sees padlocks there.

## Left to the builder

- The exact look of padlocks, star notes and the save sheet, in the game's notebook style.
- How Rising's in-between levels blend each number, as long as levels 1, 4 and 7 match Easy, Medium, Hard.
- Swapping a standard combo's up or down stat where the balance check demands it.
- File layout and test structure, following the existing code (pure logic modules with `node --test`).
