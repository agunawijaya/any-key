# Retrofit audit (prompt 00, stage 1)

A snapshot of the four playable programs and the Hall on 2026-10-07, before the kit retrofit. This is the
baseline that stage 2 (kit and storage migration) and stage 4 (fitting the games into the shell) work from. Line
numbers refer to the tree at commit `9bdb520`.

## Headline numbers

| What | Count |
|---|---|
| `localStorage` keys | 7 (3 preferences, 3 game saves, 1 Bop Box preference) |
| Achievements | 41 (Stickler 14, Outta Here 12, Don't Crater 15, Bop Box 0) |
| Daily challenges | 3, all numbered from the same epoch (2026-01-01 = #1) |
| Ways out of a game screen that skip a confirmation and lose a round in progress | 9 |
| Screens that browser Back skips over (it leaves the game instead) | 9 |
| Emoji used as art, icons or share-text glyphs in `components/`, `app/` and `lib/` | 253 occurrences, 113 distinct, 24 files |
| Duplicated helpers that belong in the kit | 8 families, 36 copies |
| Routes with a layout problem at 1280×720 | 3 (Device hall, Bop Box, every page under the dev indicator) |

## 1. Storage keys

Every key lives in `localStorage` of the visitor's browser. No key is read on the server.

| Key | Owner | Shape (fields) | Version | Written by |
|---|---|---|---|---|
| `anykey.theme` | Hall and every game | `"light" \| "dark" \| "system"` | none | `lib/use-prefs.ts:52` |
| `anykey.hall` | Hall | `"wall" \| "orbit" \| "device"` | none | `lib/use-prefs.ts:53` |
| `anykey.sound` | Hall and every game | `"on" \| "off"` | none | `lib/use-prefs.ts:54` |
| `anykey.bopbox.v1` | Bop Box | `{ version: "short" \| "full" }` (1981 excerpt or the whole piece) | v1 in the key | `lib/music/prefs.ts:33` |
| `anykey.stickler.v1` | Stickler | `{ wins, losses, streak, bestStreak, ladder: {tableId: stars}, daily: {date: {won, share}}, achievements: id[], skinsUsed, skin, level, hintsSeen, handfuls: {preset: {wins, masterWins}}, handfulsSetup }` | v1 in the key; saves from before Handfuls are filled in by `normalise` | `lib/stickler/progress.ts:109` |
| `anykey.outta.v1` | Outta Here | `{ runs, escapes, best: {level: {time, score}}, screens: {id: {stars, time}}, daily: {date: {won, time, share}}, achievements: id[], level }` | v1 in the key | `lib/outta/progress.ts:73` |
| `anykey.dontcrater.v1` | Don't Crater | `{ flights, landings, craters, best: {world: kmh}, landed, flagged, missions: {id: stars}, daily: {date: {speed, grade, share}}, dailyLandings, achievements: id[], flag: {shape, pattern, colors, emblem}, guide, assist, world, difficulty, scan, freeStart, freeSeed, sites: {name: {stars, speed, narrow, centre}} }` | v1 in the key; fields added later are filled from defaults by a spread | `lib/lander/progress.ts:116` |

`lib/music/original/index.ts:12` also uses `Symbol.for("anykey.bopbox.originalScores")`, a global cache in memory,
not storage.

Findings:

- Three game saves repeat the same 60-line module (`useSyncExternalStore` + `localStorage` + try/catch).
- No save has a version field inside the data; the version is only in the key name, so a shape change means a
  new key and hand-written copying.
- Achievements are stored inside each game's save, so nothing outside a game can list them.
- "Reset progress" exists in Stickler's lobby only; Don't Crater's `resetProgress` keeps the flag design and is not
  wired to a button; Outta Here has none.

## 2. Achievements

### Stickler (`lib/stickler/progress.ts:52`)

| Id | Title | How it unlocks |
|---|---|---|
| `first-light` | First Light | Win your first game |
| `stickler` | Rule Bender | Try to take more (or fewer) than the rules allow |
| `secret-four` | The Secret Four | Beat Master Sparky in Classic without a hint |
| `flawless` | Flawless | Win a game where every move was perfect |
| `hot-streak` | Hot Streak | Win three games in a row |
| `climber` | Climber | Clear five Ladder tables |
| `summit` | Summit | Clear all ten Ladder tables |
| `marienbad` | Last Year at Marienbad | Beat the 1-3-5-7 table |
| `daily-3` | Daily Habit | Win three Daily puzzles |
| `time-traveller` | Time Traveller | Win in 1981 mode |
| `rivals` | Rivals | Finish a Versus game |
| `collector` | Collector | Play with all three stick styles |
| `clean-sweep` | Clean Sweep | Make Sparky sweep 3 or more sticks in Handfuls |
| `handful-master` | Handful Master | Beat Master Sparky on every Handfuls preset |

### Outta Here (`lib/outta/progress.ts:26`)

| Id | Title | How it unlocks |
|---|---|---|
| `scape` | *SCAPE | Get out in 1980 mode |
| `under-keys` | Under the Keys | Hide under the keyboard |
| `wraparound` | Wraparound | Take an edge tunnel |
| `chain-reaction` | Chain Reaction | Break 15 glass blocks with one chain bomb |
| `rush-hour` | Rush Hour | Pick up a Chain Rush |
| `spelled-it` | Spelled It | Collect E-S-C-A-P-E in one run |
| `no-hesitation` | No Hesitation | Get out on Normal or Hard with the meter never past half |
| `untouched` | Untouched | Get out on Hard without a single hit |
| `pop` | Pop! | Pop a chaser with a bomb |
| `crash-test` | Crash Test | Crash the computer in 1980 mode |
| `daily-driver` | Daily Driver | Get out of five Daily Escapes |
| `out-of-the-machine` | Out of the Machine | Clear all thirty Screens |

### Don't Crater (`lib/lander/progress.ts:66`)

| Id | Title | How it unlocks |
|---|---|---|
| `first-touch` | First Touch | Land anywhere without breaking anything |
| `butter` | Butter | Touch down under 2 km/h |
| `postcards` | Postcard Set | Land on all four worlds |
| `flag-planter` | Flag Planter | Plant your flag on all four worlds |
| `hoverslam` | Hoverslam | Land with 90% of a perfect hoverslam's fuel left |
| `wildcatter` | Wildcatter | Hit the ground so hard you strike oil |
| `crater-maker` | Crater Maker | Leave a brand new crater |
| `ten-seconds` | Ten Seconds Flat | Land in Ten-Second mode |
| `time-traveller` | Time Traveller | Land in 1979 mode |
| `schrodinger` | Schrödinger's Lander | In 1979 mode, land between 19 and 20 km/h |
| `mission-control` | Mission Control | Clear all ten missions |
| `daily-3` | Daily Driver | Land three Daily Drops |
| `pinpoint` | Pinpoint | In Free Flight, stand on a flat narrower than 15 m |
| `sidewinder` | Sidewinder | Kill more than 500 km/h of drift and land standing |
| `oops` | Oops | Tip over for the first time |

Six flag emblems in Don't Crater unlock with achievements (`lib/lander/flags.ts:52`): butter, wildcatter,
crater-maker, time-traveller, schrodinger and mission-control each open one emblem.

### Bop Box

None. Stage 3 adds its own set (see `lib/music/manifest.ts`).

Findings:

- Two ids repeat across games (`time-traveller`, `daily-3`), so a cross-game registry must key by game and id.
- Titles repeat too: "Daily Driver" is both an Outta Here and a Don't Crater title, "Time Traveller" both a Stickler
  and a Don't Crater title. They stay (prompt §9); the Keyring always shows the game next to the title.
- None of the titles quotes an original program, so all of them stay as they are.

## 3. Daily challenges

All three use the player's **local** calendar date (`getFullYear/getMonth/getDate`) turned into a UTC midnight,
so the day changes at the player's own midnight. All three count days from **2026-01-01 = #1**, so on any given day
the three numbers are the same (2026-10-07 is #280).

| Game | Function | Seed for day `d` (0 = 2026-01-01) | What the seed picks | Share text |
|---|---|---|---|---|
| Stickler | `dailyPuzzle` (`lib/stickler/modes.ts:45`) | `mulberry32(9000 + d)` | Take limit 3, 4 or 5; a pile of 17–41, moved up until the opener can win | `Stickler Daily #N` / rules (`23 sticks · take 1–3`) / a square per move (green perfect, red gave it away, white no winning move) + `won` or `burnt` + hints; Web Share or clipboard; the page URL is added |
| Outta Here | `dailyFor` (`lib/outta/daily.ts:12`) | `70000 + (d · 7919 mod 99991)` as the screen seed | One Normal screen | `Outta Here · Daily #N` / `12.3 s · ★★☆ · 1 hit` / ten coloured squares for the run's timeline + a plus (out) or a cross (caught); clipboard only; no URL |
| Don't Crater | `dailyDrop` (`lib/lander/missions.ts:67`) | `mulberry32(51979 + 7d)`, up to 40 proposals | World, entry speed, tank and cargo; proposals a perfect hoverslam can't land with 6% fuel to spare are skipped | `Don't Crater · Daily Drop #N` / world, landing grade, speed, fuel, difficulty, assist / eight squares for the throttle over the flight + the grade glyph; Web Share or clipboard; no URL |
| Bop Box | none | | | |

Findings:

- The day-number code is copied three times. The kit's `daily.ts` must reproduce `d` exactly (local date, UTC
  arithmetic, epoch 2026-01-01) so no puzzle and no number changes for anyone.
- The seeds are game-specific and stay in the games; only the date maths and share-string assembly move.
- The share texts are built from emoji squares. They are text for other apps, not UI art, so they move out of
  `components/` into each game's `lib/` share builder (stage 4), where the guardrail allows them.

## 4. Exit paths

"Lost" means a round in progress disappears without a question.

### Hall (`/`)

| From | Way out | Goes to |
|---|---|---|
| Any style | Program card: Play now / Land here / PLAY | the game's route |
| Any style | Program card: Story | `/<route>#story` |
| Any style | Logo | `/` (reload of the Hall) |
| Any style | Browser Back | the previous site |

### Bop Box (`/music`)

| From | Way out | Goes to |
|---|---|---|
| Studio | "← any key" pill (`components/bopbox/BopBox.tsx:255`) | Hall; music stops |
| Studio | Story tab | `#story` (Back returns to the Studio) |
| Studio | Escape | nothing |
| Studio | Browser Back | Hall |

### Stickler (`/stickler`)

Screens are component state (`lobby`, `board`, `terminal`), not in the URL.

| From | Way out | Goes to |
|---|---|---|
| Lobby | "← any key" pill | Hall |
| Lobby | Escape | nothing |
| Lobby | Browser Back | Hall |
| Board, mid-game | "← Lobby" button (`Board.tsx:621`) | Lobby; **lost** |
| Board, mid-game | Escape (`Board.tsx:582`) | Lobby; **lost** |
| Board, mid-game | "← any key" pill | Hall; **lost** |
| Board, mid-game | Browser Back | Hall; **lost** |
| Board, results | Rematch (R) / Next table → / Share result / Lobby | as labelled; no H key |
| 1981 terminal | "← Lobby" button, Escape in the input | Lobby; the 1981 game is **lost** |

### Outta Here (`/outta-here`)

Views are component state (`lobby`, `screens`, `play`, `versus`, `1980`).

| From | Way out | Goes to |
|---|---|---|
| Lobby | R / S / D / V / 1 | Run / Screens / Daily / Versus / 1980 mode |
| Lobby | "← any key" pill, Browser Back | Hall |
| Screens map | "← Lobby" | Lobby |
| Play | "← Lobby" or "← Screens" (`Play.tsx:203`) | Lobby or Screens; **lost** |
| Play | Escape or P (`Play.tsx:181`) | Pause card with one button, "Carry on (P)" |
| Play | R / N | restart / new screen (**lost**) |
| Play, results | Next screen (Enter) / Again (R) / New screen (N) / Lobby or Screens | as labelled; no H key |
| Versus | "← Lobby", Escape (`Versus.tsx:112`, `:115`) | Lobby; **lost** |
| 1980 mode | "← Lobby", Escape (`Terminal1980.tsx:154`) | Lobby; **lost** |
| Any view | Browser Back | Hall; **lost** when playing |

### Don't Crater (`/dont-crater`)

Screens are component state (`lobby`, `flight`, `free`, `terminal`).

| From | Way out | Goes to |
|---|---|---|
| Lobby | "← any key" pill, Browser Back | Hall |
| Flight / Free Flight, mid-flight | ✕ button (`Flight.tsx:556`, `FreeFlight.tsx:745`) | Lobby; **lost** |
| Flight / Free Flight, mid-flight | Escape (`Flight.tsx:456`, `FreeFlight.tsx:610`) | Lobby; **lost** |
| Flight / Free Flight | P | Pause card with one button, "Resume (P)" |
| Flight / Free Flight | R | restart; **lost** |
| Flight results | Fly again (R) / Next mission (N) / Share / Lobby (Esc) | as labelled |
| Free Flight results | Fly again (R) / New site (N) / Share / Lobby (Esc) | as labelled |
| 1979 terminal | "← Lobby", Escape in the input (`Terminal1979.tsx:451`) | Lobby; **lost** |
| Any screen | Browser Back | Hall; **lost** when flying |

Findings:

- Escape means three different things: leave to the lobby (Stickler, Don't Crater, Versus, both terminals), pause
  (Outta Here play), nothing (every lobby, Bop Box).
- No pause card offers anything but "resume"; no results screen has an H key.
- Browser Back never moves between a game's own screens.
- "← Lobby" / "Lobby" / "Screens" / "← any key" name the same two destinations in five ways.

## 5. Emoji used as art or icons

253 occurrences, 113 distinct glyphs, in 24 files. Grouped by what they stand for. Typographic symbols that render
as text (arrows in `<kbd>`, ★ ratings, ♯ ♭ in music notation, ♥ hearts) are listed separately below.

| File | Lines | Glyphs | What they stand for | Reaches the UI as |
|---|---|---|---|---|
| `lib/music/arrange/index.ts` | 22–33 | 🎻 🎤 🎷 🪩 🪘 🔥 🌙 🎧 🎹 📟 🧪 🏛️ | The twelve styles | Style cards, "now playing" chip (`BopBox.tsx:309`, `:354`) |
| `lib/music/arrange/patches.ts` | 5–102 | 🥁 🎹 🎁 ✨ 🪵 🔔 🎛️ ⛪ 🪗 🎸 🪕 🎻 🔊 🎼 🌫️ 🎤 🎺 📯 🎷 🎵 😗 👾 ⚡ 🎠 🌈 🌌 😇 🌊 💎 💧 🎏 🎐 🐄 🛢️ 🪘 📟 | One icon per instrument patch (88 uses) | Band mixer rows, Solo instrument `<option>`s, Stage view |
| `lib/music/original/ours.ts` | 17–20 | 🎋 🎸 🎻 🎵 | Patches for "our setting" scores | as above |
| `components/bopbox/BopBox.tsx` | 309 | 🧪 🎻 | Remix and stand-in style chip | Now playing chip |
| `lib/stickler/modes.ts` | 8–13 | 🔥 🤲 🪜 📅 🤝 📟 | The six modes | Lobby mode cards |
| `lib/stickler/progress.ts` | 53–66 | 🔥 🙅 4️⃣ 💎 📈 🪜 🏔️ 🎞️ 📅 📟 🤝 🎨 🧹 🖐️ | Achievement badges | Lobby badge grid, unlock toasts, results card |
| `components/stickler/Board.tsx` | 55 | 🟩 🟥 ⬜ | Move quality | Results card move row and the Daily share text |
| `components/stickler/Board.tsx` | 725, 801 | 💡 | Coach / hint | Coach bubble, Hint button |
| `components/stickler/Board.tsx` | 897 | 🧹 | Sweep | Results line |
| `components/stickler/Lobby.tsx` | 157, 249, 283 | 👑 🔒 | Master beaten; locked badge | Lobby |
| `components/stickler/Stickler.tsx` | 86 | 🔊 🔇 | Sound on / off | Header button |
| `lib/outta/progress.ts` | 27–38 | ✳️ ⌨️ ↪️ 🔗 ⏱️ 🔤 ⚡ 🛡️ 💥 🪦 📅 🖥️ | Achievement badges | Lobby badge grid, toasts |
| `lib/outta/daily.ts` | 18, 37 | 🟩 🟨 🟦 🟧 🟥 ➕ ✖️ | Timeline squares, out / caught | Daily share text (also shown on the results card) |
| `components/outta/OuttaHere.tsx` | 152 | 🔊 🔇 | Sound on / off | Header button |
| `lib/lander/progress.ts` | 67–81 | 🛬 🧈 🖼️ 🚩 🔥 🛢️ 🕳️ ⏱️ 📟 🐈‍⬛ 🏆 📅 📍 🐍 🙃 | Achievement badges | Lobby badge grid, toasts |
| `lib/lander/flags.ts` | 39–60 | ⭐ 🚀 🪐 🌙 ☄️ 👽 🐱 🦖 🍕 ⚡ 🌈 👾 💎 🧈 🛢️ 🕳️ 📟 🐈‍⬛ 🏆 | Flag emblems | Drawn **into the flag art** (designer, flight scene, postcard) |
| `lib/lander/grades.ts` | 21–32 | 🧈 🟩 🟨 🙃 💦 🟧 💥 🎊 🕳️ 🛢️ 🛸 | Landing grades | Results title, share text |
| `lib/lander/worlds.ts` | 78, 117, 155, 194 | 🌕 🔴 🪨 🌍 | The four worlds | Flight chip, ready card, lobby, share text |
| `lib/lander/difficulty.ts` | 16, 18 | 🟢 🔥 | Generous / Tight fuel | Difficulty switch, share text |
| `components/dontcrater/Lobby.tsx` | 79, 99, 111–157, 266–267, 316 | ☀️ 🌙 🚩 🚀 ⛰️ ⏱️ 🎯 📅 📟 🛰️ 📏 🔒 | Day/night note, flag planted, mode cards, site bonuses, locked badge | Lobby |
| `components/dontcrater/Flight.tsx` | 539, 544, 845, 848 | ⏩ 🛟 ⬛ 🟧 🔥 ⛽ | Warp and Assist buttons; share-text throttle squares and fuel | Flight top bar; share text |
| `components/dontcrater/FreeFlight.tsx` | 730–739, 931, 1024–1030 | ⏩ 🛰️ 🛟 🎯 ↪️ ⬛ 🟧 🔥 ⛽ | Warp, Scan, Assist buttons; on target / diverted; share text | Flight top bar, results; share text |
| `components/dontcrater/FlagDesigner.tsx` | 77, 85 | 🔒 🎲 | Locked emblem; "Surprise me" | Flag designer |
| `components/dontcrater/Recorder2D.tsx` | 66, 107 | 🎯 🛰️ | Target; scan used | Flight recorder |
| `components/dontcrater/scene.ts` | 822 | 🚩 | Flag-landing line label | Drawn on the canvas |
| `components/dontcrater/DontCrater.tsx` | 74 | 🔊 🔇 | Sound on / off | Header button |

Typographic symbols used as **icons** (not emoji; the guardrail allows them, but stage 4 replaces the standalone
button icons with drawn SVG so they match the rest of the icon set):

| File | Lines | Glyphs | Role |
|---|---|---|---|
| `components/dontcrater/Flight.tsx`, `FreeFlight.tsx` | 553/742, 557/746 | ▶ ❚❚ ✕ | Pause/resume and close buttons |
| `components/dontcrater/Flight.tsx`, `FreeFlight.tsx`, `Lobby.tsx`; `components/stickler/Board.tsx`, `Lobby.tsx`; `components/outta/Play.tsx`, `ScreensMap.tsx` | various | ★ ☆ | Star ratings |
| `components/outta/Play.tsx`, `Versus.tsx` | 227, 169 | ♥ | Hearts |
| `components/outta/Play.tsx` | 363 | ▲ ▼ ◀ ▶ | Touch pad arrows |
| `components/hall/DeviceView.tsx` | 189, 192 | ◀ ▶ | Prev / next keys |
| `components/hall/OrbitView.tsx` | 173, 179 | ← → | Prev / next buttons |
| `components/hall/WallView.tsx` | 196 | ↻ | "Another one" |
| `components/dontcrater/Terminal1979.tsx` | 418, 456 | ⌫ | Keypad backspace |

Arrows inside `<kbd>` (↑ ↓ ← →), ♯ and ♭ in note names, ✓ and ✗ in sentences, and "←" before a label are text and
stay.

## 6. Duplicated helpers

| Family | Copies | Where | Kit home |
|---|---|---|---|
| Seeded PRNG (mulberry32) | 4 | `lib/stickler/sparky.ts:22`, `lib/lander/missions.ts:41`, `lib/lander/terrain.ts:61`, `lib/outta/engine.ts:69` | `lib/kit/rng.ts` (`mulberry32`, byte-for-byte the same output, so no seeded level changes) |
| Hash noise for scenery | 2 | `components/dontcrater/scene.ts:80`, `freescene.ts:555` | stays in Don't Crater (scene-only, one game) |
| Local date → day number and `YYYY-MM-DD` key | 3 | `lib/stickler/modes.ts:46`, `lib/outta/daily.ts:13`, `lib/lander/missions.ts:68` | `lib/kit/daily.ts` |
| Share (Web Share, clipboard, "Copied") | 4 | `components/dontcrater/Flight.tsx:788`, `FreeFlight.tsx:972`, `components/stickler/Board.tsx:870`, `components/outta/Play.tsx:310` | `lib/kit/share.ts` + `components/kit/ShareButton.tsx` |
| Audio context, master gain, limiter | 5 | `lib/sound.ts:3`, `lib/stickler/sfx.ts:13`, `lib/outta/sfx.ts:10`, `lib/lander/sfx.ts:14`, `lib/music/engine.ts:38` | `lib/kit/sound.ts` (one context and master bus for the sound effects; Bop Box's synthesiser keeps its own context and follows the master volume and mute) |
| "Ignore keys while typing" check | 6 | `AnyKeyToy.tsx:64`, `BopBox.tsx:210`, `stickler/Board.tsx:581`, `outta/Lobby.tsx:110`, `outta/Play.tsx:167`, `dontcrater/Flight.tsx:454` (input elements only) | `lib/kit/keys.ts` |
| Saved progress store (`useSyncExternalStore` + storage) | 5 | `lib/stickler/progress.ts`, `lib/outta/progress.ts`, `lib/lander/progress.ts`, `lib/music/prefs.ts`, `lib/use-prefs.ts` | `lib/kit/save.ts` |
| Program header (back pill, brand, Play/Story tabs, sound, theme) and unlock toasts | 4 + 3 | `BopBox.tsx:254`, `Stickler.tsx:60`, `OuttaHere.tsx:126`, `DontCrater.tsx:48`; toasts in the last three | `components/kit/GameShell.tsx`, `components/kit/KeyringToast.tsx` |

Not moved: `useNight` and `useReducedMotion` in `components/dontcrater/hooks.ts` (the kit gets its own
`useReducedMotion` that also honours the Keyring override; Don't Crater switches to it in stage 4), and the time
formatters, which differ per game on purpose.

## 7. Layout at 1280×720

Measured with Playwright at 1280×720, light and dark. Long scrolling pages (the Wall, the lobbies, the docs) are
meant to scroll; the table lists what is clipped, covered or out of reach when it should not be.

| Route | Problem | Cause |
|---|---|---|
| Every route in `next dev` | The Next.js dev indicator ("N") sits on the logo / back pill at the top left | default indicator position; `devIndicators.position` is not set in `next.config.ts` |
| `/` Device | The device is 1204 px tall: its bottom row (keys, brand plate) is cut at the fold and the cartridge shelf is entirely below it | fixed device height with no fit-to-viewport rule |
| `/` Orbit | 823 px: the footer pushes the page 103 px past the fold; nothing important is cut | the stage is a full viewport tall above the footer |
| `/music` Studio | The fixed transport bar covers the lower half of the piano keyboard; the tune list's last rows (I–K) and the whole style grid are below the fold | the studio is taller than the viewport and the transport is `position: fixed` without reserving its height |
| `/stickler` board | fits | |
| `/outta-here` play | the play field fits; the rules legend continues below, by design | |
| `/dont-crater` flight | fits; the BURN button sits 20 px from the bottom edge | |

## 8. Other notes for later stages

- `docs/<id>/HOW-TO.md` today explains how to run and use the **original** program. The new `HOW-TO-PLAY.md` is the
  rebuild's manual. Stage 5 renames the file as the prompt asks, moves the "running the original today" material
  into `ORIGINAL-ARCHITECTURE.md`, and writes the manual fresh.
- Fonts come from `next/font/google`, which downloads them at build time and serves them from the app: no runtime
  request, but a build needs the network once. Recorded in ADR 0002.
- No raster image files are tracked; the sound bank in `public/soundfont/` is the approved audio exception.
- No runtime network URLs were found in `components/`, `lib/` or `app/`.
