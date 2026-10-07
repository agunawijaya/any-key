# Prompt 00 — Foundation retrofit: kit, game contract, navigation standard, Keyring, docs

> Run in Claude Code from `E:\Projects\BASIC Programs\Porting\web`, **alone** (no other session may run while
> this one does). Run it only after the owner has committed the current state, so the retrofit is one clean diff.
> Recommended: Claude Opus 5.5, effort xhigh.
> **Owner checkpoint** after Stage 3 (hero frames of the shell and the Keyring). Stop there and wait.

Any Key already has four playable programs and a Hall in three styles. They were built one by one, without a
shared foundation. This prompt adds that foundation underneath them without changing how the games play: a kit,
a typed game contract, one navigation standard, a cross-game collection called **Keyring**, the documentation set
every later prompt expects, and the tooling that lets the architect review screenshots. Visual polish of the
individual games is **not** part of this prompt; it comes in separate polish prompts after this one.

## 0. Read first

1. `CLAUDE.md` (hard rules, new), `AGENTS.md` (Next.js 16 notes: read the relevant guide in
   `node_modules/next/dist/docs/` before writing Next.js code), `.claude/skills/retro-reborn-builder/SKILL.md`.
2. `README.md`, `lib/catalog.ts`, `lib/prefs.ts`, `lib/use-prefs.ts`, `lib/sound.ts`, `lib/docs.ts`, everything in
   `components/hall/`, `components/kit/`, `components/ui/`, `app/layout.tsx`, `app/page.tsx`.
3. For each game, its lobby, play screen, progress file and docs:
   Bop Box (`lib/music`, `components/bopbox`, `docs/music`), Stickler (`lib/stickler`, `components/stickler`,
   `docs/23mtch`), Outta Here (`lib/outta`, `components/outta`, `docs/escape`), Don't Crater (`lib/lander`,
   `components/dontcrater`, `docs/lander`).
4. The originals, read-only, outside the repo: `E:\Projects\BASIC Programs\Porting\src\*.bas`. Only needed to
   verify facts for the new `NOTES.md` files.
5. This whole prompt. §11 (Done) overrides earlier sections where they disagree.

In your first message: the five-line summary of the hard rules, "Prompt 00, I own the kit, dev server 3210".

## 1. Non-goals (do not do these)

- Do not change any game's rules, balance, modes or art direction. Where a screen must change for the
  navigation standard, change the chrome around the game, not the game.
- Do not rename routes or move existing game folders. Record the existing names in the folder map instead.
- Do not migrate away from Next.js, React or the existing CSS-modules approach.
- Do not lose players' existing progress. Every stored key is migrated (§3.3).

## 2. Stage 1 — Audit (report, no code changes)

Produce `docs/RETROFIT-AUDIT.md` with tables for:

1. **Storage keys** used by every game and the Hall (`localStorage` keys, shapes, versions).
2. **Achievements** that exist today per game (id, title, how unlocked). Bop Box has none.
3. **Daily challenges**: how each game picks today's seed, its numbering epoch and share text format.
4. **Exit paths**: every way out of every screen today (buttons, keys, browser Back), and where it goes.
5. **Emoji used as art or icons** anywhere in the UI (file, line, glyph, what it stands for).
6. **Duplicated helpers** (RNG, timing, date, share, sound, keyboard) that belong in the kit.
7. **Layout overflow at 1280×720** for every route (anything clipped, covered or needing scroll that should not).
   Known from the architect's review: the Device hall is cut off at the bottom; Bop Box's transport bar covers
   the piano keyboard; the Next.js dev indicator overlaps the logo.

## 3. Stage 2 — Kit, game contract, storage migration

### 3.1 The kit (`lib/kit/` for logic, `components/kit/` for shared React pieces)

| Module | What it provides |
|---|---|
| `rng.ts` | Small seeded PRNG (e.g. sfc32) with `int`, `float`, `pick`, `shuffle`, `fork(label)` |
| `daily.ts` | Today's seed from the player's **local** calendar date; daily number with a per-game epoch, so the numbers games already show (e.g. Outta Here's) do not jump; share-string builder (title, number, emoji grid, score line, URL) |
| `save.ts` | Versioned, namespaced storage: `createStore(gameId, version, migrations)`; SSR-safe; every access in try/catch; falls back to memory |
| `achievements.ts` | Registry: each game declares its achievements in its manifest; `unlock(gameId, id)` emits an event the Keyring listens to; idempotent |
| `stats.ts` | Plays, wins, best scores, streaks per game, written through `save.ts` |
| `appearance.ts` | Move `prefs.ts`/`use-prefs.ts` here (re-export from the old paths until every import is updated, then delete the shims) |
| `sound.ts` | Move `lib/sound.ts` here; one master mute and volume the Hall and every game respect |
| `share.ts` | Clipboard + Web Share with a visible "Copied" confirmation |
| `keys.ts` | Keyboard helpers: ignore shortcuts while typing in inputs, standard Esc / R / H handling |

Replace the duplicated helpers you listed in the audit with kit imports where it is a mechanical swap. Where a
game's own helper does something game-specific, leave it and note why in that game's `ARCHITECTURE.md`.

### 3.2 The game contract (`lib/kit/manifest.ts`, used by `lib/catalog.ts`)

Turn the `Program` type into a `GameManifest` that every game exports from `lib/<id>/manifest.ts`, and make
`lib/catalog.ts` a list of imports. Keep every field the Hall uses today (palette, stats, modes, moons, trivia).
Add:

- `status: "playable" | "coming-soon"`, `route`, `category`, `players` ("1", "1–2"), `sessionMinutes`.
- `inspiredBy: { originalTitle, file, author?, publisher, year, circa? }` (rename from `original`).
- `emblem`: SVG path data on a 24×24 grid, drawn for this game (used on Hall cards, keycaps and share cards).
- `daily?: { epoch: string }` for games that have a daily.
- `achievements: { id, title, hint, tier: "common" | "rare" | "legendary", secret?: boolean }[]`.

Register **Desert** as `coming-soon` with id `desert`, title "Desert (in design)", route `/desert`, and a
neutral placeholder card in every Hall style. Its real title comes with its own prompt.

### 3.3 Storage migration

Move each game's progress onto `save.ts` with a migration that reads the old keys, writes the new shape and
leaves the old keys alone for one version (so a rollback does not lose data). Write tests that load a fixture of
today's real shape for each game and assert that every achievement, best score, ladder position, unlocked
screen and flag design survives. Add a "Forget my data" action per game and one for everything (in the Keyring
settings), each with a confirmation.

## 4. Stage 3 — Game shell, navigation standard, Keyring (then STOP)

### 4.1 Navigation standard (write `docs/NAVIGATION.md`, then build it)

- Two destinations with fixed names: **Game menu** (each game's lobby) and **Back to the Hall**.
- `components/kit/GameShell.tsx` wraps every game route. Its top bar shows "← Back to the Hall" at the left as
  a clearly labelled button (replace today's small "any key" pill), then the game title and its "inspired by"
  line, then the Play/Story switch, sound and appearance.
- On the game menu, Escape returns to the Hall.
- During play: a visible **Pause** button with an `Esc` hint. `components/kit/PauseMenu.tsx` with the fixed
  order **Resume · game items · How to play · Settings · Game menu · Back to the Hall**. Games pass their own
  items; they do not reorder the rest.
- `components/kit/Results.tsx` for games that use the shared results card, with the fixed order **Play again
  (R) · Game menu · Back to the Hall (H)**. Games with their own results screen keep it but must use the same
  three actions, labels, keys and order.
- Leaving mid-game asks for confirmation only when progress would be lost; otherwise auto-save and offer
  "Continue" on the game menu.
- Browser Back moves Play → Game menu → Hall. Use the URL (search params or hash) for the in-game screen.
- First visit to any game shows a small, dismissible hint "Esc — pause and menu".
- Rename in-game "← Lobby" buttons to "Game menu" everywhere.

### 4.2 Keyring — the cross-game collection

Every achievement in every game is a **keycap**. Collecting them fills the player's **Keyring**: one profile
across the whole collection, local only, no accounts, no purchases.

| Piece | Rule |
|---|---|
| Keycaps | One per achievement. Legend = the game's emblem; colour = the game's accent; tier sets the material: common = matte plastic, rare = translucent with an inner glow, legendary = metal with an engraved legend. Secret ones show as a blank cap with "?" until earned |
| XP and level | Common 10, rare 30, legendary 80 XP; finishing any daily +5. Levels on a gentle curve (level n needs 40·n XP). Level titles are our own keyboard-themed words (e.g. Home Row, Shift, Caps Lock, Function, Escape Artist… you write the list, ~12) |
| Daily streak | One streak across the collection: playing any game's daily keeps it alive. Shown as a row of seven small keys for the week |
| Today strip | In the Keyring and on the Hall: which games have a daily, done or not done today |
| Unlock moment | Anywhere in the collection, a toast where the keycap drops onto a little ring with a spring and a soft click (silent with sound off; a simple fade with reduced motion) |
| Entry points | A Keyring button in the top bar of all three Hall styles and in every GameShell; a full page at `/keyring` |
| Bop Box | Give it 6–8 achievements of its own (e.g. play every tune, try every style, finish a full-length piece, download a MIDI) so every game contributes |

The Keyring page: the ring itself as the hero (all collected caps hanging from it, drawn in SVG/Canvas, gently
swaying, drag to spin), the level and XP bar, the week streak, and below it a keyboard-like grid of every
keycap grouped by game (earned, unearned with hint, secret).

**Art direction "Keyring".** Light: a warm cream keyboard deck, soft shadows, caps like real ABS plastic.
Dark: the same deck at night with per-key backlight in each game's accent. Signature moment: on level-up, a
light wave runs across every collected cap in order, like a keyboard's RGB sweep, and the new level title is
stamped onto a blank cap. Everything drawn in code (hard rule 3). 60 fps at 1920×1080.

### 4.3 Hero frames, then STOP

Render live (not mockups), each at 1920×1080 in **light and dark**:

1. The Keyring page with about 20 caps collected across four games, mid-sway.
2. The pause menu over Don't Crater's flight scene, and the shared results card over Stickler.
3. The Hall (Wall style) with the new top bar, the Keyring button, the Today strip and the Desert placeholder.

Critique them at least five rounds ("would this be the README hero image?"), save them to
`docs/media/hero/retrofit/`, report what you changed between rounds, then **stop and wait for the owner**.

## 5. Stage 4 — Fit the four games into the shell

For each game: wrap it in `GameShell`; use `PauseMenu`/`Results` or align its own screens to the standard;
declare its manifest and emblem; route its achievements through the kit so they reach the Keyring; use the
kit daily with its own epoch; replace every emoji used as art or icon with an SVG drawn for it (the audit list),
keeping the meaning. Fix the shell-level layout overflow from the audit (Device hall at 1280×720, Bop Box
transport over the keyboard, dev indicator — set it to the bottom-right in `next.config.ts`). Do not redesign
anything else; write down every visual weakness you notice in `docs/PROGRESS.md` under "Polish candidates".

## 6. Stage 5 — Documentation

1. `docs/ARCHITECTURE.md`: how the app is put together, the kit API, the manifest, the shell, the Keyring,
   storage and migrations, and **§Folder map**, a table with one row per game:
   `id · route · lib/ · components/ · docs/ · preview` (e.g. `escape · /outta-here · lib/outta ·
   components/outta · docs/escape · components/previews/OuttaPreview.tsx`). New games use one id everywhere:
   `app/<id>/`, `lib/<id>/`, `components/<id>/`, `docs/<id>/`.
2. `docs/adr/`: 0001 keep Next.js; 0002 zero-raster visual policy (and the sound bank exception); 0003 kit
   location and contract; 0004 Keyring and storage.
3. `docs/templates/`: ABOUT, HOW-TO-PLAY, ARCHITECTURE, ORIGINAL-ARCHITECTURE, CHANGES-FROM-ORIGINAL, NOTES,
   each with its headings and one-line guidance.
4. Align the four games' docs: rename `HOW-TO.md` → `HOW-TO-PLAY.md` and `PORT-ARCHITECTURE.md` →
   `ARCHITECTURE.md` (update `lib/docs.ts`, the Story tabs and every link); write `CHANGES-FROM-ORIGINAL.md`
   and `NOTES.md` for each from the existing docs plus the source (verified facts, quirks, simulation results
   already in the check scripts). Mermaid only; validate every diagram renders.
5. `docs/PROGRESS.md` with one row per game (status, docs, achievements, daily, last prompt, polish
   candidates). Exclude it from formatters so later parallel sessions can each edit their own row.
6. Update `README.md` (Keyring, navigation, new scripts) and `prompts/README.md` (mark 00 done).

## 7. Stage 6 — Tooling and tests

1. Add Playwright (dev dependency; this prompt runs alone, so installing is fine) with a config that starts its
   own server on port **3211** and never touches 3210.
2. `npm run e2e`: every exit path in every game (Escape on game menu, pause menu items, results R/H, browser
   Back, confirm-on-leave), the Keyring unlock toast from one real unlock per game, appearance switching.
3. `npm run shots`: every route and key screen × light/dark × 1280×720 and 1920×1080 into
   `docs/media/shots/` as JPEG (quality ~70). Screenshots in `docs/media/` are documentation, not game art, so
   the zero-raster rule does not apply to them. Each later prompt adds its own screens to this script's list.
4. Add Vitest for `lib/kit` (rng determinism, daily numbering and epochs, save migrations, achievements
   idempotency, XP curve). Keep the existing `check:*` scripts and add `npm run check` that runs type-check,
   lint, Vitest and every `check:*`.
5. A guardrail script in `npm run check`: fails on raster images outside `docs/` and `public/soundfont/`, on
   emoji characters in `components/` and `app/`, and on runtime network URLs.

## 8. Settings and controls (shell level)

| Where | What |
|---|---|
| Top bar | ← Back to the Hall · title · Play/Story · Keyring · sound · appearance (Light / Dark / System) |
| Keyboard | `Esc` pause / back to Hall from game menu · `R` play again on results · `H` Hall on results · `K` open Keyring · `?` shortcuts sheet |
| Keyring settings | Forget a game's data · forget everything · reduced motion follows the system (with an override) |

## 9. Content rules

All new copy (level titles, Keyring text, hints) is ours, all ages, short and warm. No original program text.
Achievement titles that exist today stay as they are unless they quote an original.

## 10. Parallel rules

This prompt runs alone and owns `lib/kit`, `components/kit`, `lib/catalog.ts` and the Hall. Use the dev server
already running at http://localhost:3210 for looking around (start it with `npm run dev -- -p 3210` if it is not
running); Playwright uses its own 3211. No commits, no pushes.

## 11. Done when

- [ ] Audit written; owner approved the Stage 3 hero frames.
- [ ] Every game runs inside `GameShell`, follows the navigation standard, and its e2e exit paths pass.
- [ ] Existing progress migrates (tests with fixtures pass); "Forget my data" works.
- [ ] Every achievement in all four games appears as a keycap; XP, levels, streak and Today strip work.
- [ ] No emoji used as art or icons remain; the guardrail script passes.
- [ ] Device hall and Bop Box fit at 1280×720 without covered controls.
- [ ] Docs: ARCHITECTURE with folder map, NAVIGATION, 4 ADRs, templates, six docs per game, PROGRESS.
- [ ] `npm run check`, `npm run e2e`, `npm run shots` and `next build` all pass.

## 12. When you finish, report

What you built; the audit's headline numbers; migration results; the list of "polish candidates" you noticed per
game; deviations from this prompt and why; known gaps; the exact commands to run everything; and the token and
time you spent if your tool shows it.
