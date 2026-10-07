# Prompt 03 — Two Humps (inspired by "Desert", IPCO Personal Computer Owners Group, IBM BASICA, 1982)

> Run in Claude Code from `E:\Projects\BASIC Programs\Porting\web`, AFTER prompt 00 is done and committed.
> Runs alone, or in parallel with polish prompts only (see §15). Recommended: Claude Opus 5.5, effort xhigh.
> **Owner checkpoint** after the hero frames (§10, stage 1). Stop there and wait.

## 0. Read first

1. `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`, `docs/ARCHITECTURE.md` (folder map,
   kit API, manifest, GameShell, Keyring), `docs/NAVIGATION.md`, `docs/adr/`, `docs/templates/`.
2. How the shipped games integrate, especially Don't Crater (`lib/lander`, `components/dontcrater`): a canvas
   scene, a 1979 mode, missions, a daily, light/dark worlds. Study it; never import from another game's folder.
3. The original, READ-ONLY, outside the repo: `E:\Projects\BASIC Programs\Porting\src\desert.bas`. Describe its
   behaviour in your own words. Never copy its messages, jokes, epitaphs or instructions into the repo.
4. This whole prompt. §14 (Hall integration) overrides earlier sections.

Folders for this game, one id everywhere: `app/two-humps/`, `lib/two-humps/`, `components/two-humps/`,
`docs/two-humps/`. Manifest id `two-humps`; replace the `desert` "coming soon" placeholder explicitly.

## 1. The pitch

The 1982 program sends you 40 miles across "the Gobi" on a camel, six commands per turn, with pursuers behind
you. Its source hides a better game than the one it shows: after most events the camel silently **repeats your
last command** (a `GOTO` out of a `GOSUB`), so a gallop can run on by itself until the camel collapses. We make
that the heart of the game, move the story to the real Gobi (two-humped Bactrian camels, singing dunes, the
Flaming Cliffs), and give the player three very different pursuers to outrun.

- **Title:** Two Humps. **Tagline:** "Forty miles. Two humps. Don't stop now."
- **Teaser:** Cross the real Gobi on a camel with a mind of its own. Outrun a wall of sand, race a rival
  caravan, or escape the Ladle Gang — a band of pygmy jerboas who have heard camel soup is delicious.
- **Category:** Survival trek. **Players:** 1. **Session:** 5–10 minutes (Crossing), 30+ (Expedition).

## 2. What the original does (verify every point and record it in NOTES.md)

| Topic | Behaviour to verify |
|---|---|
| Goal | Reach more than 39 miles; win is checked at the top of each turn |
| Water | Canteen 6 drinks; you may go 4 turns without drinking, a warning at 1, death below 0. Drinking takes no turn |
| Moves | Moderate: 0–9 miles, fatigue +1, death when fatigue hits exactly 8. Full speed: 0–18 even miles, fatigue +3, death above 7. Rest: fatigue 0, but the turn passes |
| Pursuers | Start after the third turn; move 2.5–11.5 miles per turn (non-integer, so distances print with .5); catch you when their total reaches yours |
| Events after a move | Captured ≈6%; oasis ≈28% (refill to 6, thirst reset); sandstorm ≈4% (±0–9 miles, can go negative); "hurt hump" ≈4%; otherwise ≈58% the same command runs again without a new turn |
| Repeat bug | Repeats skip water and pursuer updates (free miles) but add fatigue; the return address is never popped. Measure: average repeats per command, chance a fresh-camel gallop kills the camel (expected ≈⅓), and whether long games can overflow BASICA's stack |
| Status check | Prints status, then falls into the drink routine: checking status costs a drink |
| Empty canteen | Drinking with 0 drinks left kills you instead of warning |
| Invalid command | Any number other than 1–6 falls through to "hope for help" |
| Hope for help | 10% rescue (3 drinks, thirst reset), 90% death |
| Capture | Escape: 50% death. Wait: 25% "paid", otherwise a "just wait" message — but the captive flag is never set, so you simply continue. Waiting is always safe |
| "Hurt hump" | Its message calls it lucky; the code moves the pursuers one mile closer |
| Endings | Win banner and party; five random death epitaphs; quitting at "play again" prints a one-word taunt |
| Content | Pursuers are "cannibal pygmies", kidnappers are named after a real people, epitaphs are dark. **None of this goes into our game.** ABOUT and CHANGES-FROM-ORIGINAL describe it plainly in our own words and say why we changed it |
| Lineage | The file says "translated by IPCO 2/82". It descends from the earlier *Camel* program (credited to Cary Torkelson in later ports); verify what you can and say what you could not |

Simulate the original exactly (seeded) and record: win rate for a random player, for a "sensible" bot and for
the best simple policy you can find; average turns; causes of death.

## 3. Game design

### 3.1 The turn

Six commands, keys `1`–`6` as a nod to the original's function keys:

| # | Command | Effect |
|---|---|---|
| 1 | Drink | One sip from the canteen (6 sips), thirst back to full (4 turns). Free action. With an empty canteen it simply says so |
| 2 | Walk | 0–9 miles, fatigue +1 |
| 3 | Gallop | 0–18 miles, fatigue +3 |
| 4 | Make camp | Fatigue to 0, time passes (night falls if it is evening), pursuer moves |
| 5 | Scan the horizon | Costs a sip (our nod to the status bug) and reveals the odds of the next event and any oasis within reach |
| 6 | Signal for help | Mirror flash by day, fire by night. Odds shown honestly (base 10%, higher near herders' gers in Expedition) |

**On a roll (the repeat bug, made fair).** After Walk or Gallop, if no event fires, the camel may keep going on
its own: the chance is shown on screen (base 58%, as in the original) together with what one more stride costs
(miles gained, fatigue added). The player can **pull the reins** (`Space` or click the camel) to stop it, or
let it run. Repeats are free of thirst and pursuer movement, exactly as in 1982. This is the game's main
press-your-luck decision.

Every command card previews its outcome before you commit: miles range, fatigue after, pursuer gain, odds.
No hidden rolls except the dice themselves.

### 3.2 Events (our own, all ages)

Oasis (refill, camel eats), sand gust (pushes you forward or back), sore hump (camel slows next turn), lost
caravan (a dust devil scatters your packs: **chase** them — risky — or **wait** it out — always safe but the
pursuer gains, our honest version of the 1982 "wait" quirk), singing dune (a booming hum; next move +2 miles),
fossil find (Expedition collectible). Odds tuned by simulation (§9).

### 3.3 Three pursuers (the player picks one per Crossing)

| | A. The Haboob | B. Rival caravan | C. The Ladle Gang |
|---|---|---|---|
| What | A wall of sand rolling across the desert | A friendly, boastful rival (name and look are yours to design) | A band of five-toed pygmy jerboas with an oversized soup ladle |
| Movement | Predictable band shown as a forecast; slightly slower at night | Rests every night, gallops at dawn; sometimes bluffs a gallop | Very erratic hops (wide range like the original's 2.5–11.5); asleep in burrows by day, hunting by night |
| The dilemma | It never sleeps: when can you afford to camp? | Oases are shared: if the rival reaches one first it is dry for you | Camping at night is dangerous — the opposite of A |
| Special | Visibility drops as it nears; oasis hints fade | Its dust plume is visible on the horizon | Seed sack (3 handfuls): toss seeds to stop them for a turn — they really do eat seeds |
| You lose | You shelter and the trek is lost | It arrives first and throws the party for itself | The cartoon cooking-pot scene: they are far too small to lift the camel. No gore, played for laughs |
| Difficulty | Normal | Tactical | Hard |

Keep the original's best running jokes in our own words: the jerboas' knock-kneed hop, their dream of camel
soup, and that the pursuers plan to attend your victory party.

### 3.4 Modes

| Mode | What |
|---|---|
| Crossing | 40 miles, pick a pursuer and difficulty (Chill / Normal / Hard: water, odds, pursuer speed) |
| Expedition | Five legs across real Gobi places, each with its own pursuer and twist: Khongoryn Els (singing dunes), Bayanzag Flaming Cliffs (fossil finds), Yolyn Am (an ice gorge: no thirst, slow going), Khermen Tsav (canyons: gallop forbidden), and a final leg to a ger camp. Short field-journal cards with true facts in our words |
| Daily Crossing | Same seed and pursuer for everyone (pursuer rotates daily), kit daily numbering and share |
| 1982 mode | A terminal that plays the original's rules and numbers turn for turn, bugs included (status costs a drink, typos call for help, waiting is always safe, the camel repeats), with the Ladle Gang as the pursuer and every line written fresh |

Daily share example (emoji only in the share string, never as UI art):

```
Two Humps · Daily #12 · The Ladle Gang
🐫🐫💧🐫🐫🌴🐫🌙🐫🏁  40 mi in 11 turns
Gang 3 mi behind · 2 sips left
```

### 3.5 Achievements (~12, routed to the Keyring)

Examples, rename freely: Forty Without a Gallop; Let It Run (5 repeats in one command and survive); Pulled the
Reins at One Fatigue to Spare; Last Sip; Camp Under the Gang's Noses (camp at night vs C and live); Oasis Thief
(beat the rival to 3 oases); Outran the Haboob on Hard; Seedless (beat C without throwing seeds); Fossil
Hunter (all Expedition fossils); Singing Sands (hear the dunes 3 times); 1982 Survivor; Typo (call for help by
accident in 1982 mode — secret).

## 4. Interaction

- Command cards along the bottom: click, or keys `1`–`6`. Hover/focus shows the outcome preview.
- Pull the reins: `Space` or click the camel. The "on a roll" meter shows the odds while it runs.
- Seed sack (vs C): drag a handful onto the gang, or press `S`.
- Illegal actions (gallop with a dead-tired camel, seeds when empty) shake gently with a one-line reason.
- Turn feedback within one frame; the world animates the move; events arrive as illustrated vignette cards.

## 5. Screens

1. **Game menu** (inside GameShell, "← Back to the Hall"): a live panorama of the trek with Crossing,
   Expedition, Daily Crossing, 1982 mode, Records, How to play.
2. **Pursuer pick**: three large cards, each with its creature or storm alive in its own little scene, the
   challenge character in one line, difficulty.
3. **Tutorial** (under 90 seconds, skippable): one walk, one drink, one roll with the reins, one event.
4. **The trek**: full-bleed side-on diorama; top HUD = route strip 0–40 with you, the pursuer and known oases;
   canteen (6 sips), thirst (4 pips), camel stamina (7 small humps); bottom = command cards.
5. **Event vignette** cards over the scene. 6. **Night time-lapse** when camping.
7. **Results**: victory party or the loss scene, then the standard results actions; Expedition legs end on a
   journal page.
8. **Expedition map**: a hand-drawn-looking map of the five places (drawn in code).
9. **1982 terminal**. 10. **Records and settings**.

## 6. Art direction — "Golden Hour Gobi"

- **The world:** a side-on 2.5D diorama with 5–7 parallax layers: far ranges, mid dunes, near dunes with
  wind ripples, scrub (saxaul, tufts), foreground sand streaks. Procedural dunes from noise; ripples animate
  with the wind. A real sky model: sun position from the turn clock, golden hour, blue hour, night with a
  wheeling Milky Way and stars.
- **The camel:** a Bactrian camel with two humps, procedurally rigged (legs, neck, humps that sway), with a
  distinct walk and gallop gait, a tired gait as fatigue rises, and a small rider in a deel. Humps visibly
  sag as stamina drops.
- **Light appearance:** chrome like sun-bleached paper and ochre ink. **Dark appearance:** indigo night
  chrome with lantern accents. The world's time of day follows the turns in both; the appearance sets the
  chrome and the time the trek starts (dawn vs dusk).
- **Pursuers:** A is a towering volumetric-looking wall of dust with curling fronts and lightning flickers
  inside; B is a caravan silhouette with a dust plume and a cocky banner; C are tiny, very cute jerboas (huge
  ears, spring legs, tufted tails) hopping in an uneven line, one carrying a ladle twice its size.
- **Signature moments (spend the effort here):**
  1. *The Haboob arrives* — the sky darkens from the left, sand streaks race across the screen, the camel
     lowers its head and leans into the wind, the dunes hum (a low tone around 450 Hz, the pitch reported for
     singing sand), and the HUD flutters.
  2. *The night time-lapse* — sunset, stars wheeling, a campfire, and (vs C) dozens of tiny eyes blinking in
     the dark at the edge of the firelight.
  3. *Victory* — a ger camp at night with lanterns and a cake; the pursuer arrives as a guest (the storm as a
     breeze that blows out the candles, the rival carrying a gift, the jerboas with their ladle and bibs).
- Everything drawn in code (zero raster). Rendering choice is yours in an ADR (Canvas 2D with offscreen
  layers, or WebGL/three.js lazy-loaded for the dust wall and sky). 60 fps at 1920×1080; reduced motion
  freezes parallax and replaces the storm and time-lapse with cross-fades.
- **Sound** synthesised with WebAudio: wind beds, camel footfalls by gait, the singing-dune hum, campfire,
  jerboa squeaks; master mute from the kit.
- `demo(seed)` for the Hall: a silent loop of the camel trekking with the pursuer on the horizon.

## 7. Settings

Difficulty, pursuer (in Crossing), reduced motion (follows system), sound, units (miles default, km option),
reset Two Humps data.

## 8. Controls

| Action | Mouse | Keyboard |
|---|---|---|
| Commands | Click card | `1`–`6` |
| Pull the reins | Click the camel | `Space` |
| Toss seeds (vs C) | Drag the sack onto the gang | `S` |
| Pause | Pause button | `Esc` |
| Results | Buttons | `R` play again, `H` Hall |

## 9. Engineering and tests

- Pure engine in `lib/two-humps/` (no DOM): state, commands, events, the three pursuer models, the roll, the
  1982 rules as a separate module. Seeded with the kit RNG; deterministic.
- Bots: random, sensible (drinks at the warning, camps at fatigue 5–6, pulls the reins at 6) and a searched best
  policy. **Balance targets** (sensible bot, Normal): A 55–65% wins, B 50–60%, C 40–50%; Chill +15 points;
  Hard −15. Median Crossing 10–14 turns. No single command order wins more than 80%. Record results in NOTES.md
  and lock them as tests with tolerances.
- 1982 module: golden tests that reproduce the verified original behaviour (repeat probability, status drink,
  invalid → help, wait always safe, hump moves pursuers closer).
- Daily determinism test; Expedition legs each winnable by the sensible bot ≥40% on Normal.
- Playwright (game-scoped config, port 3213): every mode by mouse and keyboard-only, the tutorial, the reins,
  seeds, every exit path. Add the game's screens to `npm run shots` (1280×720 and 1920×1080, light and dark).

## 10. Staged workflow

1. **Hero frames first**, live scenes at 1920×1080 in light and dark: (a) the Haboob rolling in behind the
   camel at golden hour; (b) night camp with the Ladle Gang's eyes in the dark under the Milky Way; (c) the
   victory party at the ger camp. At least five critique rounds against "would this be the README hero
   image?"; save to `docs/two-humps/media/hero/`; **stop and wait for the owner.**
2. Engine, 1982 module, bots and simulations; NOTES.md.  3. Wireframes with full input.  4. Art pass (world,
   camel rig, pursuers).  5. Modes, Expedition, tutorial, daily.  6. Sound and feel.  7. Critique loop (≥3
   rounds, both appearances, both sizes).  8. Hall integration, docs, final checks.

## 11. Documentation (`docs/two-humps/`, Mermaid only)

ABOUT (the brochure: IPCO's 1982 program and its lineage, the hidden repeat, the real Gobi, the three
pursuers, why play), HOW-TO-PLAY, ARCHITECTURE (engine, pursuer models, renderer layers, where every visual
and sound is defined and how to change it), ORIGINAL-ARCHITECTURE (the BASIC program's flow with a Mermaid
diagram of its GOTO/GOSUB tangle), CHANGES-FROM-ORIGINAL (including, plainly, the original's pursuers and
kidnappers, its epitaphs, and why we replaced them; the pygmy jerboas as our heir to that joke), NOTES. An ADR
for the rendering choice. PROGRESS row.

## 12. Content rules

All ages. No real peoples as villains; no gore; the jerboas are comic, never scary-gory. Every line of copy is
ours; never reuse the original's messages or epitaphs. Facts about the Gobi and its animals must be true (the
five-toed pygmy jerboa lives in the Gobi, hops, is nocturnal and eats seeds); say so in the docs with sources.

## 13. When you finish, report

What you built; the verified facts about the original (with the repeat-bug numbers); simulation results vs the
targets; performance; deviations and why; kit candidates; commands to run it; tokens and time if your tool
shows them.

## 14. Hall integration

Manifest `two-humps` (inspiredBy: originalTitle "Desert", file `DESERT.BAS`, publisher "IPCO", year 1982),
emblem as SVG path data (two humps), palette, stats, modes, moons (the five Expedition places), trivia (our own
words, from verified facts). Achievements through the kit so they reach the Keyring; kit daily with its own
epoch; `demo(seed)`; results via the shared Results or the game's own with the standard actions. Replace the
`desert` placeholder in `lib/catalog.ts` at the very end, re-reading the file first.

## 15. Parallel rules

Kit owner this wave: **none** — do not change `lib/kit` or `components/kit`; write helpers in
`lib/two-humps/` and list them as kit candidates. May run alongside polish prompts that stay in their own game
folders. Shared dev server http://localhost:3210; your Playwright uses 3213. Never stop processes you did not
start. No commits, no pushes.
