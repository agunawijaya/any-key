# Prompt 01 — Stickler: "Handfuls" mode (take 2–3, 3–5 and other ranges)

> Run in Claude Code from `E:\Projects\BASIC Programs\Porting\web`. Runs in parallel with prompt 02 (Don't Crater)
> and with the Bop Box session (Phase 2, "Original Score"). See §8 for the parallel rules.
> Recommended: the strongest model available, effort high. No owner checkpoint is needed before building: the owner
> has approved the idea and left the ranges to us. Report back in Bahasa Indonesia when done.

## 0. Read first

1. `CLAUDE.md` and `AGENTS.md` (this Next.js version differs from your training data: read the relevant guide in
   `node_modules/next/dist/docs/` before using any Next API you have not seen in this repo).
2. The four Stickler docs in `docs/23mtch/`, above all `PORT-ARCHITECTURE.md`. It explains the rules engine,
   the solver, Sparky, the Coach, the modes and the tests.
3. The code: `lib/stickler/` (rules, solver, sparky, modes, progress, sfx), `components/stickler/` (Stickler,
   Lobby, Board, Stick, Sparky, Terminal), `scripts/check-stickler.ts`.
4. The original `23mtch.bas` lives in `E:\Projects\BASIC Programs\Porting\src\` (read-only, outside the repo).
   You should not need it: this prompt adds a new mode and does not change the 1981 behaviour.

House rules: talk to the owner in Bahasa Indonesia; all code, UI text and docs in English. Never copy original
program text. Light and dark themes on every new surface, keyboard play, 390 px phone width, reduced motion.
Do not commit; the owner commits.

## 1. Why

The owner's feedback, in their words: when only one stick is left for the losing player to take, the ending is
flat and even boring. Every Stickler game today ends that way: take 1 to *k*, so the loser is always left holding a
single stick. The owner wants a mode where every take is a real handful, with ranges such as 2–3, 3–5 or 3–4.

## 2. The rule: take between *min* and *max*

- One row of sticks. On your turn you take at least **min** and at most **max** sticks.
- **Whoever takes the last stick loses**, as in every other Stickler mode.
- **The sweep.** If fewer than *min* sticks remain on your turn, you must take all of them. That is also the only
  way a turn can take fewer than *min*. Since it takes the last stick, it loses. On the table it is a forced
  **sweep**: the whole remaining pile goes up at once.
- Taking the whole pile when it holds *min* or more sticks is legal, but it also takes the last stick and loses.

### The mathematics (verify it, then lock it in tests)

For one row with takes *a..b* (1 ≤ a ≤ b) under this rule, the player to move is lost exactly when

```
n mod (a + b)  is in  1..a        (n = sticks left, n > 0)
```

With a = 1 this is today's formula (n mod (b+1) = 1), so the new code must give identical answers for every
existing mode. Proof sketch: from 1..a you must take the last stick; from a+1..a+b you can always leave 1..a; from
a+b+1..2a+b every move lands in a+1..a+b. It repeats with period a + b.

So the "magic numbers" of Classic become **magic zones**. For 2–3 the zones are 1–2, 6–7, 11–12, 16–17, 21–22.
Leave your opponent anywhere inside a zone. When you are winning you can choose where inside the zone to land.

### Presets (the owner said "or others, your choice")

| Preset | Period | Losing zones | Suggested pile |
|---|---|---|---|
| 2–3 | 5 | 1–2 | 23 |
| 2–4 | 6 | 1–2 | 27 |
| 3–4 | 7 | 1–3 | 32 |
| 3–5 | 8 | 1–3 | 36 |
| 4–6 | 10 | 1–4 | 45 |

Check every suggested pile with the solver: the player who moves first must have a win. Also offer
**"Surprise pile"**, which draws a pile between 3·(a+b) and 6·(a+b) that is winnable for the starter, like the Daily
does, and an optional **"Sparky starts"** switch. With Sparky starting, pick piles that are winnable for Sparky
(the table is then a real test; the Coach says so honestly).

## 3. The mode: **Handfuls**

- A new lobby card: 🤲 **Handfuls**, "Every turn is a handful. Never just one." It sits after Classic 23. Sparky's
  level comes from the existing level picker.
- A small setup strip on the card or a sheet: the preset chips from §2, "Surprise pile", "Sparky starts".
  Remember the last choice in Stickler's progress storage, with backward-compatible defaults.
- **Versus** gets two new presets: "Handfuls 2–3 · 23" and "Handfuls 3–5 · 36".
- **Unchanged:** Classic 23, the Ladder (saved stars must stay valid), the Daily (past puzzles and shared results
  must stay identical) and 1981 mode. `check-stickler.ts` must still pass all of its existing checks unchanged.

## 4. Engine changes

- `Rules` gains `minTake` (default 1). Every existing preset keeps `minTake: 1`, so nothing about them changes.
- `legalMoves`, `isLegal`, `maxTakeFrom` (and a new `minTakeFrom`) follow §2. A row holding fewer than `minTake`
  allows only "take all". Handfuls is single-row; make multi-row + `minTake > 1` impossible in the types or throw.
- `solver.ts`: the closed form from §2 for one row; `winningMoves`, `quality` and a `magicZones(min, max, upTo)`
  (keep `magicNumbers` for the old modes). The brute-force search must model the sweep rule too.
- `describeRules` shows "36 sticks · take 3–5".
- **Sparky:** the same three levels. When he is winning at Master he prefers to leave exactly `min` sticks
  (the biggest forced sweep for you) when the zone allows it; that is the drama. When he is losing he takes a
  random legal amount that does not take the last stick, and he objects in character to illegal picks.

## 5. Board and feel

- **Take controls** show the legal range only: buttons `3 4 5` for 3–5, or a single **Sweep** button when fewer than
  *min* remain. Clicking sticks works as now. Picking fewer than *min* and pressing Strike gets Sparky's
  stickler objection ("Handfuls means at least 3."), a gentle shake, no modal, and it counts toward *Rule Bender*.
  Number keys follow the range (a key outside it gets the same objection).
- **Coach:** step 1 "Watch the gaps: Sparky keeps leaving you inside the same bands." Step 2 lists the zones and
  their period (a + b). Step 3 gives the exact take and highlights the sticks. When the position is lost, say so.
- **Key moment** after the game works as today (🟩 🟥 ⬜) with zone wording. For 3–5: "with 24 left you took 3,
  leaving 21; taking 5 would have left 19, inside a zone".
- **Signature moment, bigger:** the sweep. All remaining sticks light at once in every stick style: matches flare
  together, glow sticks snap in a chain, candy sticks burst one after another. Scale the flare, the embers and the
  shake with the number of sticks swept, within reduced-motion limits. The result card names the sweep:
  "Sparky had to sweep 3."
- The HUD line under the pile shows the rule at a glance: "Take 3–5 · last stick loses".

## 6. Progress and badges

- Stats per mode as today, plus Handfuls wins per preset.
- Two new achievements (14 in total; check that the badge grid still lays out well at desktop and 390 px):
  **Clean Sweep** (make Sparky sweep 3 or more sticks) and **Handful Master** (beat Master Sparky on every preset).
  Existing saved progress must load without errors.

## 7. Tests, checks, docs

- `scripts/check-stickler.ts` gains:
  - The closed form equals brute force for every a in 1..4, b in a..7 and n up to 60.
  - Every preset pile is winnable for the starter, and a perfect player beats Master Sparky in 200 seeded games
    per preset.
  - "Surprise pile" gives winnable piles over 1,000 seeds.
  - Master never throws away a won position in Handfuls.
  - The legal-move generator never offers fewer than *min* unless it is the sweep.
  - Everything that existed before still passes.
- `npx tsc --noEmit` and `npx eslint lib/stickler components/stickler scripts/check-stickler.ts` clean. Report errors
  that come from files outside your scope; do not fix them.
- Headless-browser self-review (see §8 for the dev server): a full Handfuls game in each stick style, light and dark,
  1440×900 and 390×844. Try an illegal pick, the Coach at all three steps, a Sparky-starts table, the sweep ending
  and the result card. Look at the screenshots yourself and fix what looks off before reporting.
- Docs, in English:
  - `docs/23mtch/PORT-ARCHITECTURE.md`: the Modes table, the mathematics section (zones and the sweep rule), the
    Sparky section, Testing and the achievements count.
  - `docs/23mtch/ABOUT.md`: one short paragraph if it describes Stickler's modes.
  - `HOW-TO.md` and `ORIGINAL-ARCHITECTURE.md` describe the 1970s program and do not change.
  - Mermaid only for diagrams.

## 8. Parallel session rules (three sessions run at once)

- **Your files:** `lib/stickler/**`, `components/stickler/**`, `scripts/check-stickler.ts`, `docs/23mtch/**`, and
  `components/previews/SticklerPreview.*` only if the Hall preview needs the new mode (it probably does not).
- **Not yours:** Bop Box (`lib/music`, `components/bopbox`, `docs/music`, music scripts) and Don't Crater
  (`lib/lander`, `components/dontcrater`, `docs/lander`, `scripts/check-lander.ts`). Do not touch them.
- **Shared files** (`lib/catalog.ts`, `components/kit/**`, `components/hall/**`, `lib/prefs.ts`, `lib/sound.ts`,
  `lib/docs.ts`, `app/layout.tsx`, global CSS, `package.json`, `README.md`): no kit owner this wave, so avoid them.
  If one really needs a change, make it at the very end, re-read the file first, change only your own lines, and
  list it in your report.
- **Dev server:** one `next dev` is already running for this folder at **http://localhost:3210** and serves every
  route, including `/stickler`. Next 16 refuses a second dev server in the same folder, so do not start another.
  Never stop a process you did not start. If nothing answers on 3210, start `npx next dev -p 3210` in the
  background and leave it running.
- **Do not run `next build`.** Concurrent builds clash in `.next`. The Bop Box session runs the production build
  once all three sessions are done.
- **Headless screenshots:** install `puppeteer-core` in a scratch folder outside the repo (never in the project)
  and use Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`. Save screenshots outside the repo.
- **No new npm dependencies** in the project. **No commits.**

## 9. When you finish, report (in Bahasa Indonesia)

- What changed, with the preset table and the rule in one sentence.
- Check results: solver vs brute force, win rates per preset, and a confirmation that the old checks still pass.
- Screenshots you reviewed, and anything you could not verify.
- Any shared file you touched, and any helper you think belongs in the shared kit.
