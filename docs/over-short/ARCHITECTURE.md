# Over / Short: how the rebuild works

Over / Short is three layers. The **engine** (`lib/over-short/`) is pure TypeScript: ballistic models, the
engagement (one gun, its targets, its rounds, turn by turn), the play styles that set engagements up, the Campaign's
missions as data, Field Artillery's full-physics engagement and its shoots, the duel, the Daily Barrage, the two
1970s programs, the bots that prove them all, and the player's progress. The **battlefield** (`components/over-short/
scene/`, `play/director.ts`) paints what the engine decides, in Canvas 2D. The **era** (`components/over-short/eras/`)
supplies everything that is look, sound and words. The engine never sees an era, and the battlefield never decides a
shot.

## Module map

| File | Owns |
|---|---|
| `lib/over-short/ballistics.ts` | The textbook vacuum formulas: range, muzzle speed, flight, apex |
| `lib/over-short/models.ts` | The three ballistic models and the one integrator that flies every shell (`fly`), `positionAt`, `bestRange` |
| `lib/over-short/engagement.ts` | Rules, targets, the observer's verdict (`observe`), and `act`, which plays one order and returns the events |
| `lib/over-short/classic.ts` | Classic's setup and score |
| `lib/over-short/missions.ts` | The twenty Campaign missions as data, `buildMission`, medals, chapters |
| `lib/over-short/playstyles.ts` | The play-style layer: sessions, `engage`, `verdictOf` |
| `lib/over-short/bots.ts` | The simulated players and what they may see (`seen`) |
| `lib/over-short/original.ts` | Gunner's and Cannoneer's rules, quirks included |
| `lib/over-short/words.ts` | Units, the observer's spoken numbers, Field Artillery's corrections and the wind in words |
| `lib/over-short/terrain.ts` | Real ground: a survey line, its height anywhere (`heightAt`), the highest point between two places |
| `lib/over-short/fieldModel.ts` | Field Artillery's gun (four charges), the 3D flight with drag and wind over the ground (`flyField`), the firing tables |
| `lib/over-short/field.ts` | The Field Artillery engagement: rules, targets, the enemy battery, the observer (`observeField`), and `actField` |
| `lib/over-short/fieldMissions.ts` | The ten shoots as data, the difficulty table, `buildFieldMission`, medals |
| `lib/over-short/fieldBots.ts` | What a battery can see (`fieldSeen`), the skilled gunner, the player at the screen, the oracle |
| `lib/over-short/duel.ts` | The Counter-Battery Duel: two batteries, a turn of both orders (`actDuel`), the three commanders |
| `lib/over-short/daily.ts` | The Daily Barrage: the day's shoot and seed, its marks and share string |
| `lib/over-short/terminal.ts` | The 1970s: Gunner and Cannoneer as a state machine in Microsoft BASIC's arithmetic |
| `lib/over-short/progress.ts` | The saved progress, settings, records, the battery's range table, keycaps |
| `lib/over-short/manifest.ts` | The game's contract with the Hall |
| `components/over-short/OverShort.tsx` | The game menu and the screens it leads to |
| `components/over-short/Menu.tsx`, `Briefing.tsx`, `CampaignMap.tsx`, `Records.tsx`, `GameSettings.tsx` | The screens around a game |
| `components/over-short/Backdrop.tsx`, `scene/demo.ts` | The self-playing battlefield behind the menus and on the Hall card |
| `components/over-short/play/FiringScreen.tsx` | A game in progress: plays the engine, hands events to the director, keys, the shell |
| `components/over-short/play/director.ts` | Turns events into a sequence on screen: the shot, the fall of shot, a target going up, an enemy round, a move |
| `components/over-short/play/Battlefield.tsx` | The two canvases and the director's lifetime |
| `components/over-short/play/Hud.tsx`, `ElevationControl.tsx`, `ReportSlip.tsx`, `ObserverMap.tsx`, `FiringTable.tsx`, `Outcome.tsx` | The panels over the battlefield, and the results |
| `components/over-short/field/FieldMissions.tsx` | The shoot list with the difficulty, a shoot's briefing, the Daily Barrage's briefing |
| `components/over-short/field/FieldScreen.tsx` | A Field Artillery shoot or Daily Barrage in progress: orders, keys, the shell |
| `components/over-short/field/fieldDirector.ts`, `FieldBattlefield.tsx` | The shoot on screen: the arc over the hills, enemy fire from close by, the team and limber, star shells, smoke, the convoy, the bridge and its column |
| `components/over-short/field/AimPanel.tsx`, `FieldHud.tsx`, `FieldSlip.tsx`, `FieldMap.tsx`, `FieldTable.tsx`, `FieldOutcome.tsx` | Charge, line and elevation; the target card and forecast; the correction slip; the map from above; the firing table; the results and the Daily's share |
| `components/over-short/duel/DuelSetup.tsx`, `DuelScreen.tsx`, `duelDirector.ts` | The duel: the opponent, the turns and the hot-seat handover, the whole ridge on screen |
| `components/over-short/terminal/Terminals.tsx`, `TerminalScreen.tsx`, `speaker.ts` | The 1970s: the choice of terminal, the teletype and the green screen, Cannoneer's PC speaker |
| `components/over-short/scene/side.ts` | The side view: parallax layers painted into tiles, the squeezed sky, flare light |
| `components/over-short/scene/front.ts` | The observer's view: a perspective ground painted per pixel, props, flare light |
| `components/over-short/scene/particles.ts`, `effects.ts` | Smoke, earth, fire and sparks, and the effects built from them |
| `components/over-short/scene/arcs.ts`, `battle.ts` | The shell's arc from the drawn muzzle; a burst's wash of heat and the view's shake |
| `components/over-short/scene/gunline.ts`, `detail.ts`, `paint.ts`, `noise.ts`, `color.ts` | Helpers: where the gun is drawn (either way round, or lit by a fire beside it), how finely to paint, brushes, noise, colour |
| `components/over-short/eras/types.ts`, `eras/index.ts` | The `Era` interface and the list of eras |
| `components/over-short/eras/great-war/` | The Great War: palette, sky, land, observer's view, gun, targets, biplane, optics, and Field Artillery's river, viaduct, lorry and team (`fieldPieces.ts`) |
| `components/over-short/sound.ts` | Every sound, synthesised |
| `components/previews/OverShortPreview.tsx` | The game's card in the Hall |
| `app/over-short/page.tsx` | The route: reads the docs, renders the game |

## State machines

The screens:

```mermaid
stateDiagram-v2
  [*] --> Menu
  Menu --> ClassicBriefing: "Classic"
  Menu --> Campaign: "Campaign"
  Menu --> Shoots: "Field Artillery"
  Menu --> DailyBriefing: "Daily Barrage"
  Menu --> DuelSetup: "Counter-Battery Duel"
  Menu --> Terminals: "The 1970s"
  Menu --> Records
  Menu --> Settings: "Game settings"
  Campaign --> MissionBriefing: "a mission"
  Shoots --> ShootBriefing: "a shoot"
  ClassicBriefing --> Firing: "Take the gun (Enter)"
  MissionBriefing --> Firing: "Take the gun (Enter)"
  ShootBriefing --> FieldPlay: "Take the gun (Enter)"
  DailyBriefing --> FieldPlay: "Take the gun (Enter)"
  DuelSetup --> DuelPlay: "To the guns (Enter)"
  Terminals --> Terminal: "Gunner or Cannoneer"
  Firing --> Results: "engagement over"
  FieldPlay --> Results: "shoot over"
  DuelPlay --> Results: "a battery silenced, or both out of rounds"
  Results --> Firing: "Play again (R)"
  Results --> MissionBriefing: "Next mission"
  Results --> ShootBriefing: "Next shoot"
  Results --> Menu: "Game menu (Esc)"
  Terminal --> Menu: "Game menu"
  Terminal --> Terminal: "the other terminal"
  Records --> Menu
  Settings --> Menu
  MissionBriefing --> Campaign: "back"
  ShootBriefing --> Shoots: "back"
```

Every play screen pauses on Esc with the kit's pause menu, and its game menu item returns to the menu.

One order on the firing screen. The engine answers at once; the director plays the answer, and the panels change
only when it is over, so nothing gives the result away early:

```mermaid
sequenceDiagram
  participant P as "Player"
  participant F as "FiringScreen"
  participant E as "engine: act()"
  participant D as "Director"
  P->>F: "Fire at 27.5°"
  F->>E: "act(engagement, fire)"
  E-->>F: "next engagement, events"
  F->>D: "play(events)"
  D->>D: "flight: recoil, the camera rides the shell"
  D->>D: "fall: the glasses fill the screen, earth or a hit"
  D-->>F: "onReport(shot): the slip appears"
  D->>D: "enemy round, next target, move: if any"
  D->>D: "return: camera home, glasses back to their corner"
  D-->>F: "onDone(): panels update, results if over"
```

## The engine

### The ballistic models (`models.ts`)

One integrator flies every shell: fourth-order Runge–Kutta with a fixed step of 0.1 s, until the shell crosses the
ground on its way down, where the crossing is solved inside the step (a parabola, so a low round is placed to the
centimetre). The ground is a straight slope from the gun through the target, so a target on a hill and one in a
valley use the same code. The models differ only in the acceleration:

| Model | Acceleration | Used by |
|---|---|---|
| `vacuum` | gravity | Classic, Chapters 1–2 |
| `modified` | gravity, and a push along the line of fire of 0.04 m/s² for every m/s of wind | Chapter 3 |
| `air` | gravity and drag against the air: k times the speed through the air, times the velocity through the air, with k = 4 × 10⁻⁵ per metre | Chapters 4–5 |

With no drag and no wind the integrator lands exactly where R · sin 2θ says (the check finds no error at all over
1°–89°). `bestRange` finds the elevation that throws furthest by golden-section search, cached per gun.

### The engagement (`engagement.ts`)

An `Engagement` is a value: rules (model, gun, wind, what the briefing tells, the observer's reports and rounding,
ammunition, elevation limits, clock, counter-fire, moves), targets (kind, distance, height, speed, radius, hits) and
state (current target, time, shots, enemy rounds, gun position, outcome). `act(engagement, action)` returns the next
engagement and the events, in order: `shot`, `too-late`, `target-destroyed`, `next-target`, `enemy-round`,
`relocated`, `refused`, `over`. It never mutates its input, so the screen can hold the old one while the director
plays the new one.

- **Moving targets** are judged where they are when the round lands: game time moves on by the flight time plus the
  time to lay the gun again.
- **The clock**: a round landing after the limit ends the engagement as `out-of-time` and counts for nothing.
- **Counter-fire**: after each turn the enemy's round lands `first · closing^n` from the gun; at or under `lethal`
  the gun is lost. Moving the gun spends a turn, shifts it along the line of fire, and starts the enemy's count again.

### Play styles (`playstyles.ts`)

A play style is `{ id, title, engage(session), verdict(session, engagement) }`. Classic builds an engagement from a
seed (`classic.ts`); the Campaign builds one from a mission and a seed (`missions.ts`). The firing screen, the map,
the table and the results read only engagements and verdicts.

**To add a play style** that plays like the Campaign: add its session type to `Session`, write its `engage` and
`verdict`, route them in `engage` and `verdictOf`, and give it a button and a briefing in the menu. A style that
needs more than the Campaign's engagement has (charges, a line, real ground, a clock of its own) gets an engine
and a screen of its own beside it, as Field Artillery, the duel and the terminals did (ADR 0016); add its id to
`PlayStyleId` so the menu remembers it.

### Field Artillery (`field.ts`, `fieldModel.ts`, `terrain.ts`)

A separate engagement from the Campaign's (ADR 0016), as pure: `actField(engagement, action)` returns the next
engagement and the events in game-time order. The orders are `fire` (a charge, an elevation, a line in mils),
`relocate` and `illuminate`.

- **The flight** (`flyField`) is the Campaign's integrator in three dimensions: RK4 at 0.1 s, drag against the
  velocity through the air, wind along and across, over a `Terrain` (a survey line smoothed between points, with a
  little seeded unevenness). The ground crossing is bisected inside the last step; `intoCrest` marks a round that
  met the ground still climbing. The firing tables (`firingTable`) are flown once per charge over level ground in
  still air, with each row's drift and carry per m/s of wind, and cached.
- **One round.** Game time moves on by the laying (25 s, 15 more for a new charge); the round meets the mean wind
  pushed about by a gust drawn from the seed and its number; it flies with this barrel's wear and the round's own
  dispersion; the target is judged where it is when the round lands. The observer (`observeField`) then reports a
  correction rounded to the difficulty's step, misjudged by its share, or only the flash at night unless a star
  shell is burning, or nothing through smoke.
- **The enemy battery** runs on its own clock: its rounds that fall while ours is in the air are events before
  ours. The n-th round at a gun position lands about `first · closing^n` from the gun (give or take 15%), from
  their side of the line; within `lethal` the gun is lost. A move (`relocate`) takes `RELOCATE_SECONDS` and 400 m of road; rounds that fall
  meanwhile land on the empty pit, and the count starts again at the new pit.
- **What the battery believes.** The rules carry a `told` map position and forecast that are not the truth;
  `fieldSeen` builds a player's view from them and the reports, never from the truth, and the screen shows the same.

### The duel (`duel.ts`)

A turn is both batteries' orders together. Each round is flown in its own gun's frame (the east gun's frame is the
west's mirrored) and placed in the world; the earlier landing is judged first, so a decisive hit can come before
the other side's round arrives, which then does not count. A move puts the gun 400 m further back and its old pit
takes the other side's round. The computer commanders are `fieldHumanBot`s with their own settings, fed the same
`FieldSeen` view a player gets; in the hot seat, the screen hands over between the two commanders with nothing of
the other side's on it.

### The Daily Barrage (`daily.ts`)

`dailyBarrage(date)` takes the kit's `dailyDate` with the manifest's epoch: a day number and a local date key.
Each run of ten days shuffles the ten shoots with a seed of its own; the day's seed builds the attempt on Normal;
on some days a harassing battery is added. The share string is the round marks, the result and the forecast wind.

### The 1970s terminals (`terminal.ts`)

`bootTerminal(program)` loads a program as Microsoft BASIC would, with its random generator at its load state;
`typeLine(state, line)` plays one line typed at the prompt and returns the lines to print, the events (the same
vocabulary as the golden sessions) and the PC-speaker cues. The screen prints Gunner's lines at a teletype's 55
characters a second, in capitals, and Cannoneer's at 900 a second on a green screen, and plays Cannoneer's cues on an
oscillator (`speaker.ts`).

### Missions as data (`missions.ts`)

Each `MissionSpec` gives bands, not numbers: the gun's vacuum range, target distances as shares of the gun's real
greatest range, heights, speeds, wind, plus ammunition, limits, clock, counter-fire and medal thresholds.
`buildMission(spec, seed)` turns one into an engagement with the kit RNG, so every attempt differs in its numbers but
never in its lesson. From Chapter 4 the gun is fixed (`BATTERY_GUN`), so the range table a player builds stays true.

### Progress (`progress.ts`)

`anykey.over-short.save`, version 1, through `createStore` and `createProgress`: settings, Classic's records, each
mission's tries, wins, best rounds and medal, and the battery's range table (rounds fired in Chapters 4 and 5 on level
ground in still air, newest per elevation, at most 40). `afterEngagement` is the pure function that records a game
and decides its keycaps. A mission played with the textbook hint earns silver at most.

07b added fields with defaults, so older saves load unchanged: the difficulty in the settings; Field Artillery's
records per shoot and difficulty (`"F3/normal"`: tries, wins, best rounds and time, medal); the duel's tallies and
the commanders beaten; each Daily Barrage by its date key (first finish only), which the kit's `dailies` option
reads; and each terminal's wars begun and finished. `afterField`, `afterDaily`, `afterDuel` and `afterTerminal`
record them and award the new keycaps.

## AI

There are no opponents to play against: the bots are simulated players for the checks (`bots.ts`). They see only
what the screen shows (`seen`): the briefing, the target's distance rounded as shown, the reports, how long each
round flew.

| Bot | How it lays the gun |
|---|---|
| `calculatorBot` | The 1973 formula, ½ · asin(T ÷ R) |
| `gunnerBot` | The "sensible gunner": every round with a reported distance becomes a row of its own range table; the next elevation comes from the two rows that straddle the target (or the two nearest, with a firm step where the curve is flat near the greatest range). It leads a moving target by its speed times the flight time, keeps to the low road, and moves the gun when the enemy's last round fell within 300 m. With direction-only reports it brackets |
| `bracketBot` | Directions only: steps 4° until one round is over and one short, then splits the difference |
| `halvingBot` | The first correction from the reported distance and a rule of thumb, then halves the correction at every flip |
| `naiveBot` | A degree at a time |

`asOriginalPlayer` runs the same bots at the 1973 programs' prompt. The numbers are in NOTES.md.

Field Artillery has its own players (`fieldBots.ts`), and here they also play: the duel's three commanders are
the player at the screen with different settings.

| Bot | How it lays the gun |
|---|---|
| `fieldGunnerBot` | A battery officer: keeps a registration (how far beyond the table its rounds throw, shared across charges, and how far right they drift), picks the charge and elevation whose path clears any crest with room, leads a convoy, calls star shells, moves under fire |
| `fieldHumanBot` | A player at the screen: the first round straight from the table, then a share of each correction; options for ignoring the crest, not leading, never lighting, never moving, and preferring the fastest flight |
| `fieldOracle` | The true physics (true position, true mean wind, this barrel's wear): proves an attempt can be won |
| `commander(kind)` | The duel's cautious (60% of each correction, moves within 230 m), aggressive (115%, never moves, fastest flight) and methodical (85%, moves within 120 m) commanders |

## Drawing

Canvas 2D throughout (see the ADR on rendering). Two views:

- **The side view** (`scene/side.ts`) slides parallax layers painted once into 768-pixel tiles (kept in a cache,
  evicted by age), over a sky painted once per size and appearance. Altitude is squeezed (`altitudeY`): a shell
  climbs fast near the ground and flattens high up, so a 4 km-high arc and a 13 km range fit the screen like a
  hand-drawn range diagram. At night each layer is painted twice, dark and as a star shell lights it, and the
  lights' reach is a mask over the lit painting. The gun and the targets are drawn far larger than life
  (`scene/gunline.ts`), so the muzzle smoke and the start of the arc are placed from where the gun is drawn.
- **The observer's view** (`scene/front.ts`) is a pinhole camera above the ground behind the target: the ground is
  painted pixel by pixel at half resolution from the era's ground colour at each point, props stand on it far to
  near, and effects are drawn in the same metres, so a round 300 m over bursts exactly where 300 m beyond the target
  is. Its canvas is always full size; in its corner it is only scaled down by CSS, so going full screen for the fall
  of shot costs no repainting. In the corner it is painted every other frame.

**Bursts in the side view.** The side view's land is kilometres across, so a shell burst at life size would be a
few pixels while the gun beside it is drawn many times larger than life. Its particle world therefore draws every
effect larger than life around the point where it started (`Particles.magnify`, set so a metre of burst is 0.75% of
the view's height; the motion itself is unchanged), and a round landing there gets its own `explosion` effect: a
white flash, a fireball of billows that burn yellow and red and roll up into black smoke, a jet of earth, chunks
flung out, dust racing along the ground and a pall that stays. The view shakes with it (the canvas is moved, so no
repainting) and a wash of heat crosses it; with less motion there is no shake. The main screen holds the burst for
1.4 s (a miss), 1.6 s (a hit) or 2 s (a target destroyed) before the observer's glasses come up on it, close.

**Field Artillery's battlefield** (`field/fieldDirector.ts`) is the same two views over real ground:
`SideView.setRelief` gives the side view the terrain's heights (squeezed, as altitude is), and a `foreground` hook
draws the gun and the crew over the bursts. It plays its own steps: the player's round and the observer's glasses
first, then the enemy's rounds that fell meanwhile, shown from close by. Under fire the view cuts (it does not zoom)
to a close view of the gun at 1,900 m across, with the gun drawn half as large again; earth rains on the crew, who
get down, and at night the burst's fire lights the gun from the side (`drawGunInGlare`). Moving the gun brings up
the team of horses and the limber. At night the side view shows nothing but flashes until a star shell burns; in
the light theme a night shoot keeps the moon up and a little moonlight everywhere. While the player aims, the
director has the side view paint ahead, one tile a frame, the close view and the land out past the target, so
neither the cut nor the ride along the arc waits for painting (NOTES.md, drawing performance).

**The duel's battlefield** (`duel/duelDirector.ts`) shows the whole ridge with both guns, more land to the west
where the aiming panel sits. Both rounds leave together and are flown at eight times speed, each landing in its own
time; a battery silenced is left slewed over in smoke.

The director (`play/director.ts`) owns both views and two particle worlds, the camera (riding with the shell unless
the player or reduced motion says otherwise), the star shells at night, the targets' looks (intact, damaged,
destroyed, with the time since the change for a falling mast), and a timer that runs in scene time so a pause holds
everything. Without a graphics card the canvases are painted at 0.6 of a pixel per pixel (`scene/detail.ts`); on a
real one, always at the screen's resolution.

Light and dark are two designed appearances: day is a pale overcast with wet fields and distant smoke; night is a
barrage under star shells with gun flashes along the horizon. The panels use the paper and ink tokens in
`ui.module.css`, cream and khaki by day, blackout and brass by night.

### The era layer

`eras/types.ts` defines `Era`: its words (target names, the observer, the line), the side view's sky and layers,
the observer's ground, sky, props and optic, the gun (drawing and muzzle position), the shell, its trail and the
flares, each target in both views in three states, the vehicles of a moving target, and the effects for a fall of
shot, a hit and the muzzle. `eras/great-war/index.ts` assembles the Great War from its modules.

**To add an era**: make `eras/<id>/` with modules for each part, assemble an `Era` in its `index.ts`, and add it to
`ERAS` in `eras/index.ts`. Nothing in `lib/` changes, and the existing checks must pass untouched: an era decides
how a shot looks, never where it lands.

### Where each visual lives

| What | Where |
|---|---|
| Colours of the war | `eras/great-war/palette.ts` |
| The sky, its clouds, the balloon and the biplane | `eras/great-war/sky.ts`, `biplane.ts` |
| The side-view land, its farms, woods, wire and trenches | `eras/great-war/land.ts`, `features.ts` |
| The observer's ground, skyline and trees | `eras/great-war/front.ts` |
| The field glasses | `eras/great-war/optics.ts` |
| The gun and crew | `eras/great-war/gun.ts` |
| The shell, its trail, the star shells | `eras/great-war/flight.ts` |
| The targets, both views | `eras/great-war/targets.ts` |
| Bursts (the side view's `explosion`, the glasses' `earthFountain`), fire, a dump going up, stonework | `scene/effects.ts` |
| The dial | `play/ElevationControl.tsx` |
| The observer's map | `play/ObserverMap.tsx` |

## Sound

`components/over-short/sound.ts` synthesises everything with Web Audio into the kit's effects bus, so the top
bar's mute and the volume apply. The firing screen maps the director's cues to it: `fire` (a crew call, the crack,
the thump, two echoes), `whistle` (climbing as the shell comes in), `impact`, `destroyed` (with secondaries for a
dump) and a cheer, `report` (the line crackling), `incoming` and the enemy's impact, `limber` for a move, and birds
now and then while all is quiet by day.

Field Artillery and the duel add `telephone` (the field telephone's ring before the observer speaks), `starShell`
(a pop and a hiss), an `incoming` whistle that falls in pitch (ours climbs), and `limber` (hooves, harness and
wheels). Their screens open the audio as soon as they open (`wake`), so the first round does not wait for it. The
1970s terminals play Cannoneer's speaker on a square-wave oscillator of their own (`terminal/speaker.ts`), timed
from the program's clock ticks.

## Kit integration

- **Manifest**: `lib/over-short/manifest.ts`, with the emblem (an arc over a gun), palette, stats, the six modes,
  moons (the eras), the Daily's epoch and twenty keycaps.
- **Shell**: the firing screen reports `play` or `results` with `usePlayScreen`; its pause item is **New game** or
  **Restart the mission**; leaving asks first once a round has been fired. Results use the kit's `Results` card,
  with a **Next** mission as an extra action.
- **Progress**: `createStore` (version 1, no migrations yet) and `createProgress`, which sends new keycaps to the
  Keyring and finished games to the stats, and through its `dailies` option marks each day's Daily Barrage done with
  the kit.
- **Daily**: `dailyDate` numbers the days from the manifest's epoch; `ShareButton` copies the share string.

## Tests

| What | Command | Proves |
|---|---|---|
| Check script | `npm run check:over-short` (about two and a half minutes) | The originals' quirks, the drill under five kinds of player, the models against the formula, every mission won by the sensible gunner, every Chapter 5 twist necessary; Field Artillery's model against the formula, the Campaign's model and the lag rule, every shoot on every difficulty won by the oracle and most by the gunner and the player, each shoot's twist necessary, the duel's balance, 120 Daily Barrages winnable, the terminals against the golden sessions (NOTES.md). `--field=`, `--duels=` and `--days=` play more |
| Unit tests | `npx vitest run tests/unit/over-short.test.ts tests/unit/over-short-field.test.ts` | Reports, Classic's rules, the two-hit bridge, counter-fire and moving the gun, the clock, moving targets, missions from seeds, words; the field model and tables, the observer's corrections, flashes and smoke, star shells, the enemy and the empty pit, the duel's turns, the Daily's numbering and share, the terminals' quirks |
| End to end | `npx next build`, then `npx playwright test --config playwright.over-short.config.ts` (port 3217) | Classic by keyboard and by mouse to the results, a direction-only mission won, the counter-battery finale, the firing table, settings across a reload, records, every way out; a Field Artillery shoot won from the observer's corrections, the duel's hot-seat handover, the Daily Barrage, both terminals, and the ways out of each |

## Known limits

- The observer looks along the line of fire, so a round far over is a small burst near the horizon and one far
  short can be very close to the glasses. The map always shows both.
- The side view squeezes heights: hills and valleys are told on the target card rather than drawn to scale.
- Field Artillery's side view squeezes heights as the Campaign's does, so a crest looks lower than it is; the
  target card gives the height, and a round into a crest is drawn striking it.
- The duel shows no observer's glasses: both observers' reports are on the slips, and the ridge is the picture.
- Three more eras are prompt 07c.
