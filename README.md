# Any Key

**Old code. New tricks.** Any Key is a hall of classic BASIC programs from the early '80s, rebuilt
for the web and for people who were born decades after them.

Every program gets a new look, new controls and new ideas, while keeping what made the original
fun. Each one also ships with six docs, readable in its Story tab: about the game, how to play, how
the original worked, what we changed, how we rebuilt it, and the lab notes.

## The Hall

The home page is the Hall, where you pick a program. It comes in three styles, and visitors can
switch between them at any time (the choice is remembered):

| Style | Idea |
| --- | --- |
| **Wall** | A bento wall of bold tiles with a live preview on each program card |
| **Orbit** | Each program is a planet you can spin; its tracks or levels are the moons |
| **Device** | A chunky handheld player: program cartridges, a rotary knob, a tiny screen |

Every page supports light and dark themes, works with keyboard and touch, and calms its motion
when the system asks for reduced motion. Press any letter key on the Hall and see what happens.

The Today strip under the Hall's top bar shows each game's daily and whether you have played it
today.

## The Keyring

Every achievement in every game is a keycap. Earn one and it drops onto a little key ring in the
corner of the screen, wherever you are. The Keyring page (`/keyring`: the Keyring button in every
top bar, or K in a game) hangs all of them
on one ring you can spin, with your level (twelve of them, from Home Row to Escape Artist), XP
(common keycaps 10, rare 30, legendary 80, a finished daily 5), this week's daily streak and every
keycap still to earn. It also holds Settings and "Forget my data", per game or for everything.
Nothing leaves your browser: there are no accounts and no servers.

## Finding your way

Every game works the same way (`docs/NAVIGATION.md`):

- **← Back to the Hall** sits on every game menu; Esc there goes back to the Hall, and the browser's
  Back button works everywhere.
- During play there is a pause button with an Esc hint. The pause menu always reads Resume, the
  game's own items, How to play, Settings, Game menu, Back to the Hall.
- Results always end with Play again (R), Game menu and Back to the Hall (H).
- Leaving a round in progress asks first.
- In a game, `?` opens the shortcuts, K opens the Keyring, and the Story tab (`#story`) holds the
  game's docs.

## Programs

| Program | Based on | Status |
| --- | --- | --- |
| **Bop Box** (`/music`) | `MUSIC.BAS`, IBM, 1981–82 | Playable |
| **Stickler** (`/stickler`) | `23MTCH.BAS`, Bob Albrecht / People's Computer Company, DEC 1973 | Playable |
| **Outta Here** (`/outta-here`) | `ESCAPE.BAS`, author unknown (TRS-80), c. 1980 | Playable |
| **Don't Crater** (`/dont-crater`) | `LANDER.BAS`, Simutek (TRS-80), 1979 | Playable |
| **Two Humps** (`/two-humps`) | `DESERT.BAS`, IPCO Personal Computer Owners Group (IBM PC), 1982 | Playable |
| **Same Trick Twice** (`/long-memory`) | `AWARI.BAS`, Geoff Wyvill / Creative Computing, 1978 | Playable |
| **Over / Short** (`/over-short`) | `GUNNER.BAS`, Tom Kloos / Creative Computing, 1973, and its IBM PC remake `CANNON.BAS` | Playable |

### Bop Box

Eleven tunes from the 1981 PC, as the 1981 program played them or complete, each playable in twelve
styles: Orchestra, Pop, Jazz, House, Dangdut, Koplo, Lo-fi, Hip-hop, Solo (18 instruments), PC Speaker
’81 (the 1981 beeps, recreated), an AI Remix composed by Claude in a different genre for
every tune, and the Original Score: Gounod, Sousa and Mozart played part by part from their own full
scores. Watch it as sheet music, falling notes, Indonesian numbered notation (*not angka*) or a stage
full of musicians, and download any arrangement as MIDI or WAV. The docs in `docs/music/` explain the
original and the rebuild.

### Stickler

Take 1, 2 or 3 sticks; never the last one. The 1973 mind game *23 Matches*, rebuilt with Sparky (an
opponent who is a stickler for rules), a coach that teaches the secret, a ten-table ladder ending in
the Marienbad 1-3-5-7 puzzle, a shareable daily puzzle, Handfuls (take 2–3, 3–5 and more, ending in a
sweep), two-player mode, fourteen achievements, three
stick styles (matches, glow sticks, candy) and a 1981 mode that plays exactly like the original on a
PC. The docs are in `docs/23mtch/`.

### Outta Here

The walls grow while you hesitate. A tiny TRS-80 game from around 1980, in which an asterisk has to
reach the exit while blocks fall whenever you stop pressing keys, rebuilt with wood to push, glass
to bomb, a Mega bomb to find that breaks stone, chain bonuses and four chasers (a Bouncer, an
Eraser that follows your trail, a Glitch that hunts you and, on Hard, a Copycat that comes after
you with your own tools). The original's bugs became tricks: the edge tunnels and the hiding place
under the keyboard. Play a Run on Chill, Normal or Hard, thirty Screens on five old computers, a
shareable Daily Escape, two-player Versus on one keyboard, or the 1980 mode, which runs the original
address by address, crash included. The docs are in `docs/escape/`.

### Don't Crater

Fall from orbit at 5,000 km/h and land like a feather. The 1979 TRS-80 descent simulator, rebuilt with
four worlds drawn like travel postcards (Earth, the Moon, Mars and the metal asteroid Psyche), where the
light theme is the day side and the dark theme the night side. Fly it live with a throttle lever and
time warp, or in the original's ten-second turns with a predicted path; learn the "hoverslam" from the
burn guide and the flight recorder, or fly by eye with the landing assist's green (5 km/h) and amber
(20 km/h) lines; take on ten missions and a shareable Daily Drop; tilt the lander in Free Flight and
steer across generated terrain to a marked flat (or a drifting barge off Earth's coast) without tipping
over; design the flag your astronaut plants; or play the 1979 mode, which runs the original's
arithmetic turn for turn, quirks included. A fuel setting (Generous, Standard, Tight) applies to every
mode but 1979. The docs are in `docs/lander/`.

### Two Humps

Forty miles across the real Gobi on a Bactrian camel with a mind of its own. The 1982 IBM PC trek,
rebuilt as a painted side-on diorama whose sun follows every turn: the light theme sets off at dawn, the
dark one at dusk under the Milky Way. Choose who is behind you: the Haboob, a wall of sand that never
sleeps; Captain Bluster's rival caravan, which drinks your oases dry; or the Ladle Gang, five pygmy
jerboas who sleep all day, hunt all night and stop for seeds. Every command shows its odds before you
pick it, and when the camel runs on by itself (the original's hidden bug, made fair) you decide whether
to let it run or pull the reins. Play a Crossing on Chill, Normal or Hard, a five-leg Expedition through
Khermen Tsav, Khongoryn Els, Bayanzag, Yolyn Am and a ger camp, a shareable Daily Crossing, or the 1982
mode, which runs the original program turn for turn, bugs included. Nobody gets hurt: lose and you
shelter from the storm or stay for porridge; win and your pursuer comes to the party. The docs are in
`docs/two-humps/`.

### Same Trick Twice

Sow seeds round a carved wooden board against an opponent that learns. The 1978 Awari program noted every
game it failed to win and steered away from those openings the next time; here that mind is the Learner,
and its notes fill a Memory Book that lies open on the table, where you can watch it read before it moves.
Beat it once, then try the same trick twice. Play the 1978 rules, traditional Oware (Abapa) or Kalah against
the Scholar, which searches ahead on Easy, Normal or Hard, or against a friend on one screen; click a pit,
press its number or carry the seeds round by hand; solve a shareable Daily Endgame; or switch to 1970s
mode, which runs the original program turn for turn, its never-cleared score and its crash after the
51st lesson included. The board is drawn in WebGL2: a sunlit courtyard in the light theme, a lamplit table
in the dark. The docs are in `docs/long-memory/`.

### Over / Short

Call an elevation, fire, and wait for the forward observer on the field telephone: over, short, or on target.
One of the first artillery games, from 1973, rebuilt as a painted Great War: the camera rides the shell along its
arc over the fields, the view cuts to the observer's field glasses for the fall of shot, and the report comes in on
a message slip. Play Classic, the 1973 drill of five targets in 18 rounds, or a twenty-mission Campaign that breaks
the textbook formula one chapter at a time: an observer who gives only over or short, an unknown gun, hills and
gales, real air, a moving convoy, a clock, and an enemy battery walking its rounds onto your gun until you move it.
The docs are in `docs/over-short/`.

## Project layout

```
app/                 Next.js App Router pages (the Hall, /keyring, one route per game)
lib/kit/             The kit's logic: storage and migrations, Keyring, stats, RNG, dailies, appearance, sound
components/kit/      The kit's UI: GameShell, pause menu, results, Story tab, keycaps, toasts, icons
components/keyring/  The Keyring page
components/hall/     The Hall and its three styles
components/previews/ Live mini previews shown on program cards
lib/catalog.ts       The list of game manifests, in Hall order
lib/<game>/manifest.ts  Each game's contract: title, colours, emblem, achievements, daily
lib/music/           Bop Box: tunes, arranger, styles, MIDI writer, audio engine
components/bopbox/   Bop Box studio screen and its views
lib/stickler/        Stickler: rules, solver, Sparky, modes, progress, sounds
components/stickler/ Stickler lobby, board, 1981 terminal
lib/outta/           Outta Here: engine, levels, campaign, daily, bot, 1980 simulation, progress
components/outta/    Outta Here lobby, canvas renderer, screens map, Versus, 1980 terminal
lib/lander/          Don't Crater: worlds, flight model, hoverslam solver, missions, 1979 maths, Free Flight terrain
components/dontcrater/ Don't Crater lobby, canvas scenes, flight screens, 1979 terminal
lib/two-humps/       Two Humps: trek engine, pursuers, 1982 program, bots, Expedition, daily, progress
components/two-humps/ Two Humps menu, pursuer pick, trek screen, Canvas 2D diorama, map, 1982 terminal
lib/long-memory/     Same Trick Twice: three rule sets, the 1978 program, the Learner, the Scholar, solver, Daily Endgame
components/long-memory/ Same Trick Twice menu, WebGL2 board and seed physics, Memory Book, match screen, 1970s terminal
lib/over-short/      Over / Short: ballistic models, engagements, Classic, Campaign missions, bots, the 1973 rules, progress
components/over-short/ Over / Short menus, firing screen, Canvas 2D battlefield and observer's view, eras, sound
docs/ARCHITECTURE.md How the app is built, and the folder map of every game
docs/NAVIGATION.md   The navigation standard
docs/adr/            Architecture decisions
docs/templates/      The six docs every game ships with
docs/PROGRESS.md     One row per game: status, docs, achievements, daily, polish candidates
docs/<id>/           ABOUT, HOW-TO-PLAY, ORIGINAL-ARCHITECTURE, CHANGES-FROM-ORIGINAL, ARCHITECTURE, NOTES
scripts/             Checks, the guardrails and the sound bank builder
tests/               Vitest (tests/unit), Playwright (tests/e2e, tests/shots), saved-data fixtures
prompts/             Work orders for Claude Code sessions
public/soundfont/    The trimmed sound bank and its licence
```

The original BASIC sources are **not** part of this repository. They belong to their publishers.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Checks:

```bash
npm run check            # type-check, lint, unit tests, guardrails and every check below
npm run test             # Vitest: the kit's storage, migrations, Keyring, RNG and dailies
npm run check:guardrails # no raster art, no emoji on the page, no network URLs in shipped code
npm run e2e              # production build, then Playwright on port 3211 (navigation, Keyring, appearance, Story)
npm run shots            # production build, then screenshots of every key screen into docs/media/shots/
npm run check:music      # every tune parses; every arrangement builds; the 1981 versions are unchanged
npm run check:audio      # renders every style offline and flags silence or clipping
npm run check:stickler   # plays thousands of Stickler games to prove the maths
npm run check:outta      # Outta Here's rules, the 1980 simulation, and human-like bots on every level and screen
npm run check:lander     # 1979 maths; every world, mission, Daily Drop and Free Flight site can be landed by human-like pilots
npm run check:two-humps  # Two Humps' balance against its targets, every Expedition leg, the Daily, and the 1982 program's numbers
npm run check:long-memory # Same Trick Twice's rule sets, the 1978 program against PC-BASIC recordings, the Learner, the Scholar, every Daily Endgame
npm run check:over-short # Over / Short's models against the 1973 formula, the drill under five kinds of player, every Campaign mission winnable
npm run build:soundfont -- path/to/MuseScore_General.sf3   # rebuild public/soundfont/bopbox.sf3
```

## Credits and legal

Any Key is an independent tribute. It is not affiliated with or endorsed by the
publishers of the original programs, and all trademarks belong to their owners. Melodies used in
the music program are public-domain compositions, transcribed for this project; no code or data
from the original programs is included.

Third-party work, with thanks:

- [MuseScore General](https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/) sound bank (MIT),
  trimmed for Bop Box. See `public/soundfont/LICENSE-MuseScore_General.md`.
- [SpessaSynth](https://github.com/spessasus/spessasynth_lib) SoundFont synthesizer (Apache-2.0).
- [VexFlow](https://github.com/vexflow/vexflow) music engraving (MIT).
- [Mermaid](https://github.com/mermaid-js/mermaid) diagrams and [marked](https://github.com/markedjs/marked) Markdown (MIT).
- [VT323](https://fonts.google.com/specimen/VT323) font for Stickler's 1981 mode, Don't Crater's 1979 mode and Two Humps' 1982 mode (SIL Open Font License).
- Psyche's size and gravity are public figures; Don't Crater is not affiliated with NASA or the Psyche mission.
