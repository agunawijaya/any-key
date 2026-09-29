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
| Bop Box (working title) | `MUSIC.BAS` (1981) | In the studio |

## Project layout

```
app/                 Next.js App Router pages
components/hall/     The Hall and its three styles
components/previews/ Live mini previews shown on program cards
lib/catalog.ts       The list of programs
docs/<program>/      ABOUT, HOW-TO, ORIGINAL-ARCHITECTURE, PORT-ARCHITECTURE
```

The original BASIC sources are **not** part of this repository. They belong to their publishers.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Credits and legal

Any Key is an independent tribute. It is not affiliated with or endorsed by the
publishers of the original programs, and all trademarks belong to their owners. Melodies used in
the music program are public-domain compositions, transcribed for this project.
