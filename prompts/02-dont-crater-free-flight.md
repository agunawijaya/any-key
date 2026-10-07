# Prompt 02 — Don't Crater: "Free Flight" mode (tilt left and right, find flat ground)

> Run in Claude Code from `E:\Projects\BASIC Programs\Porting\web`. Runs in parallel with prompt 01 (Stickler) and
> with the Bop Box session (Phase 2, "Original Score"). See §10 for the parallel rules.
> Recommended: the strongest model available, effort xhigh.
> **Owner checkpoint** (§9 step 2): after the physics prototype and three hero frames, stop and show the owner
> before building the rest. Talk to the owner in Bahasa Indonesia.

## 0. Read first

1. `CLAUDE.md` and `AGENTS.md` (this Next.js version differs from your training data: read the relevant guide in
   `node_modules/next/dist/docs/` before using any Next API you have not seen in this repo).
2. The four docs in `docs/lander/`, above all `PORT-ARCHITECTURE.md`. It covers the flight model, the hoverslam
   solver, time warp, the landing assist, the camera, the endings, the modes and the tests, including the
   **human-pilot tests**.
3. The code: `lib/lander/` (worlds, physics, solver, missions, grades, progress, sfx, flags, original),
   `components/dontcrater/` (DontCrater, Lobby, Flight, sim, scene, Recorder, Postcard, FlagDesigner,
   Terminal1979), `scripts/check-lander.ts`, `components/previews/DontCraterPreview.tsx`.
4. The original `lander.bas` lives in `E:\Projects\BASIC Programs\Porting\src\` (read-only, outside the repo). It
   has no sideways motion; this prompt adds a new mode and does not change the 1979 behaviour.

House rules: all code, UI text and docs in English. Never copy original program text. Light theme = day side,
dark theme = night side, as everywhere in Don't Crater. Keyboard, mouse and touch; 390 px phone width; reduced
motion. Do not commit; the owner commits.

## 1. Why

The owner's feedback, in their words: flying only straight down is getting boring. The lander should tilt left and
right, and the player should have to **search for flat ground** to land on. Today the lander falls vertically onto a
levelled pad with beacons (a barge on Earth), and `PORT-ARCHITECTURE.md` lists "no sideways motion or rotation" as
a known limit.

Keep what works: Live, Ten-Second, Missions, Daily Drop and 1979 mode stay exactly as they are, together with their
balance, their tests and their share texts. The tilt lives in a **new mode**, so nothing already proven changes.
Do not imitate the look, names or wording of the 1979 Atari arcade game *Lunar Lander*. The mechanics are generic;
the presentation stays "Postcards from the Descent".

## 2. The mode: **Free Flight** — "Tilt, drift, and find flat ground."

- A new lobby card after Live, on the chosen world (all four worlds).
- Two starts:
  - **Full descent**: the world's usual height and entry speed, plus a sideways drift you must kill.
  - **Final approach**: from 3 km up, a short and replayable round.
- **Sites.** Every flight lands on a *site*: a stretch of terrain generated from a seed. Offer **New site** (random
  seed, shown so it can be replayed) and **six named sites** that unlock in order with stars, like the Missions:
  - two on the Moon: a boulder field; a crater rim at night
  - two on Mars: a canyon edge; dunes at dusk
  - one on Psyche: metal crags
  - one on Earth: barges at sea
- **Unchanged:** the Daily Drop and the 1979 mode. A Free-Flight daily can be a later prompt.

## 3. Physics: the 1979 model, now in two dimensions

- **Attitude.** New state `tilt` (degrees, 0 = upright, positive = nose to the right), limited to ±75°.
  Hold `←` or `→` to rotate at 60°/s, and add `Shift` for fine control at 20°/s. On release the tilt holds.
  `U` levels the lander in about half a second (not `↑`/`↓`: those are the throttle). Rotation costs no fuel (it is the RCS);
  keep it simple.
- **Thrust along the lander's axis.** The vertical part is `throttle × engine / mass × cos(tilt)`. The sideways part
  is `… × sin(tilt)`, in km/h per second, like the vertical speed. There is no air drag, as in the original.
- **New state:** horizontal speed `vx` (km/h, positive = right) and position `x` (km). `x` changes by `vx / 3200` km per
  second: use the same 1979 conversion as for height, so both axes share one geometry. Write this down in the docs.
- **tilt = 0 must reproduce today's model exactly.** Put the 2D step in `lib/lander/physics.ts`, next to
  `advance()`, or in a new `physics2d.ts`. `check-lander.ts` must prove that a 2D flight held upright gives the
  same heights, speeds, fuel and touchdown as `advance()`, to 1e-9. All existing tests must still pass unchanged.
- **Solver in 2D:**
  - The stop point uses the vertical part of full thrust at the current tilt.
  - A new **drift stop**: the distance travelled sideways before `vx` reaches zero at full power, tilted fully
    against the drift.
  - The perfect-plan helper gets a 2D version for the flight recorder and the fuel budget.
- **Fuel budget.** Free Flight gives each world extra fuel so that a perfect pilot keeps at least 8% after killing
  the drift and translating to a flat spot about 1 km away (Final approach) or 3 km away (Full descent). Tune it
  with simulations, not by hand, and record the numbers in the docs.

## 4. Terrain you can land on (or not)

- **One source of truth:** `lib/lander/terrain.ts` exports `heightAt(site, xKm)` (metres) and `slopeAt(site, xKm)`.
  It is deterministic from the site seed and used by both the physics and the drawing. Today's decorative fractal
  ground stays for the high views; the site profile takes over as you get low, blended so nothing pops.
- **What a site holds** (about ±4 km around the start; the edges fade into impassable ridges or deep sea):
  - rough ground everywhere: slopes of 8–35°, boulders of 1–6 m, crater rims;
  - **3 to 6 natural flat patches** (slope ≤ 4°) from 12 m to 60 m wide, scattered so that at least one is
    reachable on the fuel budget from any fair start;
  - **no beacons and no pad markings**: the player finds flat ground by eye. That is the game.
- **Earth:** open sea with 2–4 barges of different sizes that rock on the swell; one may drift slowly. Water is a
  splashdown (a new ending, *Splash*, played for comedy: a bobbing lander with a sad little flag).
- **Fairness check.** For every named site and for 1,000 random seeds per world, a planner must find a reachable
  flat patch with the fuel budget, or the generator re-rolls that seed, the way the Daily Drop rejects unfair days.

## 5. Touchdown rules

- The lander stands on two feet about 4 m either side of its centre. Contact happens when either foot touches
  `heightAt`.
- **It stands** when all of these hold:
  - the ground slope under both feet is ≤ 8°;
  - the tilt differs from the slope by no more than 10°;
  - `|vx|` ≤ 6 km/h;
  - the vertical speed gets its grade from the existing table (Butter, Smooth, Bumpy, and so on).
- Otherwise it **tips over**, a new ending, **Tipped**: a slow roll down the slope, the legs fold, dust. The
  astronaut climbs out and shrugs. Crash-speed landings keep the existing crash endings, so a fast landing on a
  slope is still a crater.
- **Stars for sites:** the grade gives up to ★★★, and a **precision bonus** rewards landing on a narrow flat (under
  20 m) or near its centre. Show both on the result card: "Butter · 14 m ledge · dead centre".

## 6. Seeing and choosing where to land

- **Camera.** The log-altitude zoom stays vertical. Horizontally the camera follows the lander, and low down it
  widens so you can see at least ±2 × your height (never less than ±150 m) of ground. Show enough terrain to
  choose from, not just what lies below.
- **Terrain strip.** A slim profile of the whole site across the top of the view: your position, your drift
  arrow and where you would touch down if nothing changed. Flat patches are *not* labelled; the player reads
  them from the shape.
- **Impact marker** on the ground: where the current trajectory meets the terrain (at the current throttle and
  tilt), updated every frame.
- **Scan assist** (`S`, remembered in the lobby, off by default): shades the ground within 1.5 km of the lander
  green (≤ 4°), amber (4–8°) or red (> 8°). A flight flown with it is marked 🛰️ in any share text and recorder.
  The existing landing assist (`A`) and burn guide (`G`) keep working and use the vertical component.
- **HUD additions:**
  - tilt ("tilt 12° ▶");
  - horizontal speed with an arrow ("◀ 42 km/h");
  - "drift stops in 0.9 km" while braking against it;
  - in the last 60 m, the same kind of target advice as today, extended sideways: "aim 0 sideways · tilt 5° left".
- **Time warp** follows the existing rules. Also drop to ×1 whenever a correction is needed now: under 2.5 km
  while sideways speed is high, or whenever the impact marker sits on a slope and less than about 10 s remain.

## 7. Controls

| Input | Action |
|---|---|
| `←` / `→` (+ `Shift`) | Rotate (fine) |
| `U` | Level the lander |
| `Space`, `↑`/`↓`, `0`–`9`, `F`, `X` | Throttle, as in Live |
| `S`, `A`, `G`, `T` | Scan assist, landing assist, burn guide, time warp |
| `P`, `R`, `Esc` | Pause, restart, lobby |
| Touch | ⟲ ⟳ buttons bottom left, the lever and BURN bottom right. Pressing both rotate buttons levels |

## 8. Look, sound and the signature moment

- The lander leans visibly. The exhaust plume follows the nozzle. Dust blows **sideways** off the ground in the
  direction of the thrust in the last 60 m.
- Rough ground reads clearly in both themes: rim light on boulder edges by day, Earthshine or starlight
  silhouettes by night. Flat patches look calm, never highlighted.
- **Signature moment:** the last seconds. The lander settles upright onto a narrow ledge between boulders, the dust
  sheet rolls sideways and clears, and the flag goes up with the whole rough valley around it. For *Tipped*, a slow,
  comic roll with a camera tilt.
- Sound: an RCS "tss" for rotation, a scraping rattle for a tip-over, a splash and gurgle for Earth.
- Reduced motion: no camera tilt, gentler shake.

## 9. Staged workflow

1. **Prototype.** 2D physics, the terrain generator, touchdown rules, the tilt = 0 equivalence test, and a first
   fuel-budget simulation. Write the numbers into the docs draft.
2. **Owner checkpoint.** Three hero frames at 1440×900, the first two in both day (light) and night (dark):
   (a) a tilted final approach on the Moon with the terrain strip and the impact marker;
   (b) a Mars canyon edge with the scan assist on;
   (c) the *Tipped* ending.
   Add one 390×844 frame that shows the touch controls. Critique your own frames for at least five rounds first.
   Then **stop**, show them to the owner with a short summary in Bahasa Indonesia, and wait for approval.
3. After approval: the full mode, sites, HUD, sounds, result card, recorder in 2D, progress and badges.
4. Critique loop in both themes and at phone width, at least three rounds, then docs and the final checks.

**Progress and badges:** remember site stars, the best result per site, the scan setting and the last start
choice, and keep old saved progress loading cleanly. Add three achievements (15 in total; check the badge grid):
**Pinpoint** (stand on a flat narrower than 15 m), **Sidewinder** (kill more than 500 km/h of drift and land) and
**Oops** (tip over for the first time).

**Human-pilot tests** (required; read the Testing section of `PORT-ARCHITECTURE.md` for why). Extend
`scripts/check-lander.ts` with a pilot that:
- flies the real `FlightSim` at 60 fps with its time warp;
- sees the state **0.8 s late**;
- sets only whole-number throttle steps;
- can only tap or hold the rotate keys like a person;
- chooses a flat patch from what the screen and terrain strip show, never from hidden data.

It must stand on flat ground on every world, from both starts, with and without the scan assist, and on all six
named sites. Also run 200 random sites per world and report the success rate per world (target ≥ 90% with the
scan assist, ≥ 70% without). Record every number in the docs. Never claim "winnable" from instant-reaction bots
alone.

**Other checks:**
- Terrain determinism (the same seed always gives the same heights).
- The fairness check from §4.
- The touchdown rules at every boundary (8°, 10°, 6 km/h).
- `npx tsc --noEmit` and `npx eslint lib/lander components/dontcrater scripts/check-lander.ts` clean. Report
  errors that come from files outside your scope; do not fix them.
- Headless-browser flights in Free Flight on every world, in both themes and at 390 px: a flat landing, a tip-over,
  and a splash on Earth. Look at the screenshots yourself.

**Docs, in English:**
- `docs/lander/PORT-ARCHITECTURE.md`: the new mode, the 2D model and its 3200 geometry, terrain and fairness,
  touchdown rules, the camera, the HUD and assists, tests and numbers. Update the "Known limits" line about sideways
  motion.
- `docs/lander/ABOUT.md`: a short paragraph.
- `HOW-TO.md` and `ORIGINAL-ARCHITECTURE.md` describe the 1979 program and do not change.
- Mermaid only for diagrams.

## 10. Parallel session rules (three sessions run at once)

- **Your files:** `lib/lander/**`, `components/dontcrater/**`, `app/dont-crater/**`, `scripts/check-lander.ts`,
  `docs/lander/**`, `components/previews/DontCraterPreview.*`.
- **Not yours:** Bop Box (`lib/music`, `components/bopbox`, `docs/music`, music scripts) and Stickler
  (`lib/stickler`, `components/stickler`, `docs/23mtch`, `scripts/check-stickler.ts`). Do not touch them.
- **Shared files** (`lib/catalog.ts`, `components/kit/**`, `components/hall/**`, `lib/prefs.ts`, `lib/sound.ts`,
  `lib/docs.ts`, `app/layout.tsx`, global CSS, `package.json`, `README.md`): no kit owner this wave, so avoid them.
  If a Hall trivia line or similar really must change, do it at the very end, re-read the file first, change only
  your own lines, and list it in your report.
- **Dev server:** one `next dev` is already running for this folder at **http://localhost:3210** and serves every
  route, including `/dont-crater`. Next 16 refuses a second dev server in the same folder, so do not start another.
  Never stop a process you did not start. If nothing answers on 3210, start `npx next dev -p 3210` in the
  background and leave it running.
- **Do not run `next build`.** Concurrent builds clash in `.next`. The Bop Box session runs the production build
  once all three sessions are done.
- **Headless screenshots:** install `puppeteer-core` in a scratch folder outside the repo (never in the project)
  and use Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`. Keep hero frames for the owner in a
  scratch folder, or in `docs/lander/media/` only if the docs use them.
- **No new npm dependencies** in the project. **No commits.**

## 11. When you finish, report (in Bahasa Indonesia)

- What changed, how Free Flight plays, and the touchdown rules in two sentences.
- The numbers: fuel budgets, fairness results, and human-pilot success rates per world with and without the scan
  assist. Confirm that every existing check still passes.
- The screenshots you reviewed, and anything that needs the owner's eyes or hands (feel of the rotation speed on a
  real keyboard and on a phone).
- Any shared file you touched, and any helper you think belongs in the shared kit.
