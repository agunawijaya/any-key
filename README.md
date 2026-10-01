# Any Key

**Old code. New tricks.** Any Key is a hall of classic BASIC programs from the early '80s, rebuilt
for the web and for people who were born decades after them.

Every program gets a new look, new controls and new ideas, while keeping what made the original
fun. Each one also ships with four docs: what the original was, how it was used, how it worked
inside, and how the rebuild works.

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

## Programs

| Program | Based on | Status |
| --- | --- | --- |
| **Bop Box** (`/music`) | `MUSIC.BAS`, IBM, 1981–82 | Playable |
| **Stickler** (`/stickler`) | `23MTCH.BAS`, Bob Albrecht / People's Computer Company, DEC 1973 | Playable |
| **Outta Here** (`/outta-here`) | `ESCAPE.BAS`, author unknown (TRS-80), c. 1980 | Playable |
| **Don't Crater** (`/dont-crater`) | `LANDER.BAS`, Simutek (TRS-80), 1979 | Playable |

### Bop Box

Eleven tunes from the 1981 PC, as the 1981 program played them or complete, each playable in twelve
styles: Orchestra, Pop, Jazz, House, Dangdut, Koplo, Lo-fi, Hip-hop, Solo (18 instruments), PC Speaker
’81 (the original beeps, recreated exactly), an AI Remix composed by Claude in a different genre for
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
to bomb, chain bonuses and three chasers (a Bouncer, an Eraser that follows your trail and a
Glitch that hunts you). The original's bugs became tricks: the edge tunnels and the hiding place
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

## Project layout

```
app/                 Next.js App Router pages
components/hall/     The Hall and its three styles
components/previews/ Live mini previews shown on program cards
lib/catalog.ts       The list of programs
lib/music/           Bop Box: tunes, arranger, styles, MIDI writer, audio engine
components/bopbox/   Bop Box studio screen and its views
lib/stickler/        Stickler: rules, solver, Sparky, modes, progress, sounds
components/stickler/ Stickler lobby, board, 1981 terminal
lib/outta/           Outta Here: engine, levels, campaign, daily, bot, 1980 simulation, progress
components/outta/    Outta Here lobby, canvas renderer, screens map, Versus, 1980 terminal
lib/lander/          Don't Crater: worlds, flight model, hoverslam solver, missions, 1979 maths, Free Flight terrain
components/dontcrater/ Don't Crater lobby, canvas scenes, flight screens, 1979 terminal
components/kit/      Pieces every program shares (the Story tab)
docs/<program>/      ABOUT, HOW-TO, ORIGINAL-ARCHITECTURE, PORT-ARCHITECTURE
scripts/             Checks and the sound bank builder
public/soundfont/    The trimmed sound bank and its licence
```

The original BASIC sources are **not** part of this repository. They belong to their publishers.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Useful checks:

```bash
npm run check:music      # every tune parses; every arrangement builds; the 1981 versions are unchanged
npm run check:audio      # renders every style offline and flags silence or clipping
npm run check:stickler   # plays thousands of Stickler games to prove the maths
npm run check:outta      # Outta Here's rules, the 1980 simulation, and human-like bots on every level and screen
npm run check:lander     # 1979 maths; every world, mission, Daily Drop and Free Flight site can be landed by human-like pilots
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
- [VT323](https://fonts.google.com/specimen/VT323) font for Stickler's 1981 mode and Don't Crater's 1979 mode (SIL Open Font License).
- Psyche's size and gravity are public figures; Don't Crater is not affiliated with NASA or the Psyche mission.
